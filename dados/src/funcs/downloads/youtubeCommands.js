import { run as defaultRun } from '../api/index.js';
import { formatDuration, normalizeYoutubeInput, YOUTUBE_MAX_DURATION_SECONDS } from '../api/features/youtube.js';
import { toUserMessage } from '../api/errors.js';
import { findFfmpegBinary } from '../api/providers/local/ytdlp.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Resumo seguro do arquivo que vai ser enviado (sem conteudo, sem credenciais).
 * Serve para provar, em producao, qual arquivo saiu do provedor.
 */
export async function describeMediaForLog(media) {
    const filePath = media?.filePath || '';
    const info = {
        filePath,
        fileName: media?.fileName || null,
        extension: filePath ? path.extname(filePath).toLowerCase() : null,
        mimetype: media?.mimetype || null,
        sizeBytes: Number(media?.sizeBytes || 0),
        durationSeconds: media?.meta?.durationSeconds ?? null
    };

    try {
        const buffer = await fs.promises.readFile(filePath);
        info.sizeOnDisk = buffer.length;
        info.sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
        info.header = buffer.subarray(0, 12).toString('hex');
    } catch (error) {
        info.erroLeitura = error.message;
    }

    if (process.env.NAZUNA_DEBUG_MEDIA === '1') {
        info.ffprobe = await probeWithFfprobe(filePath);
    }

    return info;
}

