import ytSearch from 'yt-search';
import { ApiError, ErrorCodes } from '../../errors.js';
import { createHttpClient } from '../../http.js';
import { getYoutubeSettings } from '../../config.js';
import * as ytDlp from './ytdlp.js';

const DEFAULT_SEARCH_TIMEOUT_MS = 15000;
const DEFAULT_MEDIA_TIMEOUT_MS = 15000;
const WATCH_PAGE_MAX_BYTES = 8 * 1024 * 1024;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

let defaultHttpClient;

function getHttpClient() {
    if (!defaultHttpClient) {
        defaultHttpClient = createHttpClient({
            timeoutMs: DEFAULT_MEDIA_TIMEOUT_MS,
            maxBytes: WATCH_PAGE_MAX_BYTES
        });
    }
    return defaultHttpClient;
}

function normalizeVideo(video) {
    const videoId = String(video?.videoId || '').trim();
    const seconds = Math.max(0, Number(video?.seconds ?? video?.duration?.seconds ?? 0) || 0);
    const thumbnail = typeof video?.thumbnail === 'string'
        ? video.thumbnail
        : String(video?.thumbnail?.url || '');

    return {
        videoId,
        url: String(video?.url || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : '')),
        title: String(video?.title || 'Vídeo do YouTube'),
        author: typeof video?.author === 'string' ? video.author : String(video?.author?.name || ''),
        seconds,
        durationSeconds: seconds,
        timestamp: String(video?.timestamp || video?.duration?.timestamp || ''),
        views: video?.views ?? null,
        ago: String(video?.ago || ''),
        description: String(video?.description || ''),
        thumbnail
    };
}

function withTimeout(promise, timeoutMs) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
            reject(new ApiError(ErrorCodes.TIMEOUT, {
                message: 'Tempo limite da busca local do YouTube excedido',
                userMessage: 'A busca do YouTube demorou demais para responder.',
                recoverable: true
            }));
        }, timeoutMs);
    });

    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function searchYoutube(query, options = {}) {
    const search = options.search || ytSearch;
    const timeoutMs = Math.max(1, Number(options.timeoutMs) || DEFAULT_SEARCH_TIMEOUT_MS);

    try {
        const result = await withTimeout(Promise.resolve(search({
            query,
            pages: 1,
            pageStart: 1
        })), timeoutMs);
        const videos = Array.isArray(result?.videos) ? result.videos : [];

        if (!videos.length) {
            throw new ApiError(ErrorCodes.UNSUPPORTED, {
                message: 'Nenhum vídeo encontrado na busca local',
                userMessage: 'Nenhum vídeo encontrado',
                recoverable: true
            });
        }

        return normalizeVideo(videos[0]);
    } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError(ErrorCodes.NETWORK, {
            message: error?.message || 'Falha na busca local do YouTube',
            cause: error
        });
    }
}

export function extractBalancedJson(text, startIndex) {
    if (text[startIndex] !== '{') {
        throw new ApiError(ErrorCodes.UPSTREAM, {
            message: 'JSON do player não começa com objeto'
        });
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = startIndex; index < text.length; index++) {
        const char = text[index];

        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (char === '\\') {
                escaped = true;
            } else if (char === '"') {
                inString = false;
            }
            continue;
        }

        if (char === '"') {
            inString = true;
        } else if (char === '{') {
            depth++;
        } else if (char === '}') {
            depth--;
            if (depth === 0) return text.slice(startIndex, index + 1);
        }
    }

    throw new ApiError(ErrorCodes.UPSTREAM, {
        message: 'JSON do player incompleto'
    });
}

const PLAYER_MARKER = 'ytInitialPlayerResponse';

function skipSpaces(text, index) {
    let cursor = index;
    while (cursor < text.length && /\s/.test(text[cursor])) cursor++;
    return cursor;
}

function isMarkerBoundary(text, index) {
    if (index === 0) return true;
    return !/[A-Za-z0-9_$.]/.test(text[index - 1]);
}

