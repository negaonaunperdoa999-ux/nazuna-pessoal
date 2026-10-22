/**
 * Resolucao de fotos publicas do Facebook.
 *
 * O yt-dlp so extrai videos do Facebook: links `photo.php?fbid=...` (fotos)
 * caem no extrator generico e terminam em "Unsupported URL". Este modulo
 * reconhece o tipo real do link e, para fotos, le apenas os metadados
 * publicos da pagina (og:image). Nada aqui usa cookies, login ou contorna
 * controles de acesso: paginas que exigem autenticacao sao reportadas como
 * tais e o comando NAO tenta adivinhar uma URL de video.
 */

import { hostMatches, isValidHttpUrl } from './ytDlpRunner.js';

const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_MAX_IMAGE_BYTES = 32 * 1024 * 1024;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const FACEBOOK_HOSTS = ['facebook.com', 'fb.watch'];
const FACEBOOK_MEDIA_HOSTS = ['fbcdn.net', 'facebook.com', 'fbsbx.com', 'fb.com'];

const IMAGE_SIGNATURES = [
    { mime: 'image/jpeg', test: (b) => b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF },
    { mime: 'image/png', test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 },
    { mime: 'image/gif', test: (b) => b.subarray(0, 6).toString('latin1') === 'GIF87a' || b.subarray(0, 6).toString('latin1') === 'GIF89a' },
    { mime: 'image/webp', test: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' }
];

export function classifyFacebookUrl(url) {
    if (!isValidHttpUrl(url)) return { kind: 'unknown' };

    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return { kind: 'unknown' };
    }

    const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
    if (!FACEBOOK_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`))) {
        return { kind: 'unknown' };
    }

    const path = parsed.pathname.toLowerCase();
    const hasVideoParam = Boolean(parsed.searchParams.get('v'));

    if (
        path.includes('/videos/')
        || path.includes('/video.php')
        || path.includes('/reel/')
        || path.includes('/reels/')
        || path.includes('/share/v/')
        || path.includes('/share/r/')
        || path === '/watch'
        || path === '/watch/'
        || path.endsWith('/watch/')
    ) {
        return { kind: 'video' };
    }

    // Formato legado de video: photo.php?v=<id> (o yt-dlp reconhece).
    if ((path === '/photo.php' || path === '/photo' || path === '/photo/') && hasVideoParam) {
        return { kind: 'video' };
    }

    if (
        path === '/photo.php'
        || path === '/photo'
        || path === '/photo/'
        || path.startsWith('/photo/')
        || path.includes('/photos/')
    ) {
        return { kind: 'photo' };
    }

    // Links compartilhados (/share/...) e posts podem ser foto ou video:
    // primeiro tenta-se o yt-dlp e, se ele nao reconhecer, a pagina publica
    // e consultada para identificar a midia real.
    return { kind: 'unknown' };
}

export function extractImageUrl(html) {
    const text = String(html || '');
    const patterns = [
        /<meta[^>]+(?:property|name)=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image(?::secure_url)?["']/i,
        /<meta[^>]+(?:property|name)=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']twitter:image(?::src)?["']/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (!match) continue;
        const decoded = decodeHtmlEntities(match[1]).trim();
        if (isValidHttpUrl(decoded)) return decoded;
    }

    return null;
}

export function extractVideoUrl(html) {
    const text = String(html || '');
    const patterns = [
        /<meta[^>]+(?:property|name)=["']og:video(?::url|:secure_url)?["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:video(?::url|:secure_url)?["']/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (!match) continue;
        const decoded = decodeHtmlEntities(match[1]).trim();
        if (isValidHttpUrl(decoded)) return decoded;
    }

    return null;
}

export function detectImageMimetype(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
    for (const signature of IMAGE_SIGNATURES) {
        if (signature.test(buffer)) return signature.mime;
    }
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

function fail(code, msg) {
    return { ok: false, code, etapa: 'foto', msg };
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
        if (response.ok === false || status >= 400) {
            return { ok: false, reason: 'status' };
        }

        const declaredLength = Number(response.headers?.get?.('content-length')) || 0;
        if (declaredLength > maxBytes) {
            return { ok: false, reason: 'too_large' };
        }

        const bytes = typeof response.arrayBuffer === 'function'
            ? Buffer.from(await response.arrayBuffer())
            : (Buffer.isBuffer(response.body) ? response.body : Buffer.alloc(0));

        if (bytes.length === 0) return { ok: false, reason: 'empty' };
        if (bytes.length > maxBytes) return { ok: false, reason: 'too_large' };

        const mimetype = detectImageMimetype(bytes);
        if (!mimetype) return { ok: false, reason: 'invalid' };

        const contentType = String(response.headers?.get?.('content-type') || '').toLowerCase();
        if (contentType && !contentType.startsWith('image/')) {
            return { ok: false, reason: 'invalid' };
        }

        return { ok: true, buffer: bytes, mimetype };
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Tenta obter uma foto publica do Facebook a partir do link informado.
 * @returns {Promise<{ok: boolean, code?: string, etapa?: string, msg?: string,
 *   type?: 'image', buffer?: Buffer, mimetype?: string, fileName?: string,
 *   thumbnail?: string, title?: string, sizeBytes?: number,
 *   resolvedUrl?: string, videoUrl?: string}>}
 */
export async function downloadFacebookPhoto(url, options = {}) {
    if (!isValidHttpUrl(url)) {
        return fail('invalid_url', 'Link do Facebook inválido.');
    }

    const fetchImpl = options.fetch || globalThis.fetch;
    if (typeof fetchImpl !== 'function') {
        return fail('extract_failed', 'Não foi possível consultar a página do Facebook neste ambiente.');
    }

    const timeoutMs = Math.max(1, Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS);
    const maxBytes = Math.max(1, Number(options.maxBytes) || DEFAULT_MAX_IMAGE_BYTES);
    const mediaHosts = Array.isArray(options.allowedMediaHosts) ? options.allowedMediaHosts : FACEBOOK_MEDIA_HOSTS;

    let page;
    try {
        page = await fetchPage(fetchImpl, url, timeoutMs);
    } catch (error) {
        return fail('fetch_failed', 'Não foi possível acessar a página do Facebook para identificar a mídia.');
    }

    if (!page.ok) {
        return fail('fetch_failed', 'O Facebook não devolveu uma página acessível para este link.');
    }

    const finalUrl = page.url || url;
    if (classifyFacebookUrl(finalUrl).kind === 'video') {
        return { ok: false, code: 'video', etapa: 'foto', resolvedUrl: finalUrl };
    }

    const videoUrl = extractVideoUrl(page.text);
    if (videoUrl) {
        // Pagina de video: nao envie a capa como se fosse a midia pedida.
        return { ok: false, code: 'video', etapa: 'foto', resolvedUrl: finalUrl, videoUrl };
    }

    const imageUrl = extractImageUrl(page.text);
    if (!imageUrl) {
        const loginRequired = /login_form|log into facebook|entrar no facebook|fazer login|é necessário entrar/i.test(page.text);
        return loginRequired
            ? fail('login_required', 'Este link é de uma foto do Facebook que exige login para ser vista; o provider local não usa cookies.')
            : fail('extract_failed', 'Não foi possível obter a foto pública do Facebook (o link pode ter sido removido ou exigir login).');
    }

    if (!hostMatches(imageUrl, mediaHosts)) {
        return fail('extract_failed', 'O Facebook retornou uma imagem em um endereço não reconhecido.');
    }

    let image;
    try {
        image = await fetchImage(fetchImpl, imageUrl, timeoutMs, maxBytes);
    } catch (error) {
        return fail('fetch_failed', 'Não foi possível baixar a foto do Facebook.');
    }

    if (!image.ok) {
        if (image.reason === 'too_large') {
            return fail('too_large', 'A foto do Facebook excede o limite permitido.');
        }
        return fail('image_invalid', 'O Facebook retornou uma imagem inválida para este link.');
    }

    const title = extractTitle(page.text);

    return {
        ok: true,
        type: 'image',
        buffer: image.buffer,
        mimetype: image.mimetype,
        fileName: `facebook${extensionForMimetype(image.mimetype)}`,
        thumbnail: imageUrl,
        title,
        sizeBytes: image.buffer.length,
        via: 'facebook-photo'
    };
}

function extractTitle(html) {
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
        if (value && !/^facebook$/i.test(value)) return value;
    }

    return '';
}

export { FACEBOOK_HOSTS, FACEBOOK_MEDIA_HOSTS };
