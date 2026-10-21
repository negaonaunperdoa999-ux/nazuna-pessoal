/**
 * SoundCloud Download
 *
 * Implementacao nativa (api-v2 do SoundCloud) com o servico de terceiros
 * (nayan-video-downloader) mantido apenas como fallback de BUSCA.
 *
 * O endpoint /soundcloud desse terceiro passou a responder download_url: null,
 * o que gerava "Invalid URL" no axios. Agora a resolucao do audio e feita
 * direto na API do SoundCloud, sempre com validacao de URL e de conteudo.
 */

import axios from 'axios';
import { mediaClient } from '../../utils/httpClient.js';

const BASE_URL = 'https://nayan-video-downloader.vercel.app';
const SC_PAGES_URL = 'https://soundcloud.com/';
const SC_API_URL = 'https://api-v2.soundcloud.com';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const MIN_AUDIO_BYTES = 1024;

const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000;

export const SOUNDCLOUD_PROVIDER = 'nativo-v2';

let clientIdCache = { value: null, ts: 0 };

function getCached(key) {
    const item = cache.get(key);
    if (!item) return null;
    if (Date.now() - item.ts > CACHE_TTL) {
        cache.delete(key);
        return null;
    }
    return item.val;
}

function setCache(key, val) {
    if (cache.size >= 500) {
        const oldestKey = cache.keys().next().value;
        cache.delete(oldestKey);
    }
    cache.set(key, { val, ts: Date.now() });
}

function isValidHttpUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return false;
    try {
        const url = new URL(value.trim());
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

function httpError(message, etapa = 'desconhecida') {
    console.error(`[soundcloud] FALHA etapa=${etapa} motivo=${message}`);
    return { ok: false, msg: message, etapa, provider: SOUNDCLOUD_PROVIDER };
}

function resolveFetch(options = {}) {
    return options.fetchImpl || globalThis.fetch;
}

function resolveHttp(options = {}) {
    return options.mediaClient || mediaClient;
}

function resolveAxios(options = {}) {
    return options.axios || axios;
}

function trackIdFromUrl(url) {
    if (typeof url !== 'string') return null;
    const parts = url.trim().split('/').filter(Boolean);
    if (!parts.length) return null;
    const last = parts[parts.length - 1].split('?')[0];
    return /^\d+$/.test(last) ? last : null;
}

async function resolveClientId(options = {}) {
    if (Date.now() - clientIdCache.ts < CACHE_TTL && clientIdCache.value) {
        return clientIdCache.value;
    }

    const fetchImpl = resolveFetch(options);
    const headers = { 'User-Agent': USER_AGENT };

    const html = await (await fetchImpl(SC_PAGES_URL, { headers })).text();
    const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((match) => match[1]);

    for (const src of scripts.slice(0, 25)) {
        const url = src.startsWith('http') ? src : `https://soundcloud.com${src}`;
        try {
            const js = await (await fetchImpl(url, { headers })).text();
            const found = js.match(/["']?client_id["']?\s*[:=]\s*["']([0-9a-zA-Z]{20,})["']/);
            if (found) {
                clientIdCache = { value: found[1], ts: Date.now() };
                return clientIdCache.value;
            }
        } catch {
            // tenta o proximo bundle
        }
    }

    throw new Error('Não foi possível obter o client_id do SoundCloud');
}

async function requestJson(url, options = {}) {
    const fetchImpl = resolveFetch(options);
    const response = await fetchImpl(url, {
        headers: { 'User-Agent': USER_AGENT }
    });

    if (!response.ok) {
        throw new Error(`SoundCloud respondeu HTTP ${response.status}`);
    }

    return response.json();
}

async function requestBuffer(url, options = {}) {
    const http = resolveHttp(options);
    const response = await http.get(url, {
        timeout: 120000,
        responseType: 'arraybuffer',
        headers: { 'User-Agent': USER_AGENT }
    });

    return Buffer.from(response.data);
}

function looksLikeAudio(buffer) {
    if (!buffer || buffer.length < 4) return false;
    const head = buffer.subarray(0, 16).toString('latin1');
    if (head.startsWith('ID3')) return true;
    if (head.startsWith('ftyp') || head.startsWith('styp')) return true;
    // ISO BMFF: 4 bytes de tamanho do box antes do tipo
    if (head.slice(4, 8) === 'ftyp' || head.slice(4, 8) === 'styp') return true;
    if (buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0) return true;
    if (buffer[0] === 0x47) return true;
    return false;
}

async function searchNative(query, limit, options = {}) {
    const clientId = await resolveClientId(options);
    const url = `${SC_API_URL}/search/tracks?q=${encodeURIComponent(query)}&client_id=${clientId}&limit=${Math.min(limit, 50)}`;
    const data = await requestJson(url, options);
    const tracks = Array.isArray(data?.collection) ? data.collection : [];

    return tracks.map((track) => ({
        id: track.id,
        title: track.title,
        artist: track.user?.username || track.user?.full_name || '',
        artwork: track.artwork_url || null,
        duration: Math.floor((Number(track.duration) || 0) / 1000),
        permalink_url: track.permalink_url || null,
        playback_count: track.playback_count ?? null,
        likes_count: track.likes_count ?? null,
        genre: track.genre || 'Unknown',
        created_at: track.created_at || null
    }));
}

async function downloadProgressive(transcoding, clientId, options) {
    const info = await requestJson(`${transcoding.url}?client_id=${clientId}`, options);
    if (!isValidHttpUrl(info?.url)) {
        throw new Error('O SoundCloud não retornou uma URL de áudio válida');
    }
    console.log(`[soundcloud] transcoding=progressive url=${safeUrlForLog(info.url)}`);
    return requestBuffer(info.url, options);
}

/** Remove query/segredos antes de registrar a URL. */
function safeUrlForLog(value) {
    try {
        const url = new URL(String(value));
        url.search = '';
        url.username = '';
        url.password = '';
        return url.href;
    } catch {
        return '(url invalida)';
    }
}

function parseHls(playlist, playlistUrl) {
    const init = [];
    const segments = [];

    for (const line of String(playlist).split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith('#EXT-X-MAP:')) {
            const uri = trimmed.match(/URI="([^"]+)"/)?.[1];
            if (uri) init.push(new URL(uri, playlistUrl).href);
            continue;
        }

        if (!trimmed.startsWith('#')) {
            segments.push(new URL(trimmed, playlistUrl).href);
        }
    }

    return { init, segments };
}

async function downloadHls(transcoding, clientId, options) {
    const info = await requestJson(`${transcoding.url}?client_id=${clientId}`, options);
    if (!isValidHttpUrl(info?.url)) {
        throw new Error('O SoundCloud não retornou uma URL de playlist válida');
    }

    const playlist = await (await resolveFetch(options)(info.url, {
        headers: { 'User-Agent': USER_AGENT }
    })).text();

    const { init, segments } = parseHls(playlist, info.url);
    if (!segments.length) {
        throw new Error('A playlist do SoundCloud não trouxe segmentos de áudio');
    }

    const parts = [];

    for (const url of init) {
        parts.push(await requestBuffer(url, options));
    }

    for (const url of segments) {
        parts.push(await requestBuffer(url, options));
    }

    return Buffer.concat(parts);
}

async function resolveTrack(url, clientId, options) {
    const trackId = trackIdFromUrl(url);
    if (trackId) {
        return requestJson(`${SC_API_URL}/tracks/${trackId}?client_id=${clientId}`, options);
    }
    return requestJson(`${SC_API_URL}/resolve?url=${encodeURIComponent(url)}&client_id=${clientId}`, options);
}

async function downloadViaThirdParty(url, options = {}) {
    const response = await resolveAxios(options).get(`${BASE_URL}/soundcloud`, {
        params: { url },
        timeout: 120000
    });

    if (response.data?.status !== 200 || !response.data?.data) {
        throw new Error('O serviço auxiliar do SoundCloud não retornou dados de download');
    }

    const downloadUrl = response.data.data?.download_url;
    if (!isValidHttpUrl(downloadUrl)) {
        throw new Error('O serviço auxiliar do SoundCloud não retornou uma URL de áudio válida');
    }

    console.log(`[soundcloud] fallback=terceiro url=${safeUrlForLog(downloadUrl)}`);
    return requestBuffer(downloadUrl, options);
}

async function downloadNative(url, options = {}) {
    const clientId = await resolveClientId(options);
    const detail = await resolveTrack(url, clientId, options);
    const transcodings = Array.isArray(detail?.media?.transcodings) ? detail.media.transcodings : [];

    console.log(`[soundcloud] faixa resolvida id=${detail?.id ?? '?'} transcodings=${transcodings.length} protocolos=${transcodings.map((item) => item.format?.protocol).join(',') || 'nenhum'}`);

    if (!transcodings.length) {
        throw new Error('Esta faixa do SoundCloud não expõe um stream de áudio');
    }

    const progressive = transcodings.find((item) => item.format?.protocol === 'progressive');
    const hlsMp4 = transcodings.find((item) => item.format?.protocol === 'hls'
        && String(item.format?.mime_type || '').includes('audio/mp4'));

    let buffer = null;
    let container = 'mp3';

    if (progressive) {
        buffer = await downloadProgressive(progressive, clientId, options);
    } else if (hlsMp4) {
        buffer = await downloadHls(hlsMp4, clientId, options);
        container = 'm4a';
    } else {
        throw new Error('O SoundCloud só expôs streams HLS MPEG-TS, incompatíveis com o envio de áudio');
    }

    if (!buffer || buffer.length < MIN_AUDIO_BYTES) {
        throw new Error('O arquivo baixado do SoundCloud veio vazio ou incompleto');
    }

    if (!looksLikeAudio(buffer)) {
        throw new Error('O arquivo baixado do SoundCloud não é um áudio válido');
    }

    console.log(`[soundcloud] audio pronto container=${container} bytes=${buffer.length}`);

    return {
        buffer,
        container,
        title: detail?.title || 'SoundCloud',
        artist: detail?.user?.username || detail?.publisher_metadata?.artist || '',
        thumbnail: detail?.artwork_url || null
    };
}

/**
 * Faz download direto de uma música do SoundCloud via URL
 * @param {string} url - URL do track do SoundCloud
 * @returns {Promise<Object>} Dados do download
 */
async function download(url, options = {}) {
    if (!isValidHttpUrl(url)) {
        return httpError('Link do SoundCloud inválido', 'validacao-url');
    }

    try {
        const cached = getCached(`download:${url}`);
        if (cached) return cached;

        let native = null;
        let etapa = 'resolucao';

        try {
            native = await downloadNative(url, options);
        } catch (nativeError) {
            etapa = 'resolucao-nativa';
            console.error(`[soundcloud] provider nativo falhou: ${nativeError.message} | etapa=${etapa}`);

            // Fallback real: o servico auxiliar (mesmo da busca) pode entregar a URL final.
            native = await downloadViaThirdParty(url, options)
                .then((buffer) => ({ buffer, container: 'mp3', title: '', artist: '', thumbnail: null }))
                .catch((fallbackError) => {
                    throw new Error(`${nativeError.message} | fallback: ${fallbackError.message}`);
                });
        }

        const result = {
            ok: true,
            buffer: native.buffer,
            title: native.title,
            artist: native.artist,
            thumbnail: native.thumbnail,
            filename: `${native.title || 'soundcloud'}.${native.container}`,
            mimetype: native.container === 'm4a' ? 'audio/mp4' : 'audio/mpeg',
            etapa,
            provider: SOUNDCLOUD_PROVIDER
        };

        setCache(`download:${url}`, result);
        return result;
    } catch (error) {
        console.error('[soundcloud] falha no download:', error.message, '| etapa=download | tipo=' + (error.name || 'Error') + ' | http=' + (error.response?.status ?? 'n/d'));

        if (error.response?.status === 404) {
            return httpError('Música não encontrada no SoundCloud');
        }

        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
            return httpError('Timeout ao baixar a música. Tente novamente.');
        }

        return httpError(error.message || 'Erro ao baixar do SoundCloud');
    }
}

