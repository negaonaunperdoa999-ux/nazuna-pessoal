import { ApiError, ErrorCodes } from '../errors.js';
import { loadConfig, getVexSettings } from '../config.js';
import { createHttpClient } from '../http.js';

let defaultHttpClient;

function getHttpClient() {
    if (!defaultHttpClient) {
        defaultHttpClient = createHttpClient({
            timeoutMs: 8000,
            maxBytes: 256 * 1024
        });
    }
    return defaultHttpClient;
}

export function buildBratUrl(input, settings) {
    let url = `${settings.siteVex}/api/canvas/brat?apikey=${encodeURIComponent(settings.apiKey)}&query=${encodeURIComponent(input.query)}`;
    if (input.bg) url += `&bg=${encodeURIComponent(input.bg)}`;
    if (input.text_color) url += `&text_color=${encodeURIComponent(input.text_color)}`;
    if (input.blur) url += `&blur=${encodeURIComponent(input.blur)}`;
    return url;
}

export async function checkVexKey(options = {}) {
    const config = options.config || loadConfig();
    const settings = getVexSettings(config);
    const http = options.http || getHttpClient();

    if (!settings.siteVex) {
        throw new ApiError(ErrorCodes.CONFIG_MISSING, {
            message: 'site_vex não configurado',
            userMessage: '`site_vex` não configurado no config.json.'
        });
    }

    if (!settings.apiKey) {
        throw new ApiError(ErrorCodes.CONFIG_MISSING, {
            message: 'apikey_vex não configurada',
            userMessage: 'Api-key não configurada. Use o comando de apikey para configurar.'
        });
    }

    const url = `${settings.siteVex}/api/verificarkey?apikey=${encodeURIComponent(settings.apiKey)}`;
    const response = await http.request({
        url,
        method: 'GET',
        responseType: 'text',
        throwOnHttpError: false,
        signal: options.signal
    });

    const status = Number(response?.status || 0);
    const text = String(response?.data ?? '');
    let data = null;

    if (response?.data && typeof response.data === 'object') {
        data = response.data;
    } else {
        try {
            data = JSON.parse(text);
        } catch {
            data = null;
        }
    }

    if (status === 429 || data?.error === 'Limite diário atingido') {
        throw new ApiError(ErrorCodes.RATE_LIMITED, {
            message: 'Limite diário da Vex atingido',
            userMessage: 'Limite diário da API atingido. Tente novamente mais tarde.'
        });
    }

    if (status === 401 || status === 403 || data?.error?.toLowerCase?.().includes('api key inválida')) {
        throw new ApiError(ErrorCodes.AUTH_INVALID, {
            message: 'Api-key da Vex inválida'
        });
    }

    if (status === 404) {
        throw new ApiError(ErrorCodes.UNSUPPORTED, {
            message: 'Endpoint de verificação da Vex não encontrado'
        });
    }

    if (status >= 500) {
        throw new ApiError(ErrorCodes.UPSTREAM, {
            message: 'Vex indisponível',
            details: { status }
        });
    }

    if (status >= 400) {
        throw new ApiError(ErrorCodes.UPSTREAM, {
            message: 'Falha ao verificar a Api-key da Vex',
            recoverable: false,
            details: { status }
        });
    }

    if (data?.error) {
        throw new ApiError(ErrorCodes.UPSTREAM, {
            message: `Vex retornou erro: ${data.error}`,
            details: { status }
        });
    }

    return true;
}

export async function generateBrat(input, options = {}) {
    const config = options.config || loadConfig();
    const settings = getVexSettings(config);

    await checkVexKey({
        config,
        http: options.http
    });

    return {
        ok: true,
        criador: 'Tokyo',
        type: 'image',
        mime: 'image/webp',
        mimetype: 'image/webp',
        query: input.query,
        url: buildBratUrl(input, settings),
        provider: 'vex'
    };
}
