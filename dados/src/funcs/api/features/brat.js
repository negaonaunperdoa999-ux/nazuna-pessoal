import { BoundedCache } from '../cache.js';
import { ConcurrencyLimiter } from '../limiter.js';
import { ApiError, ErrorCodes, inputError, toApiError } from '../errors.js';
import { loadConfig } from '../config.js';
import { getBratProvider, resolveProviderChain, shouldFallback } from '../policy.js';
import { generateBrat as generateVexBrat } from '../providers/vex.js';
import { generateBrat as generateLocalBrat } from '../providers/local/brat.js';

export const defaultBratCache = new BoundedCache({
    maxEntries: 200,
    maxBytes: 32 * 1024 * 1024,
    maxItemBytes: 4 * 1024 * 1024,
    ttlMs: 30 * 60 * 1000
});

export const defaultBratLimiter = new ConcurrencyLimiter({
    maxConcurrent: 2,
    maxQueue: 20
});

function graphemeLength(value) {
    if (typeof Intl?.Segmenter === 'function') {
        const segmenter = new Intl.Segmenter('pt', { granularity: 'grapheme' });
        return Array.from(segmenter.segment(String(value))).length;
    }
    return Array.from(String(value)).length;
}

function optionalString(value, fallback, maxLength) {
    const text = String(value ?? '').trim();
    if (!text) return fallback;
    if (text.length > maxLength) {
        throw inputError(`Parâmetro muito longo. Máximo de ${maxLength} caracteres.`);
    }
    return text;
}

export function normalizeBratInput(input = {}) {
    const source = typeof input === 'string' ? { query: input } : input;
    const query = String(source?.query ?? '').trim();

    if (!query) throw inputError('O texto (query) é obrigatório.');
    if (graphemeLength(query) > 200) {
        throw inputError('O texto deve ter no máximo 200 caracteres.');
    }

    const bg = optionalString(source?.bg, 'white', 64);
    const textColor = optionalString(source?.text_color, 'black', 64);
    const blurRaw = source?.blur === null || source?.blur === undefined
        ? ''
        : String(source.blur).trim();

    if (blurRaw) {
        const blur = Number(blurRaw);
        if (!Number.isFinite(blur) || blur < 0 || blur > 50) {
            throw inputError('O parâmetro blur deve ser um número entre 0 e 50.');
        }
    }

    return {
        query,
        bg,
        text_color: textColor,
        blur: blurRaw
    };
}

export function bratCacheKey(provider, input) {
    return JSON.stringify([
        provider,
        input.query,
        input.bg,
        input.text_color,
        input.blur
    ]);
}

export async function runBrat(input, options = {}) {
    const normalized = normalizeBratInput(input);
    const config = options.config || loadConfig();
    const provider = options.provider
        ? getBratProvider({ api: { brat: { provider: options.provider } } }, {})
        : getBratProvider(config, options.env);
    const chain = resolveProviderChain(provider);
    const cache = options.cache || defaultBratCache;
    const limiter = options.limiter || defaultBratLimiter;
    const providers = {
        local: options.providers?.local || generateLocalBrat,
        vex: options.providers?.vex || generateVexBrat
    };

    let lastError;

    for (let index = 0; index < chain.length; index++) {
        const providerName = chain[index];
        const cacheKey = bratCacheKey(providerName, normalized);
        const cached = cache.get(cacheKey);
        if (cached) return { ...cached, cached: true };

        try {
            const result = await limiter.run(() => providers[providerName](normalized, {
                config
            }));
            const response = {
                ok: true,
                ...result,
                provider: providerName
            };
            cache.set(cacheKey, response);
            return response;
        } catch (error) {
            const normalizedError = toApiError(error);
            lastError = normalizedError;

            if (!shouldFallback(provider, normalizedError, index, chain)) {
                throw normalizedError;
            }
        }
    }

    throw lastError || new ApiError(ErrorCodes.INTERNAL, {
        message: 'Nenhum provedor de brat disponível'
    });
}