/**
 * Busca músicas no SoundCloud
 * @param {string} query - Nome da música ou artista
 * @param {number} limit - Número de resultados
 * @returns {Promise<Object>} Resultados da busca
 */
async function search(query, limit = 10, options = {}) {
    try {
        const cached = getCached(`search:${query}:${limit}`);
        if (cached) return cached;

        let results = [];
        let origem = 'nativo';

        try {
            results = await searchNative(query, limit, options);
            console.log(`[soundcloud] busca nativa ok resultados=${results.length}`);
        } catch (nativeError) {
            console.error(`[soundcloud] busca nativa falhou (${nativeError.message}); usando fallback`);

            const response = await resolveAxios(options).get(`${BASE_URL}/soundcloud-search`, {
                params: { name: query, limit: Math.min(limit, 50) },
                timeout: 120000
            });

            if (response.data?.status !== 200 || !response.data?.results) {
                return httpError('Nenhum resultado encontrado', 'busca');
            }

            origem = 'fallback';
            results = response.data.results.map((track) => ({
                id: track.id,
                title: track.title,
                artist: track.user_id,
                artwork: track.artwork_url,
                duration: Math.floor(track.duration / 1000),
                permalink_url: track.permalink_url,
                playback_count: track.playback_count,
                likes_count: track.likes_count,
                genre: track.genre || 'Unknown',
                created_at: track.created_at
            }));
            console.log(`[soundcloud] busca fallback ok resultados=${results.length}`);
        }

        const result = {
            ok: true,
            query,
            total: results.length,
            origem,
            results,
            provider: SOUNDCLOUD_PROVIDER
        };

        setCache(`search:${query}:${limit}`, result);
        return result;
    } catch (error) {
        console.error(`[soundcloud] falha na busca: ${error.message} | etapa=busca`);
        return httpError('Erro ao buscar no SoundCloud', 'busca');
    }
}

