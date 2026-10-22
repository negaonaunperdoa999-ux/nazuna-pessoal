import { hostMatches, isValidHttpUrl } from './ytDlpRunner.js';

export const PINTEREST_SEARCH_MAX_RESULTS = 24;
export const PINTEREST_SEARCH_TIMEOUT_MS = 20000;
export const PINTEREST_SEARCH_MAX_BYTES = 8 * 1024 * 1024;
export const PINTEREST_SEARCH_MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

export const PINTEREST_SEARCH_UNAVAILABLE_MESSAGE = 'A busca textual do Pinterest não retornou resultados acessíveis localmente para este termo. Envie o link de um pin específico do Pinterest.';

const PINTEREST_MEDIA_HOSTS = ['pinimg.com'];

export function validatePinterestQuery(query) {
    const text = String(query ?? '').trim();
    if (!text) {
        return { ok: false, msg: 'Digite um termo para pesquisar no Pinterest.' };
    }
    if (text.length > 120) {
        return { ok: false, msg: 'O termo de busca é longo demais (máximo de 120 caracteres).' };
    }
    return { ok: true, query: text };
}

function parseScriptJson(html, id) {
    const pattern = new RegExp(`<script[^>]+id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/script>`, 'i');
    const match = String(html || '').match(pattern);
    if (!match) return null;
    try {
        return JSON.parse(match[1]);
    } catch {
        return null;
    }
}

function hasRelevanceSignal(entry) {
    const data = entry?.data;
    if (!data || typeof data !== 'object') return false;
    if (Array.isArray(data.rankedGuides) && data.rankedGuides.length > 0) return true;
    if (Array.isArray(data.queryL1VerticalIds) && data.queryL1VerticalIds.length > 0) return true;
    return Array.isArray(data.oneBarModules) && data.oneBarModules.length > 1;
}

function imageUrlFromResult(result) {
    const images = result?.images;
    if (!images || typeof images !== 'object') return null;
    for (const key of ['orig', '736x', '474x', '236x']) {
        const candidate = String(images[key]?.url || '').trim();
        if (isValidHttpUrl(candidate) && hostMatches(candidate, PINTEREST_MEDIA_HOSTS)) {
            return {
                url: candidate,
                width: Number(images[key]?.width) || 0,
                height: Number(images[key]?.height) || 0
            };
        }
    }
    return null;
}

export function extractPinterestSearchResults(html, limit = PINTEREST_SEARCH_MAX_RESULTS) {
    const data = parseScriptJson(html, '__PWS_INITIAL_PROPS__');
    const resources = data?.initialReduxState?.resources?.BaseSearchResource;
    if (!resources || typeof resources !== 'object') {
        return { ok: false, code: 'no_results', msg: PINTEREST_SEARCH_UNAVAILABLE_MESSAGE };
    }

    const entries = Object.values(resources);
    if (!entries.some(hasRelevanceSignal)) {
        return { ok: false, code: 'no_results', msg: PINTEREST_SEARCH_UNAVAILABLE_MESSAGE };
    }

    const max = Math.max(1, Math.min(Number(limit) || PINTEREST_SEARCH_MAX_RESULTS, PINTEREST_SEARCH_MAX_RESULTS));
    const vistos = new Set();
    const results = [];

    for (const entry of entries) {
        if (!hasRelevanceSignal(entry)) continue;
        const rawResults = entry?.data?.results;
        if (!Array.isArray(rawResults)) continue;

        for (const raw of rawResults) {
            const image = imageUrlFromResult(raw);
            if (!image) continue;
            const id = String(raw?.image_signature || raw?.id || image.url);
            if (vistos.has(id)) continue;
            vistos.add(id);
            results.push({ id, ...image });
            if (results.length >= max) break;
        }
        if (results.length >= max) break;
    }

    if (!results.length) {
        return { ok: false, code: 'no_results', msg: PINTEREST_SEARCH_UNAVAILABLE_MESSAGE };
    }

    return { ok: true, results };
}

export async function searchPinterestLocal(query, options = {}) {
    const validation = validatePinterestQuery(query);
    if (!validation.ok) {
        return { ok: false, code: 'validation', etapa: 'validacao', msg: validation.msg };
    }

    const fetchImpl = options.fetchImpl || globalThis.fetch;
    if (typeof fetchImpl !== 'function') {
        return { ok: false, code: 'fetch_unavailable', etapa: 'busca', msg: 'Não foi possível consultar o Pinterest neste ambiente.' };
    }

    const timeoutMs = Math.max(1, Number(options.timeoutMs) || PINTEREST_SEARCH_TIMEOUT_MS);
    const maxBytes = Math.max(1, Number(options.maxBytes) || PINTEREST_SEARCH_MAX_BYTES);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetchImpl(
            `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(validation.query)}`,
            {
                redirect: 'follow',
                signal: controller.signal,
                headers: {
                    'user-agent': options.userAgent || PINTEREST_SEARCH_MOBILE_UA,
                    'accept-language': 'pt-BR,pt;q=0.9',
                    accept: 'text/html,application/xhtml+xml'
                }
            }
        );

        const status = Number(response?.status) || 0;
        if (response?.ok === false || status >= 400) {
            return { ok: false, code: 'http_error', etapa: 'busca', msg: `O Pinterest respondeu HTTP ${status || 'desconhecido'} na busca. ${PINTEREST_SEARCH_UNAVAILABLE_MESSAGE}` };
        }

        const html = String(await response.text() || '');
        if (Buffer.byteLength(html) > maxBytes) {
            return { ok: false, code: 'too_large', etapa: 'busca', msg: 'A resposta da busca do Pinterest excedeu o limite aceitável.' };
        }

        const extracted = extractPinterestSearchResults(html, options.limit);
        if (!extracted.ok) {
            return { ok: false, code: extracted.code, etapa: 'busca', msg: extracted.msg };
        }

        return {
            ok: true,
            query: validation.query,
            results: extracted.results,
            count: extracted.results.length,
            fonte: 'local'
        };
    } catch (error) {
        const mensagem = error?.name === 'AbortError'
            ? 'A busca no Pinterest demorou demais.'
            : `Falha de rede na busca do Pinterest: ${error?.message || 'erro desconhecido'}`;
        return { ok: false, code: 'network', etapa: 'busca', msg: mensagem };
    } finally {
        clearTimeout(timer);
    }
}
