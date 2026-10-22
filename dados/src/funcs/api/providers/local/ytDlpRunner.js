/**
 * Camada compartilhada de mídia via yt-dlp.
 *
 * Concentra o que é comum a YouTube, TikTok, Instagram, Facebook e Twitter/X:
 *   - validação de URL e de binário
 *   - execução segura (spawn com argumentos separados, sem shell)
 *   - timeout, cancelamento e limite de tamanho
 *   - diretório temporário exclusivo por operação
 *   - validação do arquivo gerado (existe, não vazio, container válido)
 *   - limpeza garantida
 *   - mensagens de erro por etapa
 *
 * Nada aqui registra cookies, tokens, chaves ou query strings assinadas.
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn as defaultSpawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DEFAULT_TIMEOUT_MS = 180000;
const DEFAULT_MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const MAX_MEDIA_BYTES = 96 * 1024 * 1024;

const WINDOWS_BINARY_NAMES = ['yt-dlp.exe', 'yt-dlp.cmd', 'yt-dlp.bat', 'yt-dlp'];
const UNIX_BINARY_NAMES = ['yt-dlp'];
const WINDOWS_FFMPEG_NAMES = ['ffmpeg.exe', 'ffmpeg.cmd', 'ffmpeg'];
const UNIX_FFMPEG_NAMES = ['ffmpeg'];

export function binaryNames(kind) {
    if (kind === 'ffmpeg') {
        return process.platform === 'win32' ? WINDOWS_FFMPEG_NAMES : UNIX_FFMPEG_NAMES;
    }
    return process.platform === 'win32' ? WINDOWS_BINARY_NAMES : UNIX_BINARY_NAMES;
}

function extraLookupDirs(kind, env) {
    if (process.platform !== 'win32') return [];

    const dirs = [];

    if (kind === 'ffmpeg') {
        if (env.ProgramFiles) dirs.push(path.join(env.ProgramFiles, 'ffmpeg', 'bin'));
        if (env.ProgramFiles) dirs.push(path.join(env.ProgramFiles, 'ffmpeg'));
    } else {
        if (env.LOCALAPPDATA) {
            dirs.push(path.join(env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Links'));
            dirs.push(path.join(env.LOCALAPPDATA, 'Programs', 'yt-dlp'));
        }
        if (env.ProgramFiles) dirs.push(path.join(env.ProgramFiles, 'yt-dlp'));
    }

    return dirs;
}

function pathDirs(env) {
    const raw = env?.PATH || env?.Path || env?.path || '';
    return String(raw).split(path.delimiter).map((entry) => entry.trim()).filter(Boolean);
}

async function isExecutable(fsImpl, filePath) {
    try {
        await fsImpl.access(filePath, fsConstants.X_OK);
        const stat = await fsImpl.stat(filePath);
        return stat.isFile();
    } catch {
        return false;
    }
}

async function findInWinGetPackages(kind, options = {}) {
    if (process.platform !== 'win32') return null;

    const fsImpl = options.fs || fsp;
    const env = options.env || process.env;
    const roots = [];

    const addRoot = (root) => {
        if (root && !roots.includes(root)) roots.push(root);
    };

    addRoot(options.winGetDir);
    if (env.LOCALAPPDATA) addRoot(path.join(env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Packages'));

    const home = env.USERPROFILE || env.HOME || os.homedir();
    if (home) addRoot(path.join(home, 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages'));
    addRoot(path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages'));

    const prefix = kind === 'ffmpeg' ? 'yt-dlp.FFmpeg' : 'yt-dlp.yt-dlp';

    for (const root of roots) {
        let entries = [];
        try {
            entries = await fsImpl.readdir(root, { withFileTypes: true });
        } catch {
            continue;
        }

        for (const entry of entries) {
            if (!entry.isDirectory() || !entry.name.startsWith(prefix)) continue;
            const found = await findExecutableInTree(fsImpl, path.join(root, entry.name), binaryNames(kind), 2);
            if (found) return found;
        }
    }

    return null;
}

async function findExecutableInTree(fsImpl, dir, names, depth) {
    if (depth < 0) return null;

    let entries = [];
    try {
        entries = await fsImpl.readdir(dir, { withFileTypes: true });
    } catch {
        return null;
    }

    for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (!names.includes(entry.name)) continue;
        const candidate = path.join(dir, entry.name);
        if (await isExecutable(fsImpl, candidate)) return candidate;
    }

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const found = await findExecutableInTree(fsImpl, path.join(dir, entry.name), names, depth - 1);
        if (found) return found;
    }

    return null;
}

export async function findBinary(kind, options = {}) {
    const fsImpl = options.fs || fsp;
    const env = options.env || process.env;
    const configured = String(options.binary || '').trim();

    if (configured) {
        return await isExecutable(fsImpl, configured) ? configured : null;
    }

    for (const dir of extraLookupDirs(kind, env)) {
        for (const name of binaryNames(kind)) {
            const candidate = path.join(dir, name);
            if (await isExecutable(fsImpl, candidate)) return candidate;
        }
    }

    for (const dir of pathDirs(env)) {
        for (const name of binaryNames(kind)) {
            const candidate = path.join(dir, name);
            if (await isExecutable(fsImpl, candidate)) return candidate;
        }
    }

    const found = await findInWinGetPackages(kind, { ...options, fs: fsImpl, env });
    if (found) return found;

    // Ultimo recurso: a propria pasta do projeto (bin/yt-dlp.exe) e o diretorio
    // do node_modules, que podem ter sido usados em uma instalacao local.
    const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');
    for (const dir of [path.join(projectRoot, 'bin'), path.join(projectRoot, 'node_modules', '.bin')]) {
        for (const name of binaryNames(kind)) {
            const candidate = path.join(dir, name);
            if (await isExecutable(fsImpl, candidate)) return candidate;
        }
    }

    return null;
}

export function findYtDlpBinary(options = {}) {
    return findBinary('yt-dlp', options);
}

export function findFfmpegBinary(options = {}) {
    return findBinary('ffmpeg', options);
}

export function isValidHttpUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return false;
    try {
        const url = new URL(value.trim());
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

export function hostMatches(url, hosts) {
    if (!isValidHttpUrl(url)) return false;
    let hostname;
    try {
        hostname = new URL(url).hostname.toLowerCase().replace(/\.$/, '');
    } catch {
        return false;
    }
    return hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

export function runProcess(binary, args, options = {}) {
    const spawnImpl = options.spawn || defaultSpawn;
    const maxOutput = options.maxOutputBytes || DEFAULT_MAX_OUTPUT_BYTES;

    return new Promise((resolve, reject) => {
        let child;

        try {
            child = spawnImpl(binary, args, {
                shell: false,
                windowsHide: true,
                stdio: ['ignore', 'pipe', 'pipe']
            });
        } catch (error) {
            reject(new Error(`Falha ao iniciar ${binary}: ${error.message}`));
            return;
        }

        const stdout = { text: '', bytes: 0 };
        const stderr = { text: '', bytes: 0 };
        let settled = false;
        let timer = null;
        let killRequested = false;

        const finish = (callback, value) => {
            if (settled) return;
            settled = true;
            if (timer) clearTimeout(timer);
            options.signal?.removeEventListener?.('abort', onAbort);
            callback(value);
        };

        function kill() {
            if (killRequested) return;
            killRequested = true;
            try {
                child.kill?.();
            } catch {
                // processo já encerrado
            }
        }

        function onAbort() {
            kill();
            finish(reject, new Error('Download cancelado'));
        }

        if (options.signal?.aborted) {
            onAbort();
            return;
        }

        options.signal?.addEventListener?.('abort', onAbort, { once: true });

        timer = setTimeout(() => {
            kill();
            finish(reject, new Error(`Tempo limite excedido (${options.timeoutMs || DEFAULT_TIMEOUT_MS}ms)`));
        }, Math.max(1, Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS));

        const collect = (stream, state) => {
            if (!stream || typeof stream.on !== 'function') return;
            stream.on('data', (chunk) => {
                if (state.bytes >= maxOutput) return;
                const text = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
                state.bytes += text.length;
                state.text += text;
            });
        };

        collect(child.stdout, stdout);
        collect(child.stderr, stderr);

        child.on?.('error', (error) => {
            finish(reject, new Error(`Não foi possível executar ${path.basename(binary)}: ${error.message}`));
        });

        child.on?.('close', (code) => {
            if (killRequested) return;
            if (Number(code) === 0) {
                finish(resolve, { stdout: stdout.text, stderr: stderr.text });
                return;
            }

            const linhas = String(stderr.text || '')
                .split(/\r?\n/)
                .map((linha) => linha.trim())
                .filter(Boolean);
            const comErro = linhas.filter((linha) => /^ERROR/i.test(linha) || /\berror\b/i.test(linha));
            const resumo = (comErro.length ? comErro : linhas).slice(-2).join(' | ').slice(0, 800);

            finish(reject, new Error(resumo || `código de saída ${code}`));
        });
    });
}

export function inspectContainer(buffer) {
    if (!buffer || buffer.length < 4) return { kind: 'desconhecido', valid: false };

    const head = buffer.subarray(0, 16).toString('latin1');
    const isMp4 = buffer.length >= 12 && buffer.subarray(4, 8).toString('latin1') === 'ftyp';
    const mp4Audio = isMp4 && (buffer.includes(Buffer.from('mp4a'))
        || buffer.includes(Buffer.from('esds'))
        || buffer.includes(Buffer.from('Opus')));
    const isWebm = buffer.length >= 4
        && buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3;
    const webmAudio = isWebm && buffer.includes(Buffer.from('webm'))
        && (buffer.includes(Buffer.from('OpusHead'))
            || buffer.includes(Buffer.from('A_OPUS'))
            || buffer.includes(Buffer.from('A_VORBIS')));
    const isMp3 = (buffer.length >= 3 && buffer.subarray(0, 3).toString('latin1') === 'ID3')
        || (buffer.length >= 2 && buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0);

    if (mp4Audio) return { kind: 'mp4', valid: true };
    if (webmAudio) return { kind: 'webm', valid: true };
    if (isMp3) return { kind: 'mp3', valid: true };
    if (isMp4) return { kind: 'mp4', valid: true };
    if (isWebm) return { kind: 'webm', valid: true };
    return { kind: 'desconhecido', valid: false };
}

export function mimetypeForExtension(extension, fallback = 'application/octet-stream') {
    const ext = String(extension || '').toLowerCase();
    const table = {
        '.mp4': 'video/mp4',
        '.m4v': 'video/mp4',
        '.webm': 'video/webm',
        '.mkv': 'video/x-matroska',
        '.mov': 'video/quicktime',
        '.m4a': 'audio/mp4',
        '.mp3': 'audio/mpeg',
        '.opus': 'audio/ogg',
        '.ogg': 'audio/ogg',
        '.wav': 'audio/wav',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.gif': 'image/gif'
    };
    return table[ext] || fallback;
}

/**
 * Baixa uma mídia com o yt-dlp em um diretório temporário exclusivo.
 * @returns {Promise<{filePath: string, sizeBytes: number, extension: string, mimetype: string, title: string, cleanup: Function}>}
 */
