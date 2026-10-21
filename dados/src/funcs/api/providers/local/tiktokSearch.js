/**
 * Provider local de BUSCA textual do TikTok.
 *
 * Situação real verificada em 2026-10-21 (ver `relatorio-inventario-apis.md`):
 *   - `yt-dlp` NÃO tem busca textual do TikTok: `ytsearch` é o extrator do
 *     YouTube e devolve URLs do YouTube (confirmado empiricamente).
 *   - A página pública de busca do TikTok é apenas um "shell": os resultados
 *     chegam por uma requisição assinada (msToken/X-Bogus). Gerar essa
 *     assinatura é burlar controle anti-bot -> não é feito aqui.
 *   - Endpoints públicos gratuitos que existiam (tikwm, tiklydown) hoje
 *     respondem 403/desconhecidos.
 *
 * O provider fica organizado e pronto: se o TikTok voltar a embutir os
 * resultados na página (ou se o dono configurar uma fonte de busca), a
 * busca passa a funcionar sem nenhuma alteração de código.
 *
 * A VexAPI só é usada como fonte alternativa QUANDO o dono configurou
 * site_vex + apikey_vex (nunca como fallback silencioso) e a origem usada
 * é devolvida e registrada em log.
 */

import { getVexSettings } from '../../config.js';
import { hostMatches, isValidHttpUrl } from './ytDlpRunner.js';

export const TIKTOK_SEARCH_MAX_RESULTS = 5;
export const TIKTOK_SEARCH_TIMEOUT_MS = 20000;
export const TIKTOK_SEARCH_MAX_BYTES = 8 * 1024 * 1024;

const TIKTOK_HOSTS = ['tiktok.com'];
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export const TIKTOK_SEARCH_BLOCKED_MESSAGE = 'A busca textual do TikTok não está disponível localmente: a página pública do TikTok exige requisição assinada (anti-bot) e não existe fonte pública sem chave funcionando hoje. Envie um link do TikTok ou configure a api-key da Vex para usar a busca legada.';

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

/**
 * Busca local na página pública do TikTok.
 * @returns {Promise<{ok: boolean, results: Array, msg?: string, etapa?: string}>}
 */
export async function searchTikTokLocal(query, options = {}) {
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    const controller = new AbortController();
    const timer = setTimeout(
        () => controller.abort(),
        Math.max(1, Number(options.timeoutMs) || TIKTOK_SEARCH_TIMEOUT_MS)
    );

    try {
        const resposta = await fetchImpl(
            `https://www.tiktok.com/search?q=${encodeURIComponent(query)}`,
            {
                headers: {
                    'User-Agent': options.userAgent || USER_AGENT,
                    'Accept-Language': 'pt-BR,pt;q=0.9',
                    Accept: 'text/html,application/xhtml+xml'
                },
                signal: controller.signal
            }
        );

        if (!resposta.ok) {
            return { ok: false, msg: `O TikTok respondeu HTTP ${resposta.status} na busca.`, etapa: 'busca' };
        }

        const html = await resposta.text();
        if (html.length > TIKTOK_SEARCH_MAX_BYTES) {
            return { ok: false, msg: 'A resposta da busca do TikTok excedeu o limite aceitável.', etapa: 'busca' };
        }

        const itens = extrairItensDaPagina(html);
        const resultados = dedupeResults(
            itens.map((item) => ({
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

        if (!resultados.length) {
            return { ok: false, msg: TIKTOK_SEARCH_BLOCKED_MESSAGE, etapa: 'busca' };
        }

        return { ok: true, results: resultados, fonte: 'local' };
    } catch (error) {
        const mensagem = error?.name === 'AbortError'
            ? 'A busca no TikTok demorou demais.'
            : `Falha de rede na busca do TikTok: ${error?.message || 'erro desconhecido'}`;
        return { ok: false, msg: mensagem, etapa: 'busca' };
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Busca do TikTok com fonte local e, opcionalmente, a fonte legada da VexAPI
 * (somente quando o dono configurou site_vex + apikey_vex).
 *
 * @param {string} query
 * @param {{fallbackSearch?: Function, config?: object, env?: object}} options
 */
export async function searchTikTok(query, options = {}) {
    const validacao = validateSearchQuery(query);
    if (!validacao.ok) {
        return { ok: false, msg: validacao.msg, etapa: 'validacao', fonte: 'local' };
    }

    const local = await searchTikTokLocal(validacao.query, options);

    if (local.ok) {
        return {
            ok: true,
            results: local.results,
            urls: local.results.map((item) => item.url),
            type: local.results[0]?.type || 'video',
            title: local.results[0]?.title || '',
            fonte: 'local'
        };
    }

    const settings = getVexSettings(options.config || {});
    const fallback = typeof options.fallbackSearch === 'function' ? options.fallbackSearch : null;

    if (fallback && settings.siteVex && settings.apiKey) {
        console.log(`[tiktok:busca] fonte local indisponivel (${local.msg}) -> usando fonte legada da VexAPI (configurada pelo dono)`);
        try {
            const legado = await fallback(validacao.query);
            if (legado?.ok) {
                return {
                    ...legado,
                    results: dedupeResults((legado.urls || []).map((url) => ({ url, title: legado.title || '' })), options.limit),
                    fonte: 'vex'
                };
            }
            return { ok: false, msg: legado?.msg || local.msg, etapa: 'busca', fonte: 'vex' };
        } catch (error) {
            return { ok: false, msg: local.msg, etapa: 'busca', fonte: 'vex' };
        }
    }

    console.log(`[tiktok:busca] fonte local indisponivel: ${local.msg}`);
    return { ok: false, msg: local.msg, etapa: 'busca', fonte: 'local' };
}
