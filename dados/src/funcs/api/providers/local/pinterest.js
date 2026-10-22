/**
 * Provider local de pins do Pinterest.
 *
 * - Video: yt-dlp (extrator Pinterest do proprio binario), preferindo H.264
 *   e juntando a faixa de audio quando existir.
 * - Imagem: metadados publicos da pagina do pin (og:image / URL "originals"),
 *   sem login, cookies ou API externa.
 *
 * A pesquisa textual fica em `pinterestSearch.js` e usa a pagina publica
 * movel, sem chave e sem API externa.
 */

import fsp from 'node:fs/promises';
import {
    downloadMediaWithYtDlp,
    findFfmpegBinary,
    findYtDlpBinary,
    hostMatches,
    isValidHttpUrl,
    mimetypeForExtension
} from './ytDlpRunner.js';

const DEFAULT_TIMEOUT_MS = 25000;
const DEFAULT_MAX_VIDEO_BYTES = 64 * 1024 * 1024;
const DEFAULT_MAX_IMAGE_BYTES = 32 * 1024 * 1024;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const PINTEREST_HOSTS = ['pinterest.com', 'pin.it'];
const PINTEREST_MEDIA_HOSTS = ['pinimg.com'];
const FORMAT_SELECTORS = [
    'bv*[vcodec^=avc1]+ba/b[vcodec^=avc1]',
    'bv*[vcodec^=h264]+ba/b[vcodec^=h264]',
    'b'
];

export function isPinterestPinUrl(url) {
    if (!isValidHttpUrl(url) || !hostMatches(url, PINTEREST_HOSTS)) return false;
    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'pin.it' || hostname.endsWith('.pin.it')) return true;
    return /\/pin\//i.test(parsed.pathname);
}