export async function downloadMediaWithYtDlp(url, options = {}) {
    const fsImpl = options.fs || fsp;
    const binary = String(options.binary || '').trim();

    if (!isValidHttpUrl(url)) {
        throw new Error('URL inválida');
    }

    if (!binary) {
        throw new Error('yt-dlp não está disponível neste ambiente');
    }

    const tempRoot = typeof options.tempRoot === 'string' && options.tempRoot.trim()
        ? options.tempRoot
        : path.join(os.tmpdir(), 'nazuna-media');
    await fsImpl.mkdir(tempRoot, { recursive: true, mode: 0o700 });
    const tempDir = await fsImpl.mkdtemp(path.join(tempRoot, 'op-'));
    const cleanup = async () => {
        await fsImpl.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    };

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
        path.join(tempDir, 'media.%(ext)s')
    ];

    if (Number(options.maxBytes) > 0) {
        args.push('--max-filesize', String(Math.floor(Number(options.maxBytes))));
    }

    if (options.ffmpegPath) {
        args.push('--ffmpeg-location', options.ffmpegPath);
    }

    if (Array.isArray(options.extraArgs) && options.extraArgs.length) {
        args.push(...options.extraArgs);
    }

    args.push(String(url).trim());

    let stdout = '';
    let stderr = '';

    try {
        const result = await runProcess(binary, args, {
            spawn: options.spawn,
            signal: options.signal,
            timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
            maxOutputBytes: options.maxOutputBytes
        });
        stdout = result.stdout;
        stderr = result.stderr;
    } catch (error) {
        await cleanup();
        throw new Error(error.message);
    }

    const info = parseInfoJson(stdout);
    const output = await resolveOutputFile(fsImpl, tempDir, stdout);

    if (!output) {
        await cleanup();
        throw new Error('o yt-dlp não gerou nenhum arquivo de mídia');
    }

    const { filePath, sizeBytes } = output;
    const stat = await fsImpl.stat(filePath);

    if (!stat.isFile() || stat.size <= 0) {
        await cleanup();
        throw new Error('o arquivo baixado veio vazio');
    }

    if (stat.size > MAX_MEDIA_BYTES) {
        await cleanup();
        throw new Error('o arquivo baixado excede o limite permitido');
    }

    const header = Buffer.alloc(Math.min(stat.size, 65536));
    const handle = await fsImpl.open(filePath, 'r');
    let read = 0;
    try {
        const chunk = await handle.read(header, 0, header.length, 0);
        read = chunk.bytesRead;
    } finally {
        await handle.close();
    }

    const container = inspectContainer(header.subarray(0, read));
    const extension = path.extname(filePath).toLowerCase();

    return {
        filePath,
        sizeBytes: stat.size,
        extension,
        mimetype: mimetypeForExtension(extension),
        container: container.kind,
        title: String(info?.title || '').trim(),
        uploader: String(info?.uploader || info?.channel || '').trim(),
        durationSeconds: Number(info?.duration) || 0,
        thumbnail: typeof info?.thumbnail === 'string' ? info.thumbnail : null,
        stderr: stderr.trim() || null,
        cleanup
    };
}