/**
 * Busca e faz download de uma música do SoundCloud
 * @param {string} query - Nome da música ou artista
 * @returns {Promise<Object>} Dados da busca e download
 */
async function searchDownload(query, options = {}) {
    console.log(`[soundcloud] provider=${SOUNDCLOUD_PROVIDER} consulta="${query}"`);

    try {
        const searchResult = await search(query, 1, options);

        if (!searchResult.ok || !searchResult.results?.length) {
            return httpError('Nenhuma música encontrada com esse nome', 'busca');
        }

        const track = searchResult.results[0];
        console.log(`[soundcloud] faixa escolhida="${track.title}" permalink=${safeUrlForLog(track.permalink_url)}`);

        if (!isValidHttpUrl(track.permalink_url)) {
            return httpError('O resultado do SoundCloud não trouxe um link válido', 'selecao');
        }

        const downloadResult = await download(track.permalink_url, options);

        if (!downloadResult.ok) {
            return downloadResult;
        }

        return {
            ok: true,
            buffer: downloadResult.buffer,
            query,
            track: {
                id: track.id,
                title: track.title,
                artist: track.artist,
                artwork: track.artwork,
                duration: track.duration,
                permalink_url: track.permalink_url,
                playback_count: track.playback_count,
                likes_count: track.likes_count,
                genre: track.genre,
                created_at: track.created_at
            },
            title: downloadResult.title,
            artist: downloadResult.artist,
            thumbnail: downloadResult.thumbnail,
            filename: downloadResult.filename,
            mimetype: downloadResult.mimetype,
            etapa: downloadResult.etapa ?? null,
            provider: downloadResult.provider ?? SOUNDCLOUD_PROVIDER,
            origem: searchResult.origem ?? null
        };
    } catch (error) {
        console.error('Erro na busca/download do SoundCloud:', error.message);
        return httpError(error.message || 'Erro ao buscar no SoundCloud');
    }
}

export default {
    download,
    search,
    searchDownload
};
