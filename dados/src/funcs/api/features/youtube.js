import { BoundedCache } from '../cache.js';
import { ConcurrencyLimiter } from '../limiter.js';
import { ApiError, ErrorCodes, inputError, toApiError } from '../errors.js';
import { getYoutubeSettings, loadConfig } from '../config.js';
import {
    getYoutubeProvider,
    normalizeProvider,
    resolveYoutubeProviderChain,
    shouldFallback
} from '../policy.js';
import { createMediaSource, downloadToTemp } from '../media.js';
import { searchYoutube as vexSearch, prepareAudio as vexAudio, prepareVideo as vexVideo } from '../providers/vex/youtube.js';
import { searchYoutube as localSearch, prepareAudio as localAudio, prepareVideo as localVideo } from '../providers/local/youtube.js';

export const YOUTUBE_MAX_DURATION_SECONDS = 1800;

export const defaultYoutubeSearchCache = new BoundedCache({
    maxEntries: 200,
    maxBytes: 2 * 1024 * 1024,
    maxItemBytes: 64 * 1024,
    ttlMs: 5 * 60 * 1000
});

export const defaultYoutubeLimiter = new ConcurrencyLimiter({
    maxConcurrent: 2,
    maxQueue: 20
});

const defaultProviders = {
    local: {
        search: localSearch,
        audio: localAudio,
        video: localVideo
    },
    vex: {
        search: vexSearch,
        audio: vexAudio,
        video: vexVideo
    }
};

export function formatDuration(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const remaining = total % 60;

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
    }

    return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

function extractYoutubeId(url) {
    const parts = url.pathname.split('/').filter(Boolean);

    if (url.hostname === 'youtu.be' || url.hostname.endsWith('.youtu.be')) {
        return parts[0] || '';
    }

    if (url.pathname === '/watch') {
        return url.searchParams.get('v') || '';
    }

    if (['shorts', 'embed', 'live', 'v'].includes(parts[0])) {
        return parts[1] || '';
    }

    return '';
}

export function normalizeYoutubeInput(input) {
    const raw = typeof input === 'string'
        ? input
        : input?.url || input?.query || '';
    const text = String(raw).trim();

    if (!text) {
        throw inputError('Digite o nome do vídeo ou um link do YouTube.');
    }

    const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text);
    const hasSpace = /\s/.test(text);
    const mentionsYoutube = /(?:youtube\.com|youtu\.be)/i.test(text);

    if (!hasScheme && (hasSpace || !mentionsYoutube)) {
        return {
            kind: 'query',
            query: text
        };
    }

    let url;
    try {
        url = new URL(hasScheme ? text : `https://${text}`);
    } catch {
        throw inputError('O link do YouTube é inválido.');
    }

    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    const allowedHost = hostname === 'youtube.com'
        || hostname.endsWith('.youtube.com')
        || hostname === 'youtu.be'
        || hostname.endsWith('.youtu.be');

    if (!allowedHost || !['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
        throw inputError('Envie um link válido do YouTube.');
    }

    if (url.port && url.port !== '80' && url.port !== '443') {
        throw inputError('Envie um link válido do YouTube.');
    }

    const videoId = extractYoutubeId(url);
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
        throw inputError('Envie um link de vídeo válido do YouTube.');
    }

    return {
        kind: 'url',
        url: `https://www.youtube.com/watch?v=${videoId}`,
        originalUrl: text,
        videoId
    };
}