export function parseInfoJson(stdout) {
    const lines = String(stdout || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    for (let index = lines.length - 1; index >= 0; index--) {
        const line = lines[index];
        if (!line.startsWith('{')) continue;
        try {
            const parsed = JSON.parse(line);
            if (parsed && typeof parsed === 'object') return parsed;
        } catch {
            // linha truncada ou inválida
        }
    }

    return null;
}

export async function resolveOutputFile(fsImpl, tempDir, stdout) {
    const lines = String(stdout || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .reverse();

    for (const line of lines) {
        if (line.startsWith('{')) continue;
        try {
            const stat = await fsImpl.stat(line);
            if (stat.isFile() && stat.size > 0) {
                return { filePath: line, sizeBytes: stat.size, info: parseInfoJson(stdout) };
            }
        } catch {
            // tenta a próxima linha
        }
    }

    const entries = await fsImpl.readdir(tempDir);
    let best = null;

    for (const entry of entries) {
        if (entry.endsWith('.part') || entry.endsWith('.ytdl')) continue;
        const candidate = path.join(tempDir, entry);
        try {
            const stat = await fsImpl.stat(candidate);
            if (!stat.isFile()) continue;
            if (!best || stat.size > best.sizeBytes) {
                best = { filePath: candidate, sizeBytes: stat.size };
            }
        } catch {
            // ignora entradas removidas
        }
    }

    if (!best) return null;
    return { ...best, info: parseInfoJson(stdout) };
}

export async function readFileSafe(filePath, limit = MAX_MEDIA_BYTES) {
    const stat = await fsp.stat(filePath);
    if (stat.size > limit) throw new Error('arquivo acima do limite permitido');
    return fsp.readFile(filePath);
}

export { fs, fsp };