function assignmentBraceIndex(text, index) {
    let cursor = skipSpaces(text, index);
    if (text[cursor] !== '=') return -1;

    cursor = skipSpaces(text, cursor + 1);
    return text[cursor] === '{' ? cursor : -1;
}

function windowAssignmentBraceIndex(text, index) {
    let cursor = skipSpaces(text, index);

    if (text[cursor] === '.') {
        cursor = skipSpaces(text, cursor + 1);
        if (!text.startsWith(PLAYER_MARKER, cursor)) return -1;
        return assignmentBraceIndex(text, cursor + PLAYER_MARKER.length);
    }

    if (text[cursor] === '[') {
        cursor = skipSpaces(text, cursor + 1);
        const quote = text[cursor];
        if (quote !== '"' && quote !== "'") return -1;

        const end = text.indexOf(quote, cursor + 1);
        if (end === -1 || text.slice(cursor + 1, end) !== PLAYER_MARKER) return -1;

        cursor = skipSpaces(text, end + 1);
        if (text[cursor] !== ']') return -1;

        return assignmentBraceIndex(text, cursor + 1);
    }

    return -1;
}

function findPlayerAssignmentBraces(script) {
    const braces = [];
    let index = 0;
    let quote = '';
    let escaped = false;
    let lineComment = false;
    let blockComment = false;

    while (index < script.length) {
        const char = script[index];
        const next = script[index + 1];

        if (lineComment) {
            if (char === '\n') lineComment = false;
            index++;
            continue;
        }

        if (blockComment) {
            if (char === '*' && next === '/') {
                blockComment = false;
                index += 2;
            } else {
                index++;
            }
            continue;
        }

        if (quote) {
            if (escaped) {
                escaped = false;
            } else if (char === '\\') {
                escaped = true;
            } else if (char === quote) {
                quote = '';
            }
            index++;
            continue;
        }

        if (char === '/' && next === '/') {
            lineComment = true;
            index += 2;
            continue;
        }

        if (char === '/' && next === '*') {
            blockComment = true;
            index += 2;
            continue;
        }

        if (char === '"' || char === "'" || char === '`') {
            quote = char;
            index++;
            continue;
        }

        if (script.startsWith(PLAYER_MARKER, index) && isMarkerBoundary(script, index)) {
            const brace = assignmentBraceIndex(script, index + PLAYER_MARKER.length);
            if (brace !== -1) braces.push(brace);
            index += PLAYER_MARKER.length;
            continue;
        }

        if (script.startsWith('window', index) && isMarkerBoundary(script, index)) {
            const brace = windowAssignmentBraceIndex(script, index + 'window'.length);
            if (brace !== -1) braces.push(brace);
        }

        index++;
    }

    return braces;
}

function playerScripts(source) {
    const scripts = [];
    const scriptPattern = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
    let match;

    while ((match = scriptPattern.exec(source))) {
        scripts.push(match[1]);
    }

    return scripts.length ? scripts : [source];
}

export function extractYtInitialPlayerResponse(html) {
    const source = String(html || '');

    for (const script of playerScripts(source)) {
        for (const braceIndex of findPlayerAssignmentBraces(script)) {
            try {
                const json = extractBalancedJson(script, braceIndex);
                const parsed = JSON.parse(json);
                if (parsed && typeof parsed === 'object' && (parsed.playabilityStatus || parsed.streamingData)) {
                    return parsed;
                }
            } catch {
                // tenta a próxima atribuição válida
            }
        }
    }

    throw new ApiError(ErrorCodes.UPSTREAM, {
        message: 'ytInitialPlayerResponse não encontrado na página do YouTube',
        userMessage: 'O YouTube não retornou os dados do player.'
    });
}

