import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
    SOCIAL_PLATFORMS,
    detectSocialPlatform,
    downloadFacebook,
    downloadInstagram,
    downloadSocialMedia,
    downloadTikTok
} from '../../dados/src/funcs/api/providers/local/socialMedia.js';

const mp4Bytes = () => Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x20]),
    Buffer.from('ftypisom'),
    Buffer.from('moov'),
    Buffer.from('avc1'),
    Buffer.from('mp4a'),
    Buffer.alloc(64)
]);

function fakeSpawn({ onSpawn, exitCode = 0, stderr = '', neverExit = false } = {}) {
    const calls = [];

    const spawn = (binary, args) => {
        calls.push({ binary, args });
        const child = new EventEmitter();
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();
        child.kill = () => {};

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
            if (stderr) child.stderr.emit('data', Buffer.from(stderr));
            child.emit('close', exitCode);
        });

        return child;
    };

    spawn.calls = calls;
    return spawn;
}

async function tempRoot() {
    return fsp.mkdtemp(path.join(os.tmpdir(), 'nazuna-social-test-'));
}

test('detecta a plataforma pelo hostname', () => {
    assert.equal(detectSocialPlatform('https://www.tiktok.com/@user/video/123'), 'tiktok');
    assert.equal(detectSocialPlatform('https://vm.tiktok.com/ZMxxxx/'), 'tiktok');
    assert.equal(detectSocialPlatform('https://www.instagram.com/reel/ABC/'), 'instagram');
    assert.equal(detectSocialPlatform('https://www.facebook.com/watch?v=123'), 'facebook');
    assert.equal(detectSocialPlatform('https://exemplo.com/youtube.com'), null);
});

test('recusa URL inválida ou de outra plataforma com mensagem clara', async () => {
    const invalida = await downloadTikTok('não é uma url', { tempRoot: await tempRoot() });
    assert.equal(invalida.ok, false);
    assert.match(invalida.msg, /inválido/i);
    assert.doesNotMatch(invalida.msg, /Invalid URL|undefined|null/);

    const outra = await downloadSocialMedia('tiktok', 'https://youtube.com/watch?v=1', { tempRoot: await tempRoot() });
    assert.equal(outra.ok, false);
    assert.match(outra.msg, /não é do TikTok/i);
});

test('informa que o yt-dlp está ausente, sem quebrar o bot', async () => {
    const resultado = await downloadInstagram('https://www.instagram.com/reel/ABC/', {
        binary: null,
        tempRoot: await tempRoot()
    });

    assert.equal(resultado.ok, false);
    assert.match(resultado.msg, /yt-dlp não está disponível/i);
    assert.equal(resultado.etapa, undefined);
});

test('mapeia timeout e conteúdo restrito para mensagens compreensíveis', async () => {
    const timeout = await downloadSocialMedia('facebook', 'https://www.facebook.com/watch?v=1', {
        binary: 'yt-dlp',
        spawn: fakeSpawn({ neverExit: true }),
        timeoutMs: 60,
        tempRoot: await tempRoot()
    });
    assert.equal(timeout.ok, false);
    assert.match(timeout.msg, /demorou demais/i);

    const restrito = await downloadSocialMedia('tiktok', 'https://www.tiktok.com/@u/video/1', {
        binary: 'yt-dlp',
        spawn: fakeSpawn({ exitCode: 1, stderr: 'ERROR: Sign in to confirm you are not a bot' }),
        tempRoot: await tempRoot()
    });
    assert.equal(restrito.ok, false);
    assert.match(restrito.msg, /não liberou este conteúdo|indisponível/i);
    assert.doesNotMatch(restrito.msg, /Invalid URL|undefined/);
});

test('baixa a mídia, valida e limpa o temporário', async () => {
    const root = await tempRoot();
    const spawn = fakeSpawn({
        async onSpawn({ args, emitStdout }) {
            const template = args[args.indexOf('-o') + 1];
            const target = template.replace('%(ext)s', 'mp4');
            await fsp.writeFile(target, mp4Bytes());
            emitStdout(`${target}\n`);
        }
    });

    const resultado = await downloadSocialMedia('tiktok', 'https://www.tiktok.com/@u/video/1', {
        binary: 'yt-dlp',
        spawn,
        tempRoot: root
    });

    assert.equal(resultado.ok, true);
    assert.equal(resultado.type, 'video');
    assert.equal(resultado.mimetype, 'video/mp4');
    assert.ok(resultado.buffer.length > 0);
    assert.ok(resultado.sizeBytes > 0);

    const restantes = await fsp.readdir(root);
    assert.deepEqual(restantes, [], 'o temporário deve ser removido');

    await fsp.rm(root, { recursive: true, force: true });
});