export function normalizeYoutubeSearchData(raw) {
    const source = Array.isArray(raw)
        ? raw[0]
        : Array.isArray(raw?.results)
            ? raw.results[0]
            : raw?.video || raw;

    if (!source || typeof source !== 'object') {
        throw new ApiError(ErrorCodes.UNSUPPORTED, {
            message: 'Resultado de busca vazio',
            userMessage: 'Nenhum vídeo encontrado',
            recoverable: false
        });
    }

    let parsedUrl = null;
    if (source.url) {
        try {
            parsedUrl = normalizeYoutubeInput(source.url);
        } catch {
            parsedUrl = null;
        }
    }

    const sourceVideoId = String(source.videoId || '').trim();
    const videoId = parsedUrl?.videoId || sourceVideoId;
    const url = parsedUrl?.url || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : '');

    if (!url || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
        throw new ApiError(ErrorCodes.UPSTREAM, {
            message: 'Resultado de busca sem vídeo válido',
            userMessage: 'O provedor retornou um resultado de busca inválido.',
            recoverable: true
        });
    }

    const author = typeof source.author === 'string'
        ? source.author
        : String(source.author?.name || '');
    const rawSeconds = source.durationSeconds
        ?? source.seconds
        ?? source.duration?.seconds
        ?? source.duration
        ?? 0;
    const seconds = Math.max(0, Number(rawSeconds) || 0);
    const description = String(source.description || '');
    const thumbnail = typeof source.thumbnail === 'string'
        ? source.thumbnail
        : String(source.thumbnail?.url || source.thumbnailUrl || '');
    const views = source.views ?? source.viewCount ?? null;
    const ago = String(source.ago || source.publishedTime || '');

    return {
        videoId,
        url,
        title: String(source.title || 'Vídeo do YouTube'),
        author,
        seconds,
        durationSeconds: seconds,
        timestamp: String(source.timestamp || (seconds > 0 ? formatDuration(seconds) : '')),
        views,
        ago,
        description,
        thumbnail
    };
}

export function normalizeYoutubeMediaMeta(raw = {}) {
    const seconds = Math.max(0, Number(
        raw.durationSeconds ?? raw.seconds ?? raw.duration?.seconds ?? raw.duration ?? 0
    ) || 0);

    return {
        videoId: String(raw.videoId || ''),
        url: String(raw.url || ''),
        title: String(raw.title || ''),
        author: typeof raw.author === 'string' ? raw.author : String(raw.author?.name || ''),
        durationSeconds: seconds,
        timestamp: String(raw.timestamp || (seconds > 0 ? formatDuration(seconds) : '')),
        views: raw.views ?? raw.viewCount ?? null,
        ago: String(raw.ago || raw.publishedTime || ''),
        description: String(raw.description || ''),
        thumbnail: typeof raw.thumbnail === 'string'
            ? raw.thumbnail
            : String(raw.thumbnail?.url || raw.thumbnailUrl || '')
    };
}

function mergeMetadata(base = {}, extra = {}) {
    const merged = { ...base };

    for (const [key, value] of Object.entries(extra)) {
        const missing = value === undefined
            || value === null
            || value === ''
            || (key === 'durationSeconds' && Number(value) <= 0);

        if (!missing) merged[key] = value;
    }

    if (!merged.durationSeconds && base.durationSeconds) {
        merged.durationSeconds = base.durationSeconds;
    }
    if (!merged.timestamp && merged.durationSeconds > 0) {
        merged.timestamp = formatDuration(merged.durationSeconds);
    }

    return merged;
}

export function assertYoutubeDuration(meta, maxDurationSeconds) {
    const limit = Number(maxDurationSeconds);
    if (!Number.isFinite(limit) || limit <= 0) return;

    const seconds = Number(meta?.durationSeconds);
    if (!Number.isFinite(seconds) || seconds <= limit) return;

    const timestamp = meta?.timestamp || formatDuration(seconds);
    throw new ApiError(ErrorCodes.INPUT_INVALID, {
        message: `Vídeo acima do limite de duração: ${seconds}s`,
        userMessage: `⚠️ Este vídeo é muito longo (${timestamp}).\nPor favor, escolha um vídeo com menos de ${Math.ceil(limit / 60)} minutos.`,
        recoverable: false
    });
}