function canonicalUrl(videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`;
}

function normalizePlayerMeta(player, fallbackVideoId = '') {
    const details = player?.videoDetails || {};
    const microformat = player?.microformat?.playerMicroformatRenderer || {};
    const thumbnails = details.thumbnail?.thumbnails
        || microformat.thumbnail?.thumbnails
        || [];
    const videoId = String(details.videoId || fallbackVideoId || '');
    const seconds = Math.max(0, Number(details.lengthSeconds) || 0);

    return {
        videoId,
        url: videoId ? canonicalUrl(videoId) : '',
        title: String(details.title || 'Vídeo do YouTube'),
        author: String(details.author || ''),
        seconds,
        durationSeconds: seconds,
        timestamp: '',
        views: details.viewCount ?? null,
        ago: String(microformat.publishDate || ''),
        description: String(details.shortDescription || ''),
        thumbnail: String(thumbnails[thumbnails.length - 1]?.url || '')
    };
}

function baseMime(format) {
    return String(format?.mimeType || '').split(';')[0].trim().toLowerCase();
}

function directUrl(format) {
    const url = String(format?.url || '');
    return /^https?:\/\//i.test(url) ? url : '';
}

function hasCipher(format) {
    return Boolean(format?.signatureCipher || format?.cipher);
}

function signatureBlocked() {
    return new ApiError(ErrorCodes.DEPENDENCY_MISSING, {
        message: 'YouTube retornou signatureCipher sem URL direta',
        userMessage: 'O YouTube exigiu assinatura de stream. Instale yt-dlp ou habilite o fallback Vex.',
        recoverable: true
    });
}

function ffmpegRequired() {
    return new ApiError(ErrorCodes.DEPENDENCY_MISSING, {
        message: 'Somente faixas adaptativas separadas foram encontradas',
        userMessage: 'O YouTube retornou áudio e vídeo separados. Instale FFmpeg ou habilite o fallback Vex.',
        recoverable: true
    });
}

function serverAbrRequired(kind) {
    return new ApiError(ErrorCodes.UPSTREAM, {
        message: `YouTube retornou streaming adaptativo de servidor sem URL direta para ${kind}`,
        userMessage: `O YouTube respondeu no modo de streaming adaptativo de servidor (sem URL direta) para ${kind}. É necessário um decifrador local como yt-dlp.`,
        details: { serverAbrStreamingUrl: true },
        recoverable: true
    });
}

function audioScore(format) {
    const mime = baseMime(format);
    const mimeRank = mime === 'audio/mp4' ? 3 : mime === 'audio/webm' ? 2 : 1;
    return [mimeRank, Number(format.bitrate) || 0];
}

function videoScore(format) {
    return [Number(format.height) || 0, Number(format.bitrate) || 0];
}

function compareScore(a, b) {
    const [aFirst, aSecond] = a;
    const [bFirst, bSecond] = b;
    return (bFirst - aFirst) || (bSecond - aSecond);
}

function pickAudioFormat(streamingData) {
    const formats = Array.isArray(streamingData?.adaptiveFormats)
        ? streamingData.adaptiveFormats.filter((format) => baseMime(format).startsWith('audio/'))
        : [];
    const direct = formats.filter((format) => directUrl(format));

    if (direct.length) {
        return direct.sort((a, b) => compareScore(audioScore(a), audioScore(b)))[0];
    }
    if (formats.some(hasCipher)) throw signatureBlocked();
    if (formats.length) throw serverAbrRequired('áudio');

    throw new ApiError(ErrorCodes.UNSUPPORTED, {
        message: 'Nenhuma faixa de áudio disponível',
        userMessage: 'Nenhuma faixa de áudio foi encontrada para este vídeo.'
    });
}

function pickVideoFormat(streamingData) {
    const formats = Array.isArray(streamingData?.formats)
        ? streamingData.formats.filter((format) => (
            baseMime(format) === 'video/mp4'
            && String(format.audioCodecs || '').toLowerCase() !== 'none'
        ))
        : [];
    const direct = formats.filter((format) => directUrl(format));

    if (direct.length) {
        return direct.sort((a, b) => compareScore(videoScore(a), videoScore(b)))[0];
    }
    if (formats.some(hasCipher)) throw signatureBlocked();

    const adaptive = Array.isArray(streamingData?.adaptiveFormats)
        ? streamingData.adaptiveFormats
        : [];
    const hasAdaptiveVideo = adaptive.some((format) => baseMime(format).startsWith('video/') && directUrl(format));
    const hasAdaptiveAudio = adaptive.some((format) => baseMime(format).startsWith('audio/') && directUrl(format));
    if (hasAdaptiveVideo && hasAdaptiveAudio) throw ffmpegRequired();
    if (adaptive.some(hasCipher)) throw signatureBlocked();
    if (adaptive.length || streamingData?.serverAbrStreamingUrl) throw serverAbrRequired('vídeo');

    throw new ApiError(ErrorCodes.UNSUPPORTED, {
        message: 'Nenhum formato de vídeo progressivo disponível',
        userMessage: 'Nenhum formato de vídeo compatível foi encontrado para este vídeo.'
    });
}

function extensionFor(kind, format) {
    const mime = baseMime(format);

    if (kind === 'audio') {
        if (mime === 'audio/mp4') return { mimetype: 'audio/mp4', extension: '.m4a' };
        if (mime === 'audio/webm') return { mimetype: 'audio/webm', extension: '.webm' };
        if (mime === 'audio/mpeg') return { mimetype: 'audio/mpeg', extension: '.mp3' };
        return { mimetype: 'audio/mp4', extension: '.m4a' };
    }

    return mime === 'video/webm'
        ? { mimetype: 'video/webm', extension: '.webm' }
        : { mimetype: 'video/mp4', extension: '.mp4' };
}

function safeFileName(title, extension) {
    const base = String(title || 'media')
        .replace(/[^\p{L}\p{N}\s_-]/gu, '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 80) || 'media';
    return `${base}${extension}`;
}

function playabilityError(player) {
    const status = String(player?.playabilityStatus?.status || '');
    if (!status || status === 'OK') return null;

    const reason = String(player?.playabilityStatus?.reason || 'Vídeo indisponível');
    const ageRestricted = /age/i.test(status) || /age|inappropriate/i.test(reason);
    const loginRequired = /login|sign in|not a bot|bot check/i.test(`${status} ${reason}`);

    return new ApiError(ErrorCodes.UNSUPPORTED, {
        message: `YouTube recusou a mídia: ${status}`,
        userMessage: ageRestricted
            ? '🔞 Este conteúdo possui restrição de idade e não pode ser processado.'
            : loginRequired
                ? 'O YouTube exigiu login ou verificação anti-bot para este vídeo.'
                : `Não foi possível obter a mídia: ${reason}`,
        recoverable: false
    });
}

async function loadPlayer(input, options = {}) {
    const url = String(input?.url || '');
    if (!url) {
        throw new ApiError(ErrorCodes.INPUT_INVALID, {
            message: 'URL do YouTube ausente',
            userMessage: 'Envie um link válido do YouTube.'
        });
    }

    const http = options.http || getHttpClient();
    let response;

    try {
        response = await http.getText(url, {
            signal: options.signal,
            timeoutMs: Math.max(1, Number(options.timeoutMs) || DEFAULT_MEDIA_TIMEOUT_MS),
            maxBytes: WATCH_PAGE_MAX_BYTES,
            headers: {
                'User-Agent': USER_AGENT,
                'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
                Accept: 'text/html,application/xhtml+xml',
                Cookie: 'CONSENT=YES+cb; SOCS=CAI'
            }
        });
    } catch (error) {
        if (error?.code === ErrorCodes.AUTH_INVALID) {
            throw new ApiError(ErrorCodes.UPSTREAM, {
                message: 'YouTube recusou a consulta da página do vídeo',
                userMessage: 'O YouTube bloqueou a consulta. Tente novamente mais tarde.',
                recoverable: true,
                cause: error
            });
        }
        throw error;
    }

    const player = extractYtInitialPlayerResponse(response.data);
    const blocked = playabilityError(player);
    if (blocked) throw blocked;

    if (player?.videoDetails?.isLive) {
        throw new ApiError(ErrorCodes.UNSUPPORTED, {
            message: 'Transmissões ao vivo não são suportadas',
            userMessage: 'Não é possível baixar transmissões ao vivo do YouTube.'
        });
    }

    if (!player?.streamingData) {
        throw new ApiError(ErrorCodes.UPSTREAM, {
            message: 'streamingData ausente no player do YouTube',
            userMessage: 'O YouTube não retornou os formatos de mídia.'
        });
    }

    return player;
}

async function prepareMedia(kind, input, options = {}) {
    try {
        const player = await loadPlayer(input, options);
        const format = kind === 'audio'
            ? pickAudioFormat(player.streamingData)
            : pickVideoFormat(player.streamingData);
        const remoteUrl = directUrl(format);
        const { mimetype, extension } = extensionFor(kind, format);
        const meta = normalizePlayerMeta(player, input?.videoId);

        return {
            remoteUrl,
            meta,
            mimetype,
            extension,
            fileName: safeFileName(meta.title, extension),
            headers: {
                'User-Agent': USER_AGENT,
                Referer: 'https://www.youtube.com/'
            }
        };
    } catch (error) {
        if (!canUseYtDlp(error)) throw error;
        return prepareWithYtDlp(kind, input, options, error);
    }
}

const YT_DLP_ELIGIBLE_CODES = new Set([
    ErrorCodes.UPSTREAM,
    ErrorCodes.DEPENDENCY_MISSING,
    ErrorCodes.UNSUPPORTED
]);

function canUseYtDlp(error) {
    if (!error || !YT_DLP_ELIGIBLE_CODES.has(error.code)) return false;
    if (error.recoverable === false) return false;
    if (/ao vivo/i.test(String(error.userMessage || ''))) return false;
    return true;
}

function ytDlpMissingHint(error) {
    const hint = 'yt-dlp não está instalado neste ambiente: instale o yt-dlp e exponha no PATH (ou defina api.youtube.ytDlpPath) para habilitar esse download.';
    const userMessage = String(error?.userMessage || '').trim();
    const message = String(error?.message || '').trim();

    return new ApiError(error?.code || ErrorCodes.UPSTREAM, {
        message,
        userMessage: userMessage ? `${userMessage} ${hint}` : hint,
        recoverable: error?.recoverable ?? true,
        details: {
            ...(error?.details || {}),
            ytDlpAvailable: false,
            cause: message || null
        },
        cause: error
    });
}

async function prepareWithYtDlp(kind, input, options, cause) {
    const settings = getYoutubeSettings(options.config || {}, options.env);
    if (settings.useYtDlp === false) throw cause;

    const module = options.ytdlp || ytDlp;
    const binary = await module.findYtDlpBinary({
        fs: options.fs,
        env: options.env,
        binary: settings.ytDlpPath || options.ytdlpBinary || ''
    });

    if (!binary) {
        throw ytDlpMissingHint(cause);
    }

    const ffmpegPath = await module.findFfmpegBinary({
        fs: options.fs,
        env: options.env,
        binary: settings.ffmpegPath || ''
    });

    return module.prepareMediaWithYtDlp(kind, input, {
        fs: options.fs,
        spawn: options.spawn,
        signal: options.signal,
        binary,
        ffmpegPath,
        timeoutMs: options.ytdlpTimeoutMs ?? settings.ytDlpTimeoutMs,
        maxBytes: options.maxBytes ?? (kind === 'audio' ? settings.maxAudioBytes : settings.maxVideoBytes),
        tempDir: options.ytdlpTempDir,
        cause
    });
}

export async function prepareAudio(input, options = {}) {
    return prepareMedia('audio', input, options);
}

export async function prepareVideo(input, options = {}) {
    return prepareMedia('video', input, options);
}
