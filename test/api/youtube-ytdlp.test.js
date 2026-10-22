import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
    findFfmpegBinary,
    findYtDlpBinary,
    isYtDlpAvailable,
    prepareMediaWithYtDlp
} from '../../dados/src/funcs/api/providers/local/ytdlp.js';
import { ErrorCodes } from '../../dados/src/funcs/api/errors.js';

const videoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

function fakeSpawn({ onSpawn, exitCode = 0, stdout = '', stderr = '', neverExit = false } = {}) {
    const calls = [];

    const spawn = (binary, args, options) => {
        calls.push({ binary, args, options });
        const child = new EventEmitter();
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();
        child.killed = false;
        child.kill = () => {
            child.killed = true;
        };

        setImmediate(async () => {
            if (onSpawn) {
                await onSpawn({
                    args,
                    child,
                    emitStdout: (text) => child.stdout.emit('data', Buffer.from(text)),
                    emitStderr: (text) => child.stderr.emit('data', Buffer.from(text))
                });
            }
            if (neverExit) return;
            if (stdout) child.stdout.emit('data', Buffer.from(stdout));
            if (stderr) child.stderr.emit('data', Buffer.from(stderr));
            child.emit('close', exitCode);
        });

        return child;
    };

    spawn.calls = calls;
    return spawn;
}

function m4aBytes() {
    return Buffer.concat([
        Buffer.from([0x00, 0x00, 0x00, 0x20]),
        Buffer.from('ftypM4A '),
        Buffer.from('moov'),
        Buffer.from('mp4a'),
        Buffer.from('esds'),
        Buffer.alloc(32)
    ]);
}

function outputPathFromArgs(args, ext = 'm4a') {
    const index = args.indexOf('-o');
    if (index === -1) return null;
    const template = args[index + 1];
    if (typeof template !== 'string' || !template.includes('%(ext)s')) return null;
    return template.replace('%(ext)s', ext);
}

/** Alvo do remux (o ultimo argumento e o arquivo de saida do ffmpeg). */
function remuxTargetFromArgs(args) {
    if (!args.includes('-movflags')) return null;
    const target = args[args.length - 1];
    return typeof target === 'string' && target.includes('.compat.mp4') ? target : null;
}

function webmBytes() {
    return Buffer.concat([
        Buffer.from([0x1A, 0x45, 0xDF, 0xA3]),
        Buffer.from('webm'),
        Buffer.from('V_VP9'),
        Buffer.alloc(32)
    ]);}

async function tempRoot() {
    return fsp.mkdtemp(path.join(os.tmpdir(), 'nazuna-ytdlp-test-'));
}

test('não encontra yt-dlp quando o caminho configurado não existe', async () => {
    const dir = await tempRoot();
    const missing = path.join(dir, 'yt-dlp.exe');

    assert.equal(await findYtDlpBinary({ binary: missing, fs: fsp }), null);
    assert.equal(await isYtDlpAvailable({ binary: missing, fs: fsp }), false);
    assert.equal(await findFfmpegBinary({ binary: path.join(dir, 'ffmpeg.exe'), fs: fsp }), null);

    await fsp.rm(dir, { recursive: true, force: true });
});

test('encontra yt-dlp pelo pacote do WinGet mesmo sem LOCALAPPDATA no ambiente', async () => {
    const dir = await tempRoot();
    const packageDir = path.join(dir, 'yt-dlp.yt-dlp_teste');
    await fsp.mkdir(packageDir, { recursive: true });
    const binary = path.join(packageDir, 'yt-dlp.exe');
    await fsp.writeFile(binary, 'fake');

    const found = await findYtDlpBinary({ env: { PATH: '' }, winGetDir: dir, fs: fsp });
    assert.equal(found, binary);

    await fsp.rm(dir, { recursive: true, force: true });
});

