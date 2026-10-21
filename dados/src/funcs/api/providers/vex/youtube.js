import { ApiError, ErrorCodes } from '../../errors.js';
import { getVexSettings, loadConfig } from '../../config.js';
import { createHttpClient } from '../../http.js';
import { checkVexKey as defaultCheckVexKey } from '../vex.js';

let defaultHttpClient;

function getHttpClient() {
    if (!defaultHttpClient) {
        defaultHttpClient = createHttpClient({
            timeoutMs: 15000,
            maxBytes: 2 * 1024 * 1024
        });
    }
    return defaultHttpClient;
}

function resolveSettings(options = {}) {
    const config = options.config || loadConfig();
    const settings = getVexSettings(config);

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

    return { config, settings };
}

export function buildSearchUrl(query, settings) {
    return `${settings.siteVex}/api/pesquisa/youtube?apikey=${encodeURIComponent(settings.apiKey)}&query=${encodeURIComponent(query)}`;
}

export function buildDownloadUrl(kind, url, settings) {
    const endpoint = kind === 'audio' ? 'youtubemp3' : 'youtubemp4';
    return `${settings.siteVex}/api/downloads/${endpoint}?apikey=${encodeURIComponent(settings.apiKey)}&query=${encodeURIComponent(url)}`;
}

function throwVexError(data) {
    const message = String(data?.error || '').trim();
    if (!message) return;

    if (/limite/i.test(message)) {
        throw new ApiError(ErrorCodes.RATE_LIMITED, {
            message: 'Limite diário da Vex atingido',
            userMessage: 'Limite diário da API atingido. Tente novamente mais tarde.'
        });
    }

    if (/api.?key/i.test(message)) {
        throw new ApiError(ErrorCodes.AUTH_INVALID, {
            message: 'Api-key da Vex inválida'
        });
    }

    throw new ApiError(ErrorCodes.UPSTREAM, {
        message: `Vex retornou erro: ${message}`,
        userMessage: `⚠️ ${message}`
    });
}

async function requestData(http, url, options = {}) {
    const response = await http.getJson(url, {
        signal: options.signal,
        timeoutMs: options.timeoutMs,
        maxBytes: 2 * 1024 * 1024
    });
    return response.data;
}

async function verifyKey(options, config, http) {
    const verify = options.verifyKey || defaultCheckVexKey;
    await verify({
        config,
        http,
        signal: options.signal
    });
}

function normalizeVideo(video) {
    const videoId = String(video?.videoId || '').trim();
    const url = String(video?.url || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : ''));
    const seconds = Math.max(0, Number(video?.seconds ?? video?.duration ?? 0) || 0);
    const thumbnail = typeof video?.thumbnail === 'string'
        ? video.thumbnail
        : String(video?.thumbnail?.url || '');

    return {
        videoId,
        url,
        title: String(video?.title || 'Vídeo do YouTube'),
        author: typeof video?.author === 'string' ? video.author : String(video?.author?.name || ''),
        seconds,
        durationSeconds: seconds,
        timestamp: String(video?.timestamp || ''),
        views: video?.views ?? null,
        ago: String(video?.ago || ''),
        description: String(video?.description || ''),
        thumbnail
    };
}

function normalizeMediaResponse(response) {
    const seconds = Math.max(0, Number(
        response?.seconds ?? response?.duration ?? response?.durationSeconds ?? 0
    ) || 0);
    const thumbnail = typeof response?.thumbnail === 'string'
        ? response.thumbnail
        : String(response?.thumbnail?.url || '');

    return {
        videoId: String(response?.videoId || ''),
        url: String(response?.url || ''),
        title: String(response?.title || ''),
        author: typeof response?.author === 'string' ? response.author : String(response?.author?.name || ''),
        seconds,
        durationSeconds: seconds,
        timestamp: String(response?.timestamp || ''),
        views: response?.views ?? null,
        ago: String(response?.ago || ''),
        description: String(response?.description || ''),
        thumbnail
    };
}

function safeFileName(title, extension) {
    const base = String(title || 'media')
        .replace(/[^\p{L}\p{N}\s_-]/gu, '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 80) || 'media';
    return `${base}${extension}`;
}

export async function searchYoutube(query, options = {}) {
    const { config, settings } = resolveSettings(options);
    const http = options.http || getHttpClient();
    await verifyKey(options, config, http);

    const data = await requestData(http, buildSearchUrl(query, settings), options);
    throwVexError(data);

    if (!data?.status) {
        throw new ApiError(ErrorCodes.UPSTREAM, {
            message: 'Erro ao buscar vídeo na Vex',
            userMessage: 'Não foi possível buscar o vídeo no YouTube.'
        });
    }

    const results = Array.isArray(data.results) ? data.results : [];
    if (!results.length) {
        throw new ApiError(ErrorCodes.UNSUPPORTED, {
            message: 'Nenhum vídeo encontrado',
            userMessage: 'Nenhum vídeo encontrado',
            recoverable: false
        });
    }

    return normalizeVideo(results[0]);
}

async function prepareMedia(kind, input, options = {}) {
    const { config, settings } = resolveSettings(options);
    const http = options.http || getHttpClient();
    await verifyKey(options, config, http);

    const data = await requestData(http, buildDownloadUrl(kind, input.url, settings), options);
    throwVexError(data);

    const response = data?.resposta;
    if (!response?.dlurl) {
        throw new ApiError(ErrorCodes.UPSTREAM, {
            message: 'URL de download não encontrada',
            userMessage: 'O provedor não retornou uma mídia válida.'
        });
    }

    const extension = kind === 'audio' ? '.mp3' : '.mp4';
    return {
        remoteUrl: String(response.dlurl),
        meta: normalizeMediaResponse(response),
        mimetype: kind === 'audio' ? 'audio/mpeg' : 'video/mp4',
        extension,
        fileName: safeFileName(response.title, extension)
    };
}

export async function prepareAudio(input, options = {}) {
    return prepareMedia('audio', input, options);
}

export async function prepareVideo(input, options = {}) {
    return prepareMedia('video', input, options);
}