export function safeMediaFileName(title, extension) {
    const normalizedExtension = String(extension || '.bin').startsWith('.')
        ? String(extension || '.bin')
        : `.${extension}`;
    const base = String(title || 'media')
        .replace(/[^\p{L}\p{N}\s_-]/gu, '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 80) || 'media';

    return `${base}${normalizedExtension}`;
}

function resolveProviders(overrides = {}) {
    return {
        local: {
            ...defaultProviders.local,
            ...(overrides.local || {})
        },
        vex: {
            ...defaultProviders.vex,
            ...(overrides.vex || {})
        }
    };
}

function getProviderImplementation(providers, name, method) {
    const implementation = providers?.[name]?.[method];
    if (typeof implementation !== 'function') {
        throw new ApiError(ErrorCodes.UNSUPPORTED, {
            message: `Provedor ${name} sem ${method}`,
            userMessage: 'Este provedor de YouTube não está disponível.',
            recoverable: true
        });
    }
    return implementation;
}

function resolveRuntime(options = {}) {
    const config = options.config || loadConfig();
    const settings = getYoutubeSettings(config, options.env);
    const provider = options.provider
        ? normalizeProvider(options.provider)
        : getYoutubeProvider(config, options.env);

    return {
        config,
        settings,
        provider,
        chain: resolveYoutubeProviderChain(provider, {
            allowVexFallback: settings.allowVexFallback
        }),
        providers: resolveProviders(options.providers),
        cache: options.cache || defaultYoutubeSearchCache,
        limiter: options.limiter || defaultYoutubeLimiter
    };
}

function searchCacheKey(provider, query) {
    return JSON.stringify([provider, query]);
}

function annotateFallback(error, usedFallback) {
    if (!usedFallback || !error) return error;

    const prefix = '[fallback VexAPI] ';
    const userMessage = String(error.userMessage || '');
    if (!userMessage || userMessage.startsWith(prefix)) return error;

    return new ApiError(error.code || ErrorCodes.UPSTREAM, {
        message: error.message,
        userMessage: prefix + userMessage,
        recoverable: error.recoverable,
        details: error.details || null,
        cause: error
    });
}

export async function runYoutubeSearch(input, options = {}) {
    const normalized = normalizeYoutubeInput(input);
    if (normalized.kind !== 'query') {
        throw inputError('A pesquisa do YouTube espera um nome ou termo de busca.');
    }

    const runtime = resolveRuntime(options);
    let lastError;
    let usedFallback = false;

    for (let index = 0; index < runtime.chain.length; index++) {
        const providerName = runtime.chain[index];
        const cacheKey = searchCacheKey(providerName, normalized.query);
        const cached = runtime.cache.get(cacheKey);

        if (cached) {
            assertYoutubeDuration(cached, options.maxDurationSeconds);
            return {
                ok: true,
                data: cached,
                provider: providerName,
                cached: true
            };
        }

        try {
            const implementation = getProviderImplementation(runtime.providers, providerName, 'search');
            const raw = await runtime.limiter.run(() => implementation(normalized.query, {
                config: runtime.config,
                env: options.env,
                http: options.http,
                signal: options.signal,
                timeoutMs: options.searchTimeoutMs ?? runtime.settings.searchTimeoutMs
            }));
            const data = normalizeYoutubeSearchData(raw);
            assertYoutubeDuration(data, options.maxDurationSeconds);
            runtime.cache.set(cacheKey, data);

            return {
                ok: true,
                data,
                provider: providerName,
                cached: false
            };
        } catch (error) {
            const normalizedError = toApiError(error);
            lastError = normalizedError;

            if (!shouldFallback(runtime.provider, normalizedError, index, runtime.chain)) {
                break;
            }

            usedFallback = true;
            console.log(`[youtube:busca] provider=${providerName} falhou (${normalizedError.message}); usando ${runtime.chain[index + 1]}`);
        }
    }

    throw annotateFallback(
        lastError || new ApiError(ErrorCodes.INTERNAL, {
            message: 'Nenhum provedor de busca do YouTube disponível'
        }),
        usedFallback
    );
}

async function prepareAndDownload(kind, input, options) {
    const normalized = normalizeYoutubeInput(input);
    const runtime = resolveRuntime(options);
    let search = null;
    let mediaUrl = normalized.kind === 'url' ? normalized.url : '';
    let videoId = normalized.kind === 'url' ? normalized.videoId : '';

    if (normalized.kind === 'query') {
        search = await runYoutubeSearch({ query: normalized.query }, {
            ...options,
            provider: runtime.provider,
            config: runtime.config,
            providers: options.providers
        });
        mediaUrl = search.data.url;
        videoId = search.data.videoId;
        assertYoutubeDuration(search.data, options.maxDurationSeconds);
    }

    let lastError;
    let usedFallback = false;
    for (let index = 0; index < runtime.chain.length; index++) {
        const providerName = runtime.chain[index];
        let prepared;

        try {
            const implementation = getProviderImplementation(runtime.providers, providerName, kind);
            prepared = await runtime.limiter.run(() => implementation({
                url: mediaUrl,
                videoId,
                meta: search?.data || null
            }, {
                config: runtime.config,
                env: options.env,
                http: options.http,
                signal: options.signal,
                timeoutMs: options.searchTimeoutMs ?? runtime.settings.searchTimeoutMs,
                maxBytes: options.maxBytes,
                ytdlpTimeoutMs: options.ytdlpTimeoutMs,
                ytdlpTempDir: options.tempDir,
                verifyKey: options.verifyKey
            }));

            if (!prepared?.remoteUrl && !prepared?.filePath) {
                throw new ApiError(ErrorCodes.UPSTREAM, {
                    message: `Provedor ${providerName} não retornou URL de mídia`,
                    userMessage: 'O provedor não retornou uma mídia válida.',
                    recoverable: true
                });
            }
        } catch (error) {
            const normalizedError = toApiError(error);
            lastError = normalizedError;

            if (!shouldFallback(runtime.provider, normalizedError, index, runtime.chain)) {
                break;
            }

            usedFallback = true;
            console.log(`[youtube:midia] provider=${providerName} falhou (${normalizedError.message}); usando ${runtime.chain[index + 1]}`);
            continue;
        }

        const extension = prepared.extension || (kind === 'audio' ? '.mp3' : '.mp4');
        const mimetype = prepared.mimetype || (kind === 'audio' ? 'audio/mpeg' : 'video/mp4');
        const mediaMeta = normalizeYoutubeMediaMeta({
            ...(search?.data || {}),
            ...(prepared.meta || {})
        });
        const meta = mergeMetadata(search?.data || {}, mediaMeta);
        assertYoutubeDuration(meta, options.maxDurationSeconds);

        try {
            let filePath = prepared.filePath;
            let sizeBytes = Number(prepared.sizeBytes || 0);
            const cleanupPaths = Array.isArray(prepared.cleanupPaths) ? prepared.cleanupPaths : [];

            if (!filePath) {
                const download = options.download || downloadToTemp;
                const downloaded = await runtime.limiter.run(() => download({
                    url: prepared.remoteUrl,
                    headers: prepared.headers,
                    extension,
                    maxBytes: options.maxBytes ?? (kind === 'audio'
                        ? runtime.settings.maxAudioBytes
                        : runtime.settings.maxVideoBytes),
                    timeoutMs: options.mediaTimeoutMs ?? runtime.settings.mediaTimeoutMs,
                    maxRedirects: options.maxRedirects ?? runtime.settings.maxRedirects,
                    tempDir: options.tempDir,
                    signal: options.signal
                }));
                filePath = downloaded.filePath;
                sizeBytes = downloaded.sizeBytes;
            }

            const fileName = prepared.fileName || safeMediaFileName(meta.title, extension);
            const media = createMediaSource({
                filePath,
                sizeBytes,
                meta,
                mimetype,
                fileName,
                cleanupPaths
            });

            return {
                ok: true,
                provider: providerName,
                media,
                meta,
                search: search?.data || null
            };
        } catch (error) {
            throw toApiError(error);
        }
    }

    throw annotateFallback(
        lastError || new ApiError(ErrorCodes.INTERNAL, {
            message: 'Nenhum provedor de YouTube disponível'
        }),
        usedFallback
    );
}

export async function runYoutubeAudio(input, options = {}) {
    return prepareAndDownload('audio', input, options);
}

export async function runYoutubeVideo(input, options = {}) {
    return prepareAndDownload('video', input, options);
}
