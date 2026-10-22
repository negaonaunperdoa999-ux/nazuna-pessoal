import { hostMatches, isValidHttpUrl } from './ytDlpRunner.js';

export const TIKTOK_SEARCH_MAX_RESULTS = 5;
export const TIKTOK_SEARCH_TIMEOUT_MS = 20000;
export const TIKTOK_SEARCH_MAX_BYTES = 8 * 1024 * 1024;

const TIKTOK_HOSTS = ['tiktok.com'];
const USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

export const TIKTOK_SEARCH_BLOCKED_MESSAGE = 'A busca textual do TikTok não retornou vídeos acessíveis localmente para este termo. A busca completa exige requisição assinada; a página pública de descoberta só entrega resultados para alguns termos. Envie um link do TikTok.';

export function validateSearchQuery(query) {
    const text = String(query ?? '').trim();
    if (!text) {
        return { ok: false, msg: 'Digite um termo para pesquisar no TikTok.' };
    }
    if (text.length > 120) {
        return { ok: false, msg: 'O termo de busca é longo demais (máximo de 120 caracteres).' };
    }
    return { ok: true, query: text };
}

export function normalizeSearchResult(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const url = String(raw.url || '').trim();
    if (!isValidHttpUrl(url) || !hostMatches(url, TIKTOK_HOSTS)) return null;

    const videoId = String(raw.videoId || (url.match(/\/video\/(\d+)/)?.[1] || '')).trim();
    if (!/^\d{5,}$/.test(videoId)) return null;

    const title = String(raw.title || '').trim();
    const author = String(raw.author || '').trim();

    return {
        videoId,
        url,
        title: title.slice(0, 160),
        author: author.slice(0, 80),
        type: raw.type === 'audio' ? 'audio' : 'video'
    };
}

export function dedupeResults(results, limit = TIKTOK_SEARCH_MAX_RESULTS) {
    const vistos = new Set();
    const saida = [];

    for (const item of Array.isArray(results) ? results : []) {
        const normalizado = normalizeSearchResult(item);
        if (!normalizado) continue;
        if (vistos.has(normalizado.videoId)) continue;
        vistos.add(normalizado.videoId);
        saida.push(normalizado);
        if (saida.length >= limit) break;
    }

    return saida;
}

function decodeHtmlEntities(value) {
    return String(value)
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&#x27;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>');
}

function extractAttribute(tag, name) {
    const match = String(tag || '').match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'));
    return match ? decodeHtmlEntities(match[1]) : '';
}

export function extractTikTokDiscoverResults(html, limit = TIKTOK_SEARCH_MAX_RESULTS) {
    const blocks = String(html || '').split(/data-e2e=["']video-item["']/i).slice(1);
    const encontrados = [];

    for (const block of blocks) {
        const id = block.match(/(?:aweme%2Fdetail%2F|aweme\/detail\/|\/video\/)(\d{5,})/i)?.[1];
        if (!id) continue;

        const imgTag = block.match(/<img\b[^>]*>/i)?.[0] || '';
        const alt = extractAttribute(imgTag, 'alt');
        const author = alt.match(/\(@([^)]+)\)/)?.[1]?.trim() || '';
        if (!author) continue;

        let title = alt.replace(/^[\s\S]*?\(@[^)]+\):\s*/i, '').trim();
        title = title.replace(/^["“]|["”]$/g, '').trim();

        encontrados.push({
            videoId: id,
            url: `https://www.tiktok.com/@${author}/video/${id}`,
            title,
            author,
            type: 'video'
        });
    }

    return dedupeResults(encontrados, limit);
}

function extrairItensDaPagina(html) {
    const bloco = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
    if (!bloco) return [];

    let data;
    try {
        data = JSON.parse(bloco[1]);
    } catch {
        return [];
    }

    const encontrados = [];

    const visitar = (node, profundidade = 0) => {
        if (profundidade > 8 || !node || typeof node !== 'object') return;
        if (Array.isArray(node)) {
            for (const item of node) visitar(item, profundidade + 1);
            return;
        }
        for (const valor of Object.values(node)) {
            if (Array.isArray(valor) && valor.length
                && typeof valor[0] === 'object' && valor[0] !== null
                && ('id' in valor[0]) && ('author' in valor[0])) {
                encontrados.push(...valor);
            }
            visitar(valor, profundidade + 1);
        }
    };

    visitar(data);
    return encontrados;
}

export async function searchTikTokLocal(query, options = {}) {
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    if (typeof fetchImpl !== 'function') {
        return { ok: false, msg: 'Não foi possível consultar o TikTok neste ambiente.', etapa: 'busca' };
    }

    const controller = new AbortController();
    const timer = setTimeout(
        () => controller.abort(),
        Math.max(1, Number(options.timeoutMs) || TIKTOK_SEARCH_TIMEOUT_MS)
    );

    try {
        const resposta = await fetchImpl(
            `https://www.tiktok.com/discover/${encodeURIComponent(query)}`,
            {
                redirect: 'follow',
                headers: {
                    'User-Agent': options.userAgent || USER_AGENT,
                    'Accept-Language': 'pt-BR,pt;q=0.9',
                    Accept: 'text/html,application/xhtml+xml'
                },
                signal: controller.signal
            }
        );

        if (resposta.ok === false || Number(resposta.status) >= 400) {
            return { ok: false, msg: `O TikTok respondeu HTTP ${resposta.status} na busca.`, etapa: 'busca' };
        }

        const html = await resposta.text();
        if (html.length > TIKTOK_SEARCH_MAX_BYTES) {
            return { ok: false, msg: 'A resposta da busca do TikTok excedeu o limite aceitável.', etapa: 'busca' };
        }

        const descoberta = extractTikTokDiscoverResults(html, options.limit);
        const itens = descoberta.length
            ? descoberta
            : dedupeResults(
                extrairItensDaPagina(html).map((item) => ({
                    videoId: item?.id,
                    title: item?.desc || item?.title || '',
                    author: item?.author?.uniqueId || item?.author?.nickname || '',
                    url: item?.author?.uniqueId && item?.id
                        ? `https://www.tiktok.com/@${item.author.uniqueId}/video/${item.id}`
                        : '',
                    type: item?.music?.original ? 'audio' : 'video'
                })),
                options.limit
            );

        if (!itens.length) {
            return { ok: false, msg: TIKTOK_SEARCH_BLOCKED_MESSAGE, etapa: 'busca' };
        }

        return { ok: true, results: itens, fonte: 'local' };
    } catch (error) {
        const mensagem = error?.name === 'AbortError'
            ? 'A busca no TikTok demorou demais.'
            : `Falha de rede na busca do TikTok: ${error?.message || 'erro desconhecido'}`;
        return { ok: false, msg: mensagem, etapa: 'busca' };
    } finally {
        clearTimeout(timer);
    }
}

export async function searchTikTok(query, options = {}) {
    const validacao = validateSearchQuery(query);
    if (!validacao.ok) {
        return { ok: false, msg: validacao.msg, etapa: 'validacao', fonte: 'local' };
    }

    const local = await searchTikTokLocal(validacao.query, options);

    if (!local.ok) {
        return { ok: false, msg: local.msg, etapa: local.etapa || 'busca', fonte: 'local' };
    }

    return {
        ok: true,
        results: local.results,
        urls: local.results.map((item) => item.url),
        type: local.results[0]?.type || 'video',
        title: local.results[0]?.title || '',
        fonte: 'local'
    };
}
