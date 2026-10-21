import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ApiError, ErrorCodes } from '../../errors.js';
import {
    findBinary,
    findFfmpegBinary,
    findYtDlpBinary,
    inspectContainer,
    parseInfoJson,
    resolveOutputFile,
    runProcess
} from './ytDlpRunner.js';

export { findYtDlpBinary, findFfmpegBinary };

const DEFAULT_TIMEOUT_MS = 300000;
const DEFAULT_MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const AUDIO_FORMAT_SELECTOR = 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio';
// O WhatsApp no iOS nao reproduz AV1/VP9 (tela preta e duracao 0:00).
// Por isso o video e sempre requerido em H.264 (avc1) + audio AAC (m4a).
const VIDEO_FORMAT_SELECTOR = 'best[ext=mp4][vcodec^=avc1]/b[ext=mp4][vcodec^=avc1]';
const VIDEO_FORMAT_SELECTOR_WITH_FFMPEG = 'best[ext=mp4][vcodec^=avc1]/b[ext=mp4][vcodec^=avc1]/bv*[vcodec^=avc1][ext=mp4]+ba[ext=m4a]';

export async function isYtDlpAvailable(options = {}) {
    return Boolean(await findYtDlpBinary(options));
}

function missingBinaryError(cause) {
    return new ApiError(ErrorCodes.DEPENDENCY_MISSING, {
        message: 'yt-dlp não está disponível no ambiente',
        userMessage: 'O YouTube não forneceu URL direta e o yt-dlp não está instalado. Instale o yt-dlp e exponha no PATH (ou defina api.youtube.ytDlpPath).',
        recoverable: true,
        details: { cause: cause?.message || null },
        cause
    });
}

function buildArgs(kind, options) {
    const args = [
        '--no-playlist',
        '--no-warnings',
        '--no-progress',
        '--no-color',
        '--quiet',
        '--socket-timeout',
        '20',
        '--retries',
        '3',
        '--print',
        'after_move:filepath',
        '--print-json',
        '-o',
        options.outputTemplate
    ];

    if (Number(options.maxBytes) > 0) {
        args.push('--max-filesize', String(Math.floor(Number(options.maxBytes))));
    }

    if (options.ffmpegPath) {
        args.push('--ffmpeg-location', options.ffmpegPath);
    }

    if (kind === 'audio') {
        args.push('-f', AUDIO_FORMAT_SELECTOR);
    } else {
        args.push('-f', options.ffmpegPath ? VIDEO_FORMAT_SELECTOR_WITH_FFMPEG : VIDEO_FORMAT_SELECTOR);
    }

    args.push(options.url);
    return args;
}

function collectOutput(stream, limit, state) {
    if (!stream || typeof stream.on !== 'function') return;
    stream.on('data', (chunk) => {
        if (state.bytes >= limit) return;
        const text = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
        state.bytes += text.length;
        state.text += text;
    });
}

function mimetypeFor(kind, extension) {
    const ext = String(extension || '').toLowerCase();

    if (kind === 'audio') {
        if (ext === '.m4a' || ext === '.mp4') return 'audio/mp4';
        if (ext === '.webm') return 'audio/webm';
        if (ext === '.opus') return 'audio/ogg';
        if (ext === '.ogg') return 'audio/ogg';
        if (ext === '.mp3') return 'audio/mpeg';
        return 'audio/mp4';
    }

    if (ext === '.webm') return 'video/webm';
    if (ext === '.mkv') return 'video/x-matroska';
    return 'video/mp4';
}