test('rejeita arquivo vazio gerado pelo yt-dlp', async () => {
    const root = await tempRoot();
    const spawn = fakeSpawn({
        async onSpawn({ args, emitStdout }) {
            const template = args[args.indexOf('-o') + 1];
            const target = template.replace('%(ext)s', 'mp4');
            await fsp.writeFile(target, Buffer.alloc(0));
            emitStdout(`${target}\n`);
        }
    });

    const resultado = await downloadSocialMedia('instagram', 'https://www.instagram.com/reel/ABC/', {
        binary: 'yt-dlp',
        spawn,
        tempRoot: root
    });

    assert.equal(resultado.ok, false);
    assert.match(resultado.msg, /vazio|gerou arquivo/i);

    await fsp.rm(root, { recursive: true, force: true });
});

test('downloads simultâneos usam diretórios exclusivos', async () => {
    const root = await tempRoot();
    const usados = new Set();

    const spawn = fakeSpawn({
        async onSpawn({ args, emitStdout }) {
            const template = args[args.indexOf('-o') + 1];
            const target = template.replace('%(ext)s', 'mp4');
            usados.add(path.dirname(target));
            await fsp.writeFile(target, mp4Bytes());
            emitStdout(`${target}\n`);
        }
    });

    const opcoes = { binary: 'yt-dlp', spawn, tempRoot: root };
    const [a, b] = await Promise.all([
        downloadSocialMedia('tiktok', 'https://www.tiktok.com/@u/video/1', opcoes),
        downloadSocialMedia('facebook', 'https://www.facebook.com/watch?v=1', opcoes)
    ]);

    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.equal(usados.size, 2, 'cada operação deve usar um diretório próprio');

    await fsp.rm(root, { recursive: true, force: true });
});

test('tenta H.264 primeiro e cai para o próximo seletor quando o formato não existe', async () => {
    const root = await tempRoot();
    const seletoresUsados = [];

    const spawn = fakeSpawn({
        async onSpawn({ args, emitStdout, child }) {
            const selector = args[args.indexOf('-f') + 1];
            seletoresUsados.push(selector);

            if (selector.includes('h264')) {
                child.stderr.emit('data', Buffer.from('ERROR: Requested format is not available'));
                child.emit('close', 1);
                return;
            }

            const template = args[args.indexOf('-o') + 1];
            const target = template.replace('%(ext)s', 'mp4');
            await fsp.writeFile(target, mp4Bytes());
            emitStdout(`${target}\n`);
        }
    });

    const resultado = await downloadSocialMedia('tiktok', 'https://www.tiktok.com/@u/video/1', {
        binary: 'yt-dlp',
        spawn,
        tempRoot: root
    });

    assert.equal(resultado.ok, true);
    assert.equal(seletoresUsados[0], 'b[vcodec^=h264]');
    assert.equal(seletoresUsados[1], 'b[vcodec^=avc1]');
    assert.equal(resultado.formatSelector, 'b[vcodec^=avc1]');

    await fsp.rm(root, { recursive: true, force: true });
});

test('cada plataforma tem limite de tamanho definido', () => {
    for (const config of Object.values(SOCIAL_PLATFORMS)) {
        assert.ok(config.maxBytes > 0, 'precisa de limite');
        assert.ok(Array.isArray(config.hosts) && config.hosts.length > 0);
        assert.ok(Array.isArray(config.formatSelectors) && config.formatSelectors.length > 0);
        assert.match(config.formatSelectors[0], /vcodec\^=(h264|avc1)/, 'deve preferir H.264');
    }
});

test('o provider de Facebook usa o mesmo caminho compartilhado', async () => {
    const root = await tempRoot();
    const spawn = fakeSpawn({
        async onSpawn({ args, emitStdout }) {
            const template = args[args.indexOf('-o') + 1];
            const target = template.replace('%(ext)s', 'mp4');
            await fsp.writeFile(target, mp4Bytes());
            emitStdout(`${target}\n`);
        }
    });

    const resultado = await downloadFacebook('https://www.facebook.com/watch?v=1', {
        binary: 'yt-dlp',
        spawn,
        tempRoot: root
    });

    assert.equal(resultado.ok, true);
    assert.equal(resultado.type, 'video');

    await fsp.rm(root, { recursive: true, force: true });
});