export function extractPinId(url) {
    if (!isValidHttpUrl(url)) return null;
    try {
        const parsed = new URL(url);
        const match = parsed.pathname.match(/\/pin\/([^/?#]+)/i);
        return match ? match[1] : null;
    } catch {
        return null;
    }
}

export function extractPinImage(html) {
    const text = String(html || '');
    const imagePatterns = [
        /<meta[^>]+(?:property|name)=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image(?::secure_url)?["']/i,
        /<meta[^>]+(?:property|name)=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']twitter:image(?::src)?["']/i
    ];

    let metaImage = null;

    for (const pattern of imagePatterns) {
        const match = text.match(pattern);
        if (!match) continue;
        const candidate = decodeHtmlEntities(match[1]).trim();
        if (isValidHttpUrl(candidate) && hostMatches(candidate, PINTEREST_MEDIA_HOSTS)) {
            metaImage = candidate;
            break;
        }
    }

    // A pagina tambem expoe a versao "originals" (resolucao real). Usamos a
    // URL somente quando o hash e o mesmo da og:image, para nao pegar a
    // imagem de um pin relacionado.
    if (metaImage) {
        const hashMatch = metaImage.match(/\/([a-f0-9]{32})\.(?:jpg|jpeg|png|webp|gif)/i);
        if (hashMatch) {
            const original = text.match(new RegExp(`https://i\\.pinimg\\.com/originals/[a-f0-9]{2}/[a-f0-9]{2}/[a-f0-9]{2}/${hashMatch[1]}\\.(?:jpg|jpeg|png|webp|gif)`, 'i'));
            if (original) return decodeHtmlEntities(original[0]);
        }
        return metaImage;
    }

    const anyOriginal = text.match(/https:\/\/i\.pinimg\.com\/originals\/[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9]{32}\.(?:jpg|jpeg|png|webp|gif)/i);
    return anyOriginal ? decodeHtmlEntities(anyOriginal[0]) : null;
}

export function extractPinVideo(html) {
    const text = String(html || '');
    const patterns = [
        /<meta[^>]+(?:property|name)=["']og:video(?::url|:secure_url)?["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:video(?::url|:secure_url)?["']/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (!match) continue;
        const candidate = decodeHtmlEntities(match[1]).trim();
        if (isValidHttpUrl(candidate)) return candidate;
    }

    if (/v1\.pinimg\.com\/videos\//i.test(text)) return 'embedded-video';
    return null;
}

export function extractPinTitle(html) {
    const text = String(html || '');
    const patterns = [
        /<meta[^>]+(?:property|name)=["']og:title["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:title["']/i,
        /<title[^>]*>([^<]*)<\/title>/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (!match) continue;
        const value = decodeHtmlEntities(match[1]).trim();
        if (value && !/^pinterest$/i.test(value)) return value;
    }

    return '';
}

export function detectImageMimetype(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'image/jpeg';
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'image/png';
    const head6 = buffer.subarray(0, 6).toString('latin1');
    if (head6 === 'GIF87a' || head6 === 'GIF89a') return 'image/gif';
    if (buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
    return null;
}

function decodeHtmlEntities(value) {
    return String(value)
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>');
}

function extensionForMimetype(mimetype) {
    switch (mimetype) {
        case 'image/png': return '.png';
        case 'image/webp': return '.webp';
        case 'image/gif': return '.gif';
        default: return '.jpg';
    }
}

function fail(code, msg, etapa) {
    return { ok: false, code, etapa: etapa || 'download', msg };
}

async function fetchPage(fetchImpl, url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetchImpl(url, {
            redirect: 'follow',
            signal: controller.signal,
            headers: {
                'user-agent': USER_AGENT,
                'accept-language': 'en-US,en;q=0.9',
                accept: 'text/html,application/xhtml+xml'
            }
        });

        const text = typeof response.text === 'function' ? await response.text() : '';

        return {
            ok: response.ok !== false && (response.status === undefined || Number(response.status) < 400),
            status: Number(response.status) || 0,
            url: response.url || url,
            text: String(text || '')
        };
    } finally {
        clearTimeout(timer);
    }
}

async function fetchImage(fetchImpl, url, timeoutMs, maxBytes) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetchImpl(url, {
            redirect: 'follow',
            signal: controller.signal,
            headers: {
                'user-agent': USER_AGENT,
                accept: 'image/avif,image/webp,image/png,image/jpeg,image/*'
            }
        });

        const status = Number(response.status) || 0;
        if (response.ok === false || status >= 400) return { ok: false, reason: 'status' };

        const declaredLength = Number(response.headers?.get?.('content-length')) || 0;
        if (declaredLength > maxBytes) return { ok: false, reason: 'too_large' };

        const bytes = typeof response.arrayBuffer === 'function'
            ? Buffer.from(await response.arrayBuffer())
            : (Buffer.isBuffer(response.body) ? response.body : Buffer.alloc(0));

        if (bytes.length === 0) return { ok: false, reason: 'empty' };
        if (bytes.length > maxBytes) return { ok: false, reason: 'too_large' };

        const mimetype = detectImageMimetype(bytes);
        if (!mimetype) return { ok: false, reason: 'invalid' };

        const contentType = String(response.headers?.get?.('content-type') || '').toLowerCase();
        if (contentType && !contentType.startsWith('image/')) return { ok: false, reason: 'invalid' };

        return { ok: true, buffer: bytes, mimetype };
    } finally {
        clearTimeout(timer);
    }
}

async function readDownloadedMedia(media, options) {
    const buffer = options.readFile
        ? await options.readFile(media.filePath)
        : await fsp.readFile(media.filePath);

    if (!buffer || buffer.length === 0) {
        return fail('empty', 'O vídeo do Pinterest baixado veio vazio.', 'validacao');
    }

    return {
        ok: true,
        type: 'video',
        buffer,
        mimetype: media.mimetype || mimetypeForExtension(media.extension),
        fileName: media.fileName || `pinterest${media.extension || '.mp4'}`,
        thumbnail: media.thumbnail || null,
        title: media.title || '',
        resolution: media.height ? `${media.height}p` : 'HD',
        sizeBytes: buffer.length,
        container: media.container,
        cleanup: media.cleanup
    };
}

/**
 * Baixa um pin do Pinterest (video via yt-dlp ou imagem via metadados).
 * @param {string} url
 * @param {{binary?: string|null, ffmpegPath?: string|null, spawn?: Function,
 *   fetch?: Function, readFile?: Function, fs?: object, tempRoot?: string,
 *   timeoutMs?: number, maxBytes?: number}} [options]
 */
export async function downloadPinterestPin(url, options = {}) {
    if (!isPinterestPinUrl(url)) {
        return fail('invalid_url', 'Link do Pinterest inválido.', 'validacao');
    }

    const fetchImpl = options.fetch || globalThis.fetch;
    const timeoutMs = Math.max(1, Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS);
    const maxVideoBytes = Math.max(1, Number(options.maxBytes) || DEFAULT_MAX_VIDEO_BYTES);
    const maxImageBytes = Math.min(maxVideoBytes, DEFAULT_MAX_IMAGE_BYTES);

    let pageUrl = url;
    let page = null;

    // pin.it e um redirecionador: resolve para a URL canonica do pin antes de
    // qualquer download. Aproveita a resposta para a extracao da imagem.
    const host = new URL(url).hostname.toLowerCase();
    if (!/pinterest\.com$/i.test(host) || /^pin\.it$/i.test(host) || host.endsWith('.pin.it')) {
        if (typeof fetchImpl === 'function') {
            try {
                page = await fetchPage(fetchImpl, url, timeoutMs);
                if (page.ok && page.url && hostMatches(page.url, ['pinterest.com'])) {
                    pageUrl = page.url;
                }
            } catch {
                // segue com a URL original; o yt-dlp ainda pode resolver
            }
        }
    }

    const binary = options.binary === null
        ? ''
        : (String(options.binary || '').trim() || await findYtDlpBinary({ env: options.env }));

    const ffmpegPath = options.ffmpegPath === null
        ? null
        : (options.ffmpegPath || await findFfmpegBinary({ env: options.env }));

    let lastError = null;
    let usedSelector = null;

    if (binary) {
        for (const selector of (Array.isArray(options.formatSelector) ? options.formatSelector : FORMAT_SELECTORS)) {
            let media = null;
            try {
                media = await downloadMediaWithYtDlp(pageUrl, {
                    binary,
                    ffmpegPath,
                    fs: options.fs,
                    spawn: options.spawn,
                    signal: options.signal,
                    timeoutMs: options.timeoutMs,
                    maxBytes: maxVideoBytes,
                    tempRoot: options.tempRoot,
                    extraArgs: ['-f', selector]
                });
                usedSelector = selector;
            } catch (error) {
                lastError = error;
                const message = String(error?.message || '');
                // "No video formats" / "Unsupported URL" nao mudam com o
                // seletor: e um pin de imagem (ou link nao suportado).
                if (/no video formats|unsupported url/i.test(message)) break;
                const retriable = /not available|requested format|unable to extract/i.test(message);
                if (!retriable) break;
                continue;
            }

            try {
                const mediaResult = await readDownloadedMedia(media, options);
                await media.cleanup?.();
                return { ...mediaResult, formatSelector: usedSelector };
            } catch (error) {
                await media.cleanup?.();
                lastError = error;
                break;
            }
        }
    }

    // Sem video (pin de imagem, yt-dlp ausente ou formato indisponivel):
    // consulta a pagina publica do pin.
    if (typeof fetchImpl !== 'function') {
        return fail('extract_failed', 'Não foi possível consultar a página do Pinterest neste ambiente.', 'foto');
    }

    if (!page) {
        try {
            page = await fetchPage(fetchImpl, pageUrl, timeoutMs);
        } catch {
            return fail('fetch_failed', 'Não foi possível acessar a página do Pinterest.', 'foto');
        }
    }

    if (!page.ok) {
        return fail('fetch_failed', 'O Pinterest não devolveu uma página acessível para este pin.', 'foto');
    }

    const imageUrl = extractPinImage(page.text);
    const isVideoPage = Boolean(extractPinVideo(page.text));

    // Pin de video: nunca envie a capa (og:image) como se fosse o video.
    if (isVideoPage) {
        const detalhe = lastError ? ` (${lastError.message})` : '';
        return fail('video_unavailable', `Não foi possível baixar o vídeo deste pin do Pinterest${detalhe}`, 'download');
    }

    if (!imageUrl) {
        return fail('extract_failed', 'Não foi possível obter a imagem deste pin do Pinterest (o link pode ter sido removido ou exigir login).', 'foto');
    }

    if (!hostMatches(imageUrl, PINTEREST_MEDIA_HOSTS)) {
        return fail('extract_failed', 'O Pinterest retornou uma imagem em um endereço não reconhecido.', 'foto');
    }

    let image;
    try {
        image = await fetchImage(fetchImpl, imageUrl, timeoutMs, maxImageBytes);
    } catch {
        return fail('fetch_failed', 'Não foi possível baixar a imagem do Pinterest.', 'foto');
    }

    if (!image.ok) {
        if (image.reason === 'too_large') {
            return fail('too_large', 'A imagem do Pinterest excede o limite permitido.', 'foto');
        }
        return fail('image_invalid', 'O Pinterest retornou uma imagem inválida para este pin.', 'foto');
    }

    const pinId = extractPinId(pageUrl) || extractPinId(url) || 'pin';

    return {
        ok: true,
        type: 'image',
        buffer: image.buffer,
        mimetype: image.mimetype,
        fileName: `pinterest-${pinId}${extensionForMimetype(image.mimetype)}`,
        thumbnail: imageUrl,
        title: extractPinTitle(page.text),
        sizeBytes: image.buffer.length,
        via: 'pinterest-page'
    };
}

export { PINTEREST_HOSTS, PINTEREST_MEDIA_HOSTS, FORMAT_SELECTORS };