function safeFileName(title, extension) {
    const base = String(title || 'media')
        .replace(/[^\p{L}\p{N}\s_-]/gu, '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 80) || 'media';
    return `${base}${extension}`;
}

function ffprobePathFor(ffmpegPath) {
    if (!ffmpegPath) return null;
    const ext = process.platform === 'win32' ? '.exe' : '';
    return path.join(path.dirname(ffmpegPath), `ffprobe${ext}`);
}

/**
 * Remux sem recompressao: apenas reposiciona o moov (faststart) e normaliza o
 * container. Nao altera codec, bitrate nem qualidade.
 */
async function remuxForCompatibility(fsImpl, filePath, ffmpegPath, options) {
    if (!ffmpegPath) return { filePath, remuxed: false };

    const target = `${filePath}.compat.mp4`;

    try {
        await runProcess(ffmpegPath, [
            '-y',
            '-i', filePath,
            '-c', 'copy',
            '-movflags', '+faststart',
            target
        ], {
            spawn: options.spawn,
            signal: options.signal,
            timeoutMs: Math.max(1, Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS),
            maxOutputBytes: options.maxOutputBytes
        });
    } catch (error) {
        return { filePath, remuxed: false, error: error?.message || String(error) };
    }

    try {
        const stat = await fsImpl.stat(target);
        if (!stat.isFile() || stat.size <= 0) {
            return { filePath, remuxed: false, error: 'ffmpeg nao gerou arquivo' };
        }
        return { filePath: target, remuxed: true, sizeBytes: stat.size };
    } catch (error) {
        return { filePath, remuxed: false, error: error?.message || String(error) };
    }
}

async function probeDuration(fsImpl, filePath, ffmpegPath, options) {
    const ffprobe = ffprobePathFor(ffmpegPath);
    if (!ffprobe) return null;

    try {
        await fsImpl.access(ffprobe);
    } catch {
        return null;
    }

    try {
        const result = await runProcess(ffprobe, [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'json',
            filePath
        ], {
            spawn: options.spawn,
            signal: options.signal,
            timeoutMs: 30000,
            maxOutputBytes: 64 * 1024
        });

        const parsed = JSON.parse(result.stdout || '{}');
        const duration = Number(parsed?.format?.duration);
        return Number.isFinite(duration) ? duration : null;
    } catch {
        return null;
    }
}

function uploadDateToIso(value) {
    const raw = String(value || '').trim();
    if (!/^\d{8}$/.test(raw)) return '';
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

function metaFromInfo(info, fallback = {}) {
    const base = { ...(fallback || {}) };
    if (!info || typeof info !== 'object') return base;

    const duration = Number(info.duration);
    const author = info.uploader || info.channel || info.artist || '';

    return {
        ...base,
        videoId: String(info.id || base.videoId || ''),
        url: String(info.webpage_url || base.url || ''),
        title: String(info.title || base.title || ''),
        author: author || base.author || '',
        durationSeconds: Number.isFinite(duration) && duration > 0 ? duration : (base.durationSeconds || 0),
        views: info.view_count ?? base.views ?? null,
        ago: uploadDateToIso(info.upload_date) || base.ago || '',
        description: String(info.description || base.description || ''),
        thumbnail: String(info.thumbnail || base.thumbnail || '')
    };
}

function mapYtDlpError(error) {
    if (error instanceof ApiError) return error;

    const message = String(error?.message || '').trim();

    if (/Tempo limite excedido/i.test(message)) {
        return new ApiError(ErrorCodes.TIMEOUT, {
            message: 'Tempo limite do yt-dlp excedido',
            userMessage: 'O download demorou demais para concluir.',
            recoverable: true,
            cause: error
        });
    }

    if (/cancelado/i.test(message)) {
        return new ApiError(ErrorCodes.TIMEOUT, {
            message: 'Download do yt-dlp cancelado',
            userMessage: 'O download foi cancelado.',
            recoverable: false,
            cause: error
        });
    }

    return new ApiError(ErrorCodes.UPSTREAM, {
        message: `yt-dlp falhou: ${message}`,
        userMessage: 'Não foi possível baixar a mídia do YouTube.',
        details: { stderr: message },
        recoverable: true,
        cause: error
    });
}

export async function prepareMediaWithYtDlp(kind, input, options = {}) {
    const fsImpl = options.fs || fsp;
    const binary = String(options.binary || '').trim();

    if (!binary) {
        throw missingBinaryError(options.cause);
    }

    const tempRoot = options.tempDir || path.join(os.tmpdir(), 'nazuna-ytdlp');
    await fsImpl.mkdir(tempRoot, { recursive: true, mode: 0o700 });
    const tempDir = await fsImpl.mkdtemp(path.join(tempRoot, 'media-'));
    const url = String(input?.url || '').trim();

    if (!url) {
        await fsImpl.rm(tempDir, { recursive: true, force: true });
        throw new ApiError(ErrorCodes.INPUT_INVALID, {
            message: 'URL do YouTube ausente para o yt-dlp',
            userMessage: 'Envie um link válido do YouTube.'
        });
    }

    const ffmpegPath = options.ffmpegPath || null;
    const args = buildArgs(kind, {
        url,
        outputTemplate: path.join(tempDir, 'media.%(ext)s'),
        maxBytes: options.maxBytes,
        ffmpegPath
    });

    let stdout = '';
    let stderr = '';

    try {
        let result;
        try {
            result = await runProcess(binary, args, {
                spawn: options.spawn,
                signal: options.signal,
                timeoutMs: options.timeoutMs,
                maxOutputBytes: options.maxOutputBytes
            });
        } catch (processError) {
            throw mapYtDlpError(processError);
        }
        stdout = result.stdout;
        stderr = result.stderr;

        const output = await resolveOutputFile(fsImpl, tempDir, stdout);
        if (!output) {
            throw new ApiError(ErrorCodes.UPSTREAM, {
                message: 'yt-dlp não gerou nenhum arquivo de mídia',
                userMessage: 'O yt-dlp terminou sem produzir arquivo de mídia.',
                details: { stderr: stderr.trim() || null },
                recoverable: true
            });
        }

        if (output.sizeBytes <= 0) {
            throw new ApiError(ErrorCodes.UPSTREAM, {
                message: 'yt-dlp gerou um arquivo vazio',
                userMessage: 'O yt-dlp gerou um arquivo de áudio vazio.',
                details: { filePath: output.filePath },
                recoverable: true
            });
        }

        const handle = await fsImpl.open(output.filePath, 'r');
        const header = Buffer.alloc(Math.min(output.sizeBytes, 65536));
        let read = 0;
        try {
            const chunk = await handle.read(header, 0, header.length, 0);
            read = chunk.bytesRead;
        } finally {
            await handle.close();
        }

        const container = inspectContainer(header.subarray(0, read));
        const compatible = kind === 'video'
            ? container.kind === 'mp4'
            : container.valid;

        if (!compatible) {
            throw new ApiError(ErrorCodes.UPSTREAM, {
                message: kind === 'video'
                    ? 'yt-dlp gerou um vídeo que não está em container MP4 compatível'
                    : 'yt-dlp gerou um arquivo que não é um container de áudio válido',
                userMessage: kind === 'video'
                    ? 'O vídeo baixado não está em um formato aceito pelo WhatsApp.'
                    : 'O arquivo baixado pelo yt-dlp não é um áudio válido.',
                details: { filePath: output.filePath, container: container.kind },
                recoverable: true
            });
        }

        const extension = path.extname(output.filePath).toLowerCase() || (kind === 'audio' ? '.m4a' : '.mp4');
        let filePath = output.filePath;
        let sizeBytes = output.sizeBytes;
        let remuxed = false;
        let remuxError = null;

        if (kind === 'video') {
            const remux = await remuxForCompatibility(fsImpl, filePath, options.ffmpegPath, options);
            filePath = remux.filePath;
            sizeBytes = remux.sizeBytes ?? sizeBytes;
            remuxed = remux.remuxed;
            remuxError = remux.error ?? null;

            if (remuxed) {
                const probed = await probeDuration(fsImpl, filePath, options.ffmpegPath, options);
                if (probed !== null && probed <= 0) {
                    throw new ApiError(ErrorCodes.UPSTREAM, {
                        message: 'O video processado ficou com duracao invalida',
                        userMessage: 'O video baixado ficou sem duracao valida e nao pode ser enviado.',
                        details: { filePath, duration: probed },
                        recoverable: true
                    });
                }
            }
        }

        const meta = metaFromInfo(output.info, {
            ...(input?.meta || {}),
            title: input?.meta?.title || path.basename(output.filePath, extension)
        });

        return {
            filePath,
            sizeBytes,
            meta,
            mimetype: mimetypeFor(kind, extension),
            extension,
            fileName: safeFileName(meta.title, extension),
            cleanupPaths: [tempDir],
            container: container.kind,
            remuxed,
            remuxError,
            stderr: stderr.trim() || null
        };
    } catch (error) {
        await fsImpl.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        throw error;
    }
}
