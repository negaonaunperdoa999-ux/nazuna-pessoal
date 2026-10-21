import fs from 'node:fs';

const DEFAULT_CONFIG_URL = new URL('../../config.json', import.meta.url);

export function loadConfig(options = {}) {
    const configUrl = options.configPath || DEFAULT_CONFIG_URL;
    const fsImpl = options.fs || fs;

    try {
        const raw = fsImpl.readFileSync(configUrl, 'utf8');
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

export function getVexSettings(config = {}) {
    const site = typeof config.site_vex === 'string' ? config.site_vex.trim().replace(/\/+$/, '') : '';
    const apiKey = typeof config.apikey_vex === 'string' ? config.apikey_vex.trim() : '';

    return {
        siteVex: site,
        apiKey
    };
}

export function getConfiguredBratProvider(config = {}, env = process.env) {
    return env?.NAZUNA_BRAT_PROVIDER
        ?? config?.api?.brat?.provider
        ?? config?.api?.bratProvider
        ?? config?.bratProvider
        ?? 'vex';
}

export function getConfiguredYoutubeProvider(config = {}, env = process.env) {
    return env?.NAZUNA_YOUTUBE_PROVIDER
        ?? config?.api?.youtube?.provider
        ?? config?.api?.youtubeProvider
        ?? config?.youtubeProvider
        ?? 'local';
}

function configuredNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function configuredBoolean(value, fallback = false) {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on', 'sim'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off', 'nao', 'não'].includes(normalized)) return false;
    return fallback;
}

function megabytesToBytes(value) {
    const megabytes = configuredNumber(value, 0);
    return megabytes > 0 ? Math.floor(megabytes * 1024 * 1024) : 0;
}

export function getYoutubeSettings(config = {}, env = process.env) {
    const youtube = config?.api?.youtube || {};

    return {
        provider: getConfiguredYoutubeProvider(config, env),
        allowVexFallback: configuredBoolean(
            env?.NAZUNA_YOUTUBE_ALLOW_VEX_FALLBACK
            ?? youtube.allowVexFallback
            ?? youtube.allow_vex_fallback,
            false
        ),
        maxAudioBytes: megabytesToBytes(
            env?.NAZUNA_YOUTUBE_MAX_AUDIO_MB ?? youtube.maxAudioMb ?? youtube.max_audio_mb
        ),
        maxVideoBytes: megabytesToBytes(
            env?.NAZUNA_YOUTUBE_MAX_VIDEO_MB ?? youtube.maxVideoMb ?? youtube.max_video_mb
        ),
        searchTimeoutMs: configuredNumber(
            env?.NAZUNA_YOUTUBE_SEARCH_TIMEOUT_MS ?? youtube.searchTimeoutMs,
            15000
        ),
        mediaTimeoutMs: configuredNumber(
            env?.NAZUNA_YOUTUBE_MEDIA_TIMEOUT_MS ?? youtube.mediaTimeoutMs,
            120000
        ),
        maxRedirects: configuredNumber(
            env?.NAZUNA_YOUTUBE_MAX_REDIRECTS ?? youtube.maxRedirects,
            3
        ),
        useYtDlp: configuredBoolean(
            env?.NAZUNA_YOUTUBE_USE_YTDLP
            ?? youtube.useYtDlp
            ?? youtube.use_yt_dlp,
            true
        ),
        ytDlpPath: String(
            env?.NAZUNA_YOUTUBE_YTDLP_PATH
            ?? youtube.ytDlpPath
            ?? youtube.ytdlp_path
            ?? ''
        ).trim(),
        ytDlpTimeoutMs: configuredNumber(
            env?.NAZUNA_YOUTUBE_YTDLP_TIMEOUT_MS ?? youtube.ytDlpTimeoutMs,
            300000
        ),
        ffmpegPath: String(
            env?.NAZUNA_YOUTUBE_FFMPEG_PATH
            ?? youtube.ffmpegPath
            ?? youtube.ffmpeg_path
            ?? ''
        ).trim()
    };
}
