/**
 * Provider local de mídia social (TikTok, Instagram, Facebook) via yt-dlp.
 *
 * Substitui downloaders que dependiam da VexAPI (paga) por binário local.
 * Não contorna autenticação, paywall ou privacidade: conteúdo que exige login
 * simplesmente falha com mensagem clara.
 */

import fsp from 'node:fs/promises';
import {
    downloadMediaWithYtDlp,
    findFfmpegBinary,
    findYtDlpBinary,
    hostMatches,
    isValidHttpUrl
} from './ytDlpRunner.js';

export const SOCIAL_PLATFORMS = Object.freeze({
    tiktok: {
        label: 'TikTok',
        hosts: ['tiktok.com'],
        maxBytes: 64 * 1024 * 1024
    },
    instagram: {
        label: 'Instagram',
        hosts: ['instagram.com'],
        maxBytes: 64 * 1024 * 1024
    },
    facebook: {
        label: 'Facebook',
        hosts: ['facebook.com', 'fb.watch'],
        maxBytes: 96 * 1024 * 1024
    }
});

export function detectSocialPlatform(url) {
    for (const [name, config] of Object.entries(SOCIAL_PLATFORMS)) {
        if (hostMatches(url, config.hosts)) return name;
    }
    return null;
}

function mediaTypeFor(extension, mimetype) {
    if (String(mimetype).startsWith('image/')) return 'image';
    if (String(mimetype).startsWith('audio/')) return 'audio';
    if (['.mp4', '.m4v', '.webm', '.mkv', '.mov'].includes(extension)) return 'video';
    return 'video';
}

function mapError(error, platform) {
    const config = SOCIAL_PLATFORMS[platform] || { label: 'A plataforma' };
    const message = String(error?.message || '');

    if (/URL inválida/i.test(message)) {
        return `Link do ${config.label} inválido.`;
    }
    if (/yt-dlp não está disponível/i.test(message)) {
        return `O yt-dlp não está disponível neste ambiente; não é possível baixar do ${config.label}.`;
    }
    if (/Tempo limite excedido/i.test(message)) {
        return `O download do ${config.label} demorou demais.`;
    }
    if (/cancelado/i.test(message)) {
        return 'O download foi cancelado.';
    }
    if (/login|sign in|private|privado|rate limit|bot/i.test(message)) {
        return `O ${config.label} não liberou este conteúdo (pode exigir login ou estar restrito).`;
    }
    if (/logged-in|log in|cookies|authentication|not authenticated|empty media response/i.test(message)) {
        return `O ${config.label} exigiu autenticação (cookies) para este conteúdo; o provider local não usa cookies.`;
    }
    if (/não está disponível|unavailable|removed|removido|deleted/i.test(message)) {
        return `Este conteúdo do ${config.label} não está mais disponível.`;
    }
    if (/unsupported url|no video formats|is not a valid url|unable to extract|cannot parse|no data/i.test(message)) {
        return `O conteúdo do ${config.label} não pôde ser extraído (pode ser privado, removido ou exigir login).`;
    }
    if (/não gerou nenhum arquivo/i.test(message)) {
        return `Não foi possível baixar a mídia do ${config.label} (o yt-dlp não gerou arquivo).`;
    }
    if (/veio vazio/i.test(message)) {
        return `Não foi possível baixar a mídia do ${config.label} (arquivo vazio).`;
    }
    if (/excede o limite permitido/i.test(message)) {
        return `A mídia do ${config.label} excede o limite permitido.`;
    }

    return `Não foi possível baixar do ${config.label}.`;
}

/**
 * Baixa a mídia de uma plataforma social usando o yt-dlp local.
 * @returns {Promise<{ok: boolean, msg?: string, type?: string, title?: string, buffer?: Buffer, mimetype?: string, fileName?: string, thumbnail?: string, resolution?: string, cleanup?: Function}>}
 */
export async function downloadSocialMedia(platform, url, options = {}) {
    const config = SOCIAL_PLATFORMS[platform];

    if (!config) {
        return { ok: false, msg: 'Plataforma não suportada pelo provider local.' };
    }

    if (!isValidHttpUrl(url)) {
        return { ok: false, msg: `Link do ${config.label} inválido.` };
    }

    if (!hostMatches(url, config.hosts)) {
        return { ok: false, msg: `O link informado não é do ${config.label}.` };
    }

    const binary = options.binary !== undefined
        ? String(options.binary || '').trim()
        : await findYtDlpBinary({ env: options.env });
    if (!binary) {
        return { ok: false, msg: 'O yt-dlp não está disponível neste ambiente; não é possível baixar do ' + config.label + '.' };
    }

    const ffmpegPath = options.ffmpegPath === null
        ? null
        : (options.ffmpegPath || await findFfmpegBinary({ env: options.env }));

    let media = null;

    try {
        media = await downloadMediaWithYtDlp(url, {
            binary,
            ffmpegPath,
            fs: options.fs,
            spawn: options.spawn,
            signal: options.signal,
            timeoutMs: options.timeoutMs,
            maxBytes: options.maxBytes ?? config.maxBytes,
            tempRoot: options.tempRoot,
            extraArgs: options.extraArgs
        });
    } catch (error) {
        const origem = String(error?.stack || '').split('\n').slice(1, 3).join(' | ').trim();
        console.error(`[socialMedia] provider=${platform} etapa=download falha=${error?.message || 'erro desconhecido'} ${origem}`);
        return { ok: false, msg: mapError(error, platform), etapa: 'download' };
    }

    try {
        const buffer = options.readFile
            ? await options.readFile(media.filePath)
            : await fsp.readFile(media.filePath);

        if (!buffer || buffer.length <= 0) {
            return { ok: false, msg: 'A mídia baixada veio vazia.', etapa: 'validacao' };
        }

        const type = mediaTypeFor(media.extension, media.mimetype);

        return {
            ok: true,
            type,
            title: media.title || '',
            buffer,
            mimetype: media.mimetype,
            fileName: media.fileName || `midia${media.extension}`,
            thumbnail: media.thumbnail || null,
            resolution: media.height ? `${media.height}p` : 'HD',
            sizeBytes: media.sizeBytes,
            container: media.container,
            cleanup: media.cleanup
        };
    } catch (error) {
        return { ok: false, msg: 'Não foi possível ler a mídia baixada.', etapa: 'validacao' };
    } finally {
        await media.cleanup?.();
    }
}

export function downloadTikTok(url, options = {}) {
    return downloadSocialMedia('tiktok', url, options);
}

export function downloadInstagram(url, options = {}) {
    return downloadSocialMedia('instagram', url, options);
}

export function downloadFacebook(url, options = {}) {
    return downloadSocialMedia('facebook', url, options);
}