test('encontra yt-dlp no PATH informado', async () => {
    const dir = await tempRoot();
    const binary = path.join(dir, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
    await fsp.writeFile(binary, 'fake');
    await fsp.chmod(binary, 0o755);

    const found = await findYtDlpBinary({ env: { PATH: dir }, fs: fsp });

    assert.equal(found, binary);

    await fsp.rm(dir, { recursive: true, force: true });
});

test('encontra yt-dlp instalado pelo WinGet mesmo fora do PATH', async () => {
    const dir = await tempRoot();
    const packageDir = path.join(dir, 'Microsoft', 'WinGet', 'Packages', 'yt-dlp.yt-dlp_teste');
    await fsp.mkdir(packageDir, { recursive: true });
    const binary = path.join(packageDir, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
    await fsp.writeFile(binary, 'fake');
    await fsp.chmod(binary, 0o755);

    const found = await findYtDlpBinary({ env: { LOCALAPPDATA: dir, PATH: '' }, fs: fsp });

    assert.equal(found, binary);

    await fsp.rm(dir, { recursive: true, force: true });
});

test('yt-dlp ausente devolve erro de dependência acionável', async () => {
    await assert.rejects(
        prepareMediaWithYtDlp('audio', { url: videoUrl }, { binary: null }),
        (error) => error.code === ErrorCodes.DEPENDENCY_MISSING
            && /yt-dlp/i.test(error.userMessage)
    );
});

test('sucesso simulado devolve arquivo local com mime coerente', async () => {
    const dir = await tempRoot();
    const spawn = fakeSpawn({
        async onSpawn({ args, emitStdout }) {
            const target = outputPathFromArgs(args);
            await fsp.writeFile(target, m4aBytes());
            emitStdout(`${target}\n`);
        }
    });

    const result = await prepareMediaWithYtDlp('audio', { url: videoUrl, meta: { title: 'Música' } }, {
        binary: 'yt-dlp',
        spawn,
        tempDir: dir,
        timeoutMs: 5000
    });

    assert.equal(result.mimetype, 'audio/mp4');
    assert.equal(result.extension, '.m4a');
    assert.equal(result.fileName, 'Música.m4a');
    assert.equal(result.sizeBytes, m4aBytes().length);
    assert.ok(result.filePath.endsWith('.m4a'));
    assert.equal(result.cleanupPaths.length, 1);
    assert.ok(spawn.calls[0].args.includes(videoUrl));
    assert.equal(spawn.calls[0].options.shell, false);
    assert.ok(Array.isArray(spawn.calls[0].args));

    await fsp.rm(dir, { recursive: true, force: true });
});

test('seletor de vídeo do yt-dlp fica restrito a MP4', async () => {
    const dir = await tempRoot();
    const spawn = fakeSpawn({
        async onSpawn({ args, emitStdout }) {
            const target = outputPathFromArgs(args, 'mp4');
            await fsp.writeFile(target, m4aBytes());
            emitStdout(`${target}\n`);
        }
    });

    await prepareMediaWithYtDlp('video', { url: videoUrl }, {
        binary: 'yt-dlp',
        spawn,
        tempDir: dir,
        timeoutMs: 5000
    });

    const selector = spawn.calls[0].args[spawn.calls[0].args.indexOf('-f') + 1];
    assert.equal(selector, 'best[ext=mp4][vcodec^=avc1]/b[ext=mp4][vcodec^=avc1]');
    assert.ok(!/(^|\/)(best|b)$/.test(selector.split('/').pop()), 'não deve aceitar contêiner não-MP4');

    await fsp.rm(dir, { recursive: true, force: true });
});

test('yt-dlp recebe --ffmpeg-location quando o FFmpeg está disponível', async () => {
    const dir = await tempRoot();
    const spawn = fakeSpawn({
        async onSpawn({ args, emitStdout }) {
            const remuxTarget = remuxTargetFromArgs(args);
            const target = remuxTarget || outputPathFromArgs(args, 'mp4');
            if (!target) return;
            await fsp.writeFile(target, m4aBytes());
            if (!remuxTarget) emitStdout(`${target}\n`);
        }
    });

    const result = await prepareMediaWithYtDlp('video', { url: videoUrl }, {
        binary: 'yt-dlp',
        spawn,
        tempDir: dir,
        timeoutMs: 5000,
        ffmpegPath: 'C:/bin/ffmpeg.exe'
    });

    const args = spawn.calls[0].args;
    assert.ok(args.includes('--ffmpeg-location'));
    assert.equal(args[args.indexOf('--ffmpeg-location') + 1], 'C:/bin/ffmpeg.exe');
    assert.equal(
        args[args.indexOf('-f') + 1],
        'best[ext=mp4][vcodec^=avc1]/b[ext=mp4][vcodec^=avc1]/bv*[vcodec^=avc1][ext=mp4]+ba[ext=m4a]'
    );
    assert.equal(result.mimetype, 'video/mp4');
    assert.equal(result.extension, '.mp4');

    await fsp.rm(dir, { recursive: true, force: true });
});

test('vídeo em container não-MP4 é rejeitado', async () => {
    const dir = await tempRoot();
    const spawn = fakeSpawn({
        async onSpawn({ args, emitStdout }) {
            const remuxTarget = remuxTargetFromArgs(args);
            const target = remuxTarget || outputPathFromArgs(args, 'webm');
            if (!target) return;
            await fsp.writeFile(target, webmBytes());
            if (!remuxTarget) emitStdout(`${target}\n`);
        }
    });

    await assert.rejects(
        prepareMediaWithYtDlp('video', { url: videoUrl }, {
            binary: 'yt-dlp',
            spawn,
            tempDir: dir,
            timeoutMs: 5000
        }),
        (error) => error.code === ErrorCodes.UPSTREAM
            && /MP4/i.test(error.message)
            && error.details.container === 'webm'
    );

    const leftovers = await fsp.readdir(dir);
    assert.deepEqual(leftovers, []);

    await fsp.rm(dir, { recursive: true, force: true });
});

test('seletor de video do yt-dlp fica restrito a H.264 (avc1) para o iOS', async () => {
    const dir = await tempRoot();
    const spawn = fakeSpawn({
        async onSpawn({ args, emitStdout }) {
            const target = outputPathFromArgs(args, 'mp4');
            await fsp.writeFile(target, m4aBytes());
            emitStdout(`${target}\n`);
        }
    });

    await prepareMediaWithYtDlp('video', { url: videoUrl }, {
        binary: 'yt-dlp',
        spawn,
        tempDir: dir,
        timeoutMs: 5000
    });

    const selector = spawn.calls[0].args[spawn.calls[0].args.indexOf('-f') + 1];
    assert.match(selector, /vcodec\^=avc1/);
    assert.doesNotMatch(selector, /av01|vp9|vp09/);

    await fsp.rm(dir, { recursive: true, force: true });
});

test('video passa por remux com faststart quando o ffmpeg existe', async () => {
    const dir = await tempRoot();
    const spawn = fakeSpawn({
        async onSpawn({ args, emitStdout }) {
            const isRemux = args.includes('-c') && args.includes('copy');
            const target = isRemux
                ? args[args.length - 1]
                : outputPathFromArgs(args, 'mp4');
            await fsp.writeFile(target, m4aBytes());
            if (!isRemux) emitStdout(`${target}\n`);
        }
    });

    const result = await prepareMediaWithYtDlp('video', { url: videoUrl }, {
        binary: 'yt-dlp',
        spawn,
        tempDir: dir,
        timeoutMs: 5000,
        ffmpegPath: 'C:/bin/ffmpeg.exe'
    });

    const remuxCall = spawn.calls.find((call) => call.args.includes('-movflags'));
    assert.ok(remuxCall, 'o remux deve ser executado');
    assert.ok(remuxCall.args.includes('+faststart'));
    assert.equal(result.remuxed, true);
    assert.match(result.filePath, /\.compat\.mp4$/);
    assert.equal(result.mimetype, 'video/mp4');

    await fsp.rm(dir, { recursive: true, force: true });
});

test('falha do ffmpeg mantem o arquivo original e sinaliza o erro', async () => {
    const dir = await tempRoot();
    const spawn = fakeSpawn({
        async onSpawn({ args, emitStdout, child }) {
            const isRemux = args.includes('-c') && args.includes('copy');
            if (isRemux) {
                child.emit('close', 1);
                return;
            }
            const target = outputPathFromArgs(args, 'mp4');
            await fsp.writeFile(target, m4aBytes());
            emitStdout(`${target}\n`);
        }
    });

    const result = await prepareMediaWithYtDlp('video', { url: videoUrl }, {
        binary: 'yt-dlp',
        spawn,
        tempDir: dir,
        timeoutMs: 5000,
        ffmpegPath: 'C:/bin/ffmpeg.exe'
    });

    assert.equal(result.remuxed, false);
    assert.ok(result.remuxError);
    assert.match(result.filePath, /\.mp4$/);
    assert.doesNotMatch(result.filePath, /\.compat\.mp4$/);

    await fsp.rm(dir, { recursive: true, force: true });
});

test('video com duracao invalida e rejeitado antes do envio', async () => {
    const dir = await tempRoot();
    const binDir = await tempRoot();
    const ffmpegPath = path.join(binDir, 'ffmpeg.exe');
    await fsp.writeFile(ffmpegPath, 'fake');
    await fsp.writeFile(path.join(binDir, 'ffprobe.exe'), 'fake');

    const spawn = fakeSpawn({
        async onSpawn({ args, emitStdout }) {
            if (args.includes('-show_entries')) {
                emitStdout(JSON.stringify({ format: { duration: '0.000000' } }));
                return;
            }
            const isRemux = args.includes('-c') && args.includes('copy');
            const target = isRemux
                ? args[args.length - 1]
                : outputPathFromArgs(args, 'mp4');
            await fsp.writeFile(target, m4aBytes());
            if (!isRemux) emitStdout(`${target}\n`);
        }
    });

    await assert.rejects(
        prepareMediaWithYtDlp('video', { url: videoUrl }, {
            binary: 'yt-dlp',
            spawn,
            tempDir: dir,
            timeoutMs: 5000,
            ffmpegPath
        }),
        (error) => error.code === ErrorCodes.UPSTREAM
            && /duracao invalida/i.test(error.message)
    );

    const leftovers = await fsp.readdir(dir);
    assert.deepEqual(leftovers, []);

    await fsp.rm(dir, { recursive: true, force: true });
    await fsp.rm(binDir, { recursive: true, force: true });
});

test('audio nao passa por remux nem por ffprobe', async () => {
    const dir = await tempRoot();
    const spawn = fakeSpawn({
        async onSpawn({ args, emitStdout }) {
            const target = outputPathFromArgs(args, 'm4a');
            await fsp.writeFile(target, m4aBytes());
            emitStdout(`${target}\n`);
        }
    });

    const result = await prepareMediaWithYtDlp('audio', { url: videoUrl }, {
        binary: 'yt-dlp',
        spawn,
        tempDir: dir,
        timeoutMs: 5000,
        ffmpegPath: 'C:/bin/ffmpeg.exe'
    });

    assert.equal(result.remuxed, false);
    assert.equal(spawn.calls.length, 1);
    assert.equal(result.mimetype, 'audio/mp4');

    await fsp.rm(dir, { recursive: true, force: true });
});

test('metadados do yt-dlp enriquecem o título do arquivo local', async () => {
    const dir = await tempRoot();
    const spawn = fakeSpawn({
        async onSpawn({ args, emitStdout }) {
            const target = outputPathFromArgs(args);
            await fsp.writeFile(target, m4aBytes());
            emitStdout(`${JSON.stringify({
                id: 'dQw4w9WgXcQ',
                title: 'Billie Jean',
                uploader: 'Michael Jackson',
                duration: 294,
                webpage_url: videoUrl,
                view_count: 12345,
                upload_date: '19830101',
                thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hq.jpg'
            })}\n${target}\n`);
        }
    });

    const result = await prepareMediaWithYtDlp('audio', { url: videoUrl }, {
        binary: 'yt-dlp',
        spawn,
        tempDir: dir,
        timeoutMs: 5000
    });

    assert.equal(result.meta.title, 'Billie Jean');
    assert.equal(result.meta.author, 'Michael Jackson');
    assert.equal(result.meta.durationSeconds, 294);
    assert.equal(result.meta.videoId, 'dQw4w9WgXcQ');
    assert.equal(result.meta.views, 12345);
    assert.equal(result.meta.ago, '1983-01-01');
    assert.equal(result.fileName, 'Billie Jean.m4a');

    await fsp.rm(dir, { recursive: true, force: true });
});

test('timeout do yt-dlp é reportado e temporários são removidos', async () => {
    const dir = await tempRoot();
    const spawn = fakeSpawn({ neverExit: true });

    await assert.rejects(
        prepareMediaWithYtDlp('audio', { url: videoUrl }, {
            binary: 'yt-dlp',
            spawn,
            tempDir: dir,
            timeoutMs: 60
        }),
        (error) => error.code === ErrorCodes.TIMEOUT
    );

    const leftovers = await fsp.readdir(dir);
    assert.deepEqual(leftovers, []);

    await fsp.rm(dir, { recursive: true, force: true });
});

test('falha do processo yt-dlp propaga o stderr original', async () => {
    const dir = await tempRoot();
    const spawn = fakeSpawn({
        exitCode: 1,
        stderr: 'ERROR: Sign in to confirm you\'re not a bot'
    });

    await assert.rejects(
        prepareMediaWithYtDlp('audio', { url: videoUrl }, {
            binary: 'yt-dlp',
            spawn,
            tempDir: dir,
            timeoutMs: 5000
        }),
        (error) => error.code === ErrorCodes.UPSTREAM
            && /not a bot/.test(error.message)
            && /not a bot/.test(error.details.stderr)
    );

    const leftovers = await fsp.readdir(dir);
    assert.deepEqual(leftovers, []);

    await fsp.rm(dir, { recursive: true, force: true });
});

test('arquivo vazio gerado pelo yt-dlp é rejeitado', async () => {
    const dir = await tempRoot();
    const spawn = fakeSpawn({
        async onSpawn({ args, emitStdout }) {
            const target = outputPathFromArgs(args);
            await fsp.writeFile(target, '');
            emitStdout(`${target}\n`);
        }
    });

    await assert.rejects(
        prepareMediaWithYtDlp('audio', { url: videoUrl }, {
            binary: 'yt-dlp',
            spawn,
            tempDir: dir,
            timeoutMs: 5000
        }),
        (error) => error.code === ErrorCodes.UPSTREAM
            && /vazio/i.test(error.message)
    );

    const leftovers = await fsp.readdir(dir);
    assert.deepEqual(leftovers, []);

    await fsp.rm(dir, { recursive: true, force: true });
});

test('arquivo inválido gerado pelo yt-dlp é rejeitado', async () => {
    const dir = await tempRoot();
    const spawn = fakeSpawn({
        async onSpawn({ args, emitStdout }) {
            const target = outputPathFromArgs(args);
            await fsp.writeFile(target, '<html>blocked</html>');
            emitStdout(`${target}\n`);
        }
    });

    await assert.rejects(
        prepareMediaWithYtDlp('audio', { url: videoUrl }, {
            binary: 'yt-dlp',
            spawn,
            tempDir: dir,
            timeoutMs: 5000
        }),
        (error) => error.code === ErrorCodes.UPSTREAM
            && /container/i.test(error.message)
    );

    const leftovers = await fsp.readdir(dir);
    assert.deepEqual(leftovers, []);

    await fsp.rm(dir, { recursive: true, force: true });
});

test('limite de tamanho e seletor de formato são repassados ao yt-dlp', async () => {
    const dir = await tempRoot();
    const spawn = fakeSpawn({
        async onSpawn({ args, emitStdout }) {
            const target = outputPathFromArgs(args);
            await fsp.writeFile(target, m4aBytes());
            emitStdout(`${target}\n`);
        }
    });

    await prepareMediaWithYtDlp('audio', { url: videoUrl }, {
        binary: 'yt-dlp',
        spawn,
        tempDir: dir,
        timeoutMs: 5000,
        maxBytes: 5 * 1024 * 1024
    });

    const args = spawn.calls[0].args;
    assert.ok(args.includes('--max-filesize'));
    assert.equal(args[args.indexOf('--max-filesize') + 1], String(5 * 1024 * 1024));
    assert.ok(args.includes('-f'));
    assert.match(args[args.indexOf('-f') + 1], /^bestaudio/);
    assert.equal(args[args.length - 1], videoUrl);

    await fsp.rm(dir, { recursive: true, force: true });
});