async function probeWithFfprobe(filePath) {
    const candidates = [
        process.env.NAZUNA_YOUTUBE_FFPROBE_PATH
    ].filter(Boolean);

    const ffmpegPath = process.env.NAZUNA_YOUTUBE_FFMPEG_PATH
        || await findFfmpegBinary({ env: process.env }).catch(() => null);
    if (ffmpegPath) {
        candidates.push(path.join(path.dirname(ffmpegPath), process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe'));
    }

    for (const candidate of candidates) {
        try {
            const { stdout } = await execFileAsync(candidate, [
                '-v', 'error',
                '-show_entries', 'stream=codec_name,codec_type,profile,pix_fmt,width,height,duration',
                '-show_entries', 'format=format_name,duration,size',
                '-of', 'json',
                filePath
            ], { timeout: 30000 });
            return JSON.parse(stdout);
        } catch {
            // tenta o proximo candidato
        }
    }

    return { erro: 'ffprobe indisponivel' };
}

function textOr(value, fallback) {
    const text = String(value ?? '').trim();
    return text || fallback;
}

function formatViews(views) {
    if (typeof views === 'number' && Number.isFinite(views)) {
        return views.toLocaleString('pt-BR');
    }
    const text = String(views ?? '').trim();
    return text || 'Não informado';
}

function truncate(value, size) {
    const text = String(value || '');
    if (!text) return '';
    return text.length > size ? `${text.slice(0, size)}...` : text;
}

function durationText(meta) {
    const seconds = Math.max(0, Number(meta?.durationSeconds) || 0);
    const timestamp = textOr(meta?.timestamp, seconds > 0 ? formatDuration(seconds) : 'Não informado');
    return seconds > 0 ? `${timestamp} (${seconds} segundos)` : timestamp;
}

export function buildPlayCaption(meta) {
    const description = truncate(meta?.description, 100) || 'Sem descrição disponível';

    return `🎵 *Música Encontrada* 🎵\n\n📌 *Título:* ${textOr(meta?.title, 'Não informado')}\n👤 *Artista/Canal:* ${textOr(meta?.author, 'Não informado')}\n⏱ *Duração:* ${durationText(meta)}\n👀 *Visualizações:* ${formatViews(meta?.views)}\n📅 *Publicado:* ${textOr(meta?.ago, 'Não informado')}\n📜 *Descrição:* ${description}\n🔗 *Link:* ${textOr(meta?.url, 'Não informado')}\n\n🎧 *Baixando e processando sua música, aguarde...*`;
}

export function buildVideoCaption(meta) {
    const description = truncate(meta?.description, 100) || 'Sem descrição disponível';

    return `\n🎬 *Vídeo Encontrado* 🎬\n\n📌 *Título:* ${textOr(meta?.title, 'Não informado')}\n👤 *Artista/Canal:* ${textOr(meta?.author, 'Não informado')}\n⏱ *Duração:* ${durationText(meta)}\n👀 *Visualizações:* ${formatViews(meta?.views)}\n📅 *Publicado:* ${textOr(meta?.ago, 'Não informado')}\n📜 *Descrição:* ${description}\n🔗 *Link:* ${textOr(meta?.url, 'Não informado')}\n\n📹 *Enviando seu vídeo, aguarde!*`;
}

export function youtubeErrorMessage(error) {
    const message = toUserMessage(error);
    if (/^(?:❌|⚠️|🔞|⛔)/u.test(message)) return message;
    return `❌ ${message}`;
}

function isSizeError(error) {
    const message = String(error || '');
    return message.includes('ENOSPC') || message.includes('size');
}

async function sendMetadata(context, caption, footer) {
    const { nazu, from, info } = context;
    const thumbnail = textOr(context.meta?.thumbnail, '');

    if (thumbnail) {
        await nazu.sendMessage(from, {
            image: { url: thumbnail },
            caption,
            footer
        }, { quoted: info }).catch((error) => {
            console.error('Erro ao enviar mensagem de resultado do YouTube:', error);
        });
        return;
    }

    await nazu.sendMessage(from, {
        text: caption
    }, { quoted: info }).catch((error) => {
        console.error('Erro ao enviar mensagem de resultado do YouTube:', error);
    });
}

async function sendDocument(context, media, fileName, mimetype) {
    const stream = media.openStream();
    try {
        await context.nazu.sendMessage(context.from, {
            document: { stream },
            fileName,
            mimetype
        }, { quoted: context.info });
    } catch (error) {
        stream?.destroy?.();
        throw error;
    }
}

async function cleanupMedia(media) {
    try {
        await media.cleanup();
    } catch (error) {
        console.error('Erro ao limpar mídia temporária do YouTube:', error);
    }
}

async function logMediaEnvio(tipo, media) {
    try {
        const info = await describeMediaForLog(media);
        console.log(`[youtube:envio] tipo=${tipo} ${JSON.stringify(info)}`);
    } catch (error) {
        console.error('[youtube:envio] falha ao registrar a mídia:', error.message);
    }
}

export async function sendYoutubeAudio(context, media, options = {}) {
    const documentFallback = options.documentFallback !== false;
    const fileName = media.fileName || 'audio.mp3';
    const mimetype = media.mimetype || 'audio/mpeg';
    const seconds = Math.max(0, Number(media.meta?.durationSeconds) || 0);

    try {
        const stream = media.openStream();
        try {
            await context.nazu.sendMessage(context.from, {
                audio: { stream },
                mimetype,
                fileName,
                ...(seconds > 0 ? { seconds } : {})
            }, { quoted: context.info });
        } catch (error) {
            stream?.destroy?.();
            if (!documentFallback || !isSizeError(error)) throw error;
            await context.reply('📦 Arquivo muito grande para enviar como áudio, enviando como documento...');
            await sendDocument(context, media, fileName, mimetype);
        }
    } finally {
        await logMediaEnvio('audio', media);
        await cleanupMedia(media);
    }
}

export async function sendYoutubeVideo(context, media) {
    const fileName = media.fileName || 'video.mp4';
    const mimetype = media.mimetype || 'video/mp4';

    try {
        const stream = media.openStream();
        try {
            await context.nazu.sendMessage(context.from, {
                video: { stream },
                fileName,
                mimetype
            }, { quoted: context.info });
        } catch (error) {
            stream?.destroy?.();
            if (!isSizeError(error)) throw error;
            await context.reply('Arquivo muito grande, enviando como documento...');
            await sendDocument(context, media, fileName, mimetype);
        }
    } finally {
        await logMediaEnvio('video', media);
        await cleanupMedia(media);
    }
}

function usageFor(command, prefix) {
    if (command === 'playvid' || command === 'ytmp4') {
        return `Digite o nome do vídeo ou um link do YouTube.\n> Ex: ${prefix}${command} Back to Black`;
    }

    return `╭━━━⊱ 🎵 *YOUTUBE MP3* 🎵 ⊱━━━╮
│
│ 📝 Digite o nome da música ou
│     um link do YouTube
│
│  *Exemplos:*
│  ${prefix}${command} Back to Black
│  ${prefix}${command} https://youtube.com/...
│
╰━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
}

async function executeAudio(context, options = {}) {
    const { command, q, prefix, reply, runApi, maxDurationSeconds } = context;
    if (!q) {
        await reply(usageFor(command, prefix));
        return;
    }

    let input;
    try {
        input = normalizeYoutubeInput(q);
    } catch (error) {
        await reply(youtubeErrorMessage(error));
        return;
    }

    try {
        if (input.kind === 'url') {
            await reply('Aguarde um momentinho... ☀️');
            const result = await runApi('youtube.audio', { url: input.url });
            await sendYoutubeAudio(context, result.media, options);
            return;
        }

        await reply(`🔍 *Pesquisando no YouTube...*\n\n🎵 Música: *${input.query}*\n\n⏳ Aguarde um momento...`);
        const search = await runApi('youtube.search', { query: input.query }, {
            maxDurationSeconds
        });

        if (options.showMetadata) {
            context.meta = search.data;
            await sendMetadata(
                context,
                buildPlayCaption(search.data),
                `${context.nomebot || 'Nazuna'} • Versão ${context.botVersion || ''}`.trim()
            );
        }

        const result = await runApi('youtube.audio', { url: search.data.url }, {
            maxDurationSeconds
        });
        await sendYoutubeAudio(context, result.media, options);
    } catch (error) {
        await reply(youtubeErrorMessage(error));
    }
}

async function executeVideo(context) {
    const { command, q, prefix, reply, runApi } = context;
    if (!q) {
        await reply(usageFor(command, prefix));
        return;
    }

    let input;
    try {
        input = normalizeYoutubeInput(q);
    } catch (error) {
        await reply(youtubeErrorMessage(error));
        return;
    }

    try {
        if (input.kind === 'url') {
            await reply('Aguarde um momentinho... ☀️');
            const result = await runApi('youtube.video', { url: input.url });
            await sendYoutubeVideo(context, result.media);
            return;
        }

        const search = await runApi('youtube.search', { query: input.query });
        context.meta = search.data;
        await sendMetadata(
            context,
            buildVideoCaption(search.data),
            `By: ${context.nomebot || 'Nazuna'}`
        );

        const result = await runApi('youtube.video', { url: search.data.url });
        await sendYoutubeVideo(context, result.media);
    } catch (error) {
        await reply(youtubeErrorMessage(error));
    }
}

export function isYoutubeUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) return false;

    let parsed;
    try {
        parsed = new URL(raw.includes('://') ? raw : `https://${raw}`);
    } catch {
        return false;
    }

    const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
    return host === 'youtube.com'
        || host.endsWith('.youtube.com')
        || host === 'youtu.be'
        || host.endsWith('.youtu.be');
}

export async function runYoutubeCommand(context) {
    const command = String(context.command || '').toLowerCase();
    const baseContext = {
        ...context,
        prefix: context.prefix || '.',
        q: String(context.q || '').trim(),
        runApi: context.runApi || defaultRun
    };

    if (command === 'play' || command === 'ytmp3') {
        await executeAudio({
            ...baseContext,
            command,
            maxDurationSeconds: YOUTUBE_MAX_DURATION_SECONDS
        }, { showMetadata: true });
        return;
    }

    if (command === 'play2') {
        await executeAudio({
            ...baseContext,
            command,
            maxDurationSeconds: YOUTUBE_MAX_DURATION_SECONDS
        }, { showMetadata: false });
        return;
    }

    if (command === 'playvid' || command === 'ytmp4') {
        await executeVideo({
            ...baseContext,
            command
        });
    }
}

export async function autoDownloadYoutube(context) {
    const runApi = context.runApi || defaultRun;

    try {
        const result = await runApi('youtube.audio', { url: context.url });
        await sendYoutubeAudio(context, result.media, { documentFallback: false });
        return true;
    } catch (error) {
        console.error('Erro no autodl do YouTube:', error);
        return false;
    }
}
