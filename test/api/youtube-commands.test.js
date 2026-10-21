import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
    autoDownloadYoutube,
    buildPlayCaption,
    describeMediaForLog,
    isYoutubeUrl,
    runYoutubeCommand
} from '../../dados/src/funcs/downloads/youtubeCommands.js';
import { run } from '../../dados/src/funcs/api/index.js';
import { BoundedCache } from '../../dados/src/funcs/api/cache.js';
import { ConcurrencyLimiter } from '../../dados/src/funcs/api/limiter.js';
import { createMediaSource } from '../../dados/src/funcs/api/media.js';
import { ApiError, ErrorCodes } from '../../dados/src/funcs/api/errors.js';

const video = {
    videoId: 'dQw4w9WgXcQ',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title: 'Música de teste',
    author: 'Canal',
    durationSeconds: 120,
    timestamp: '2:00',
    views: 1000,
    ago: 'há 1 dia',
    description: 'Descrição',
    thumbnail: 'https://cdn.example/thumb.jpg'
};

function fakeMedia(cleanupCalls) {
    return {
        filePath: 'C:/tmp/media',
        sizeBytes: 4,
        meta: { title: 'Mídia', durationSeconds: 120 },
        mimetype: 'audio/mpeg',
        fileName: 'media.mp3',
        openStream: () => null,
        cleanup: async () => {
            cleanupCalls.count++;
        }
    };
}

function harness({ failAudioSend = false, runApi } = {}) {
    const replies = [];
    const messages = [];
    const calls = [];
    const cleanupCalls = { count: 0 };

    const nazu = {
        async sendMessage(from, content, options) {
            messages.push({ from, content, options });
            for (const mediaKey of ['audio', 'video', 'document']) {
                const stream = content[mediaKey]?.stream;
                if (stream && typeof stream.on === 'function') {
                    stream.on('error', () => {});
                    if (typeof stream.resume === 'function') stream.resume();
                }
            }
            if (failAudioSend && content.audio) {
                throw new Error('size limit exceeded');
            }
            return { key: { id: 'x' } };
        }
    };

    const api = runApi || (async (feature, input, options) => {
        calls.push({ feature, input, options });

        if (feature === 'youtube.search') return { data: video };
        if (feature === 'youtube.audio') {
            return { media: fakeMedia(cleanupCalls), meta: video };
        }
        if (feature === 'youtube.video') {
            return { media: fakeMedia(cleanupCalls), meta: video };
        }

        throw new Error(`feature inesperada: ${feature}`);
    });

    return {
        replies,
        messages,
        calls,
        cleanupCalls,
        context: {
            command: 'play',
            q: '',
            prefix: '.',
            reply: async (text) => replies.push(text),
            nazu,
            from: 'grupo@g.us',
            info: { key: { id: 'msg' } },
            nomebot: 'Nazuna',
            botVersion: '1.0',
            runApi: api
        }
    };
}

function fakeStream() {
    return {
        destroyed: false,
        destroy() {
            this.destroyed = true;
        }
    };
}

test('o arquivo de mídia existe durante o envio e é removido ao final', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nazuna-send-'));
    const filePath = path.join(dir, 'musica.m4a');
    await fs.writeFile(filePath, 'conteudo-de-audio');

    let existsDuringSend = null;
    let contentDuringSend = null;
    const h = harness();

    h.context.nazu.sendMessage = async (from, content, options) => {
        h.messages.push({ from, content, options });
        if (content.audio?.stream) {
            const chunks = [];
            for await (const chunk of content.audio.stream) chunks.push(chunk);
            contentDuringSend = Buffer.concat(chunks).toString('utf8');
            existsDuringSend = await fs.stat(filePath).then(() => true).catch(() => false);
        }
        return { key: { id: 'x' } };
    };

    h.context.runApi = async (feature) => {
        if (feature === 'youtube.audio') {
            return {
                media: createMediaSource({
                    filePath,
                    sizeBytes: 17,
                    meta: { title: 'Música', durationSeconds: 120 },
                    mimetype: 'audio/mp4',
                    fileName: 'musica.m4a'
                })
            };
        }
        throw new Error(`feature inesperada: ${feature}`);
    };
    h.context.q = 'https://youtu.be/dQw4w9WgXcQ';

    await runYoutubeCommand(h.context);

    const sent = h.messages.find((item) => item.content.audio);
    assert.ok(sent, 'a mensagem de áudio deve ter sido enviada');
    assert.equal(existsDuringSend, true);
    assert.equal(contentDuringSend, 'conteudo-de-audio');
    assert.equal(sent.content.mimetype, 'audio/mp4');
    assert.equal(sent.content.fileName, 'musica.m4a');
    assert.equal(sent.content.seconds, 120);

    await assert.rejects(fs.stat(filePath), (error) => error.code === 'ENOENT');
    await fs.rm(dir, { recursive: true, force: true });
});

test('falha na limpeza não mascara o envio bem-sucedido', async () => {
    const h = harness();
    const stream = fakeStream();

    h.context.runApi = async (feature) => {
        if (feature === 'youtube.audio') {
            return {
                media: {
                    fileName: 'musica.m4a',
                    mimetype: 'audio/mp4',
                    meta: { durationSeconds: 60 },
                    openStream: () => stream,
                    cleanup: async () => {
                        throw new Error('EPERM: operation not permitted, unlink');
                    }
                }
            };
        }
        throw new Error(`feature inesperada: ${feature}`);
    };
    h.context.q = 'https://youtu.be/dQw4w9WgXcQ';

    await runYoutubeCommand(h.context);

    assert.ok(h.messages.some((item) => item.content.audio));
    assert.equal(h.replies.filter((text) => text.startsWith('❌')).length, 0);
});

test('o stream de áudio que falhou é fechado antes do fallback de documento', async () => {
    const streams = [];
    const h = harness();

    h.context.nazu.sendMessage = async (from, content, options) => {
        h.messages.push({ from, content, options });
        if (content.audio) throw new Error('size limit exceeded');
        return { key: { id: 'x' } };
    };

    h.context.runApi = async (feature) => {
        if (feature === 'youtube.audio') {
            return {
                media: {
                    fileName: 'musica.m4a',
                    mimetype: 'audio/mp4',
                    meta: { durationSeconds: 60 },
                    openStream: () => {
                        const stream = fakeStream();
                        streams.push(stream);
                        return stream;
                    },
                    cleanup: async () => {}
                }
            };
        }
        throw new Error(`feature inesperada: ${feature}`);
    };
    h.context.q = 'https://youtu.be/dQw4w9WgXcQ';

    await runYoutubeCommand(h.context);

    assert.equal(streams.length, 2);
    assert.notEqual(streams[0], streams[1]);
    assert.equal(streams[0].destroyed, true);
    assert.ok(h.messages.some((item) => item.content.document));
});

test('vídeo mantém o arquivo acessível durante o envio e limpa depois', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nazuna-send-'));
    const filePath = path.join(dir, 'video.mp4');
    await fs.writeFile(filePath, 'conteudo-de-video');

    let existsDuringSend = null;
    let contentDuringSend = null;
    const h = harness();

    h.context.nazu.sendMessage = async (from, content, options) => {
        h.messages.push({ from, content, options });
        if (content.video?.stream) {
            const chunks = [];
            for await (const chunk of content.video.stream) chunks.push(chunk);
            contentDuringSend = Buffer.concat(chunks).toString('utf8');
            existsDuringSend = await fs.stat(filePath).then(() => true).catch(() => false);
        }
        return { key: { id: 'x' } };
    };

    h.context.runApi = async (feature) => {
        if (feature === 'youtube.video') {
            return {
                media: createMediaSource({
                    filePath,
                    sizeBytes: 16,
                    meta: { title: 'Vídeo', durationSeconds: 60 },
                    mimetype: 'video/mp4',
                    fileName: 'video.mp4'
                })
            };
        }
        throw new Error(`feature inesperada: ${feature}`);
    };
    h.context.command = 'ytmp4';
    h.context.q = 'https://youtu.be/dQw4w9WgXcQ';

    await runYoutubeCommand(h.context);

    const sent = h.messages.find((item) => item.content.video);
    assert.ok(sent, 'a mensagem de vídeo deve ter sido enviada');
    assert.equal(existsDuringSend, true);
    assert.equal(contentDuringSend, 'conteudo-de-video');
    assert.equal(sent.content.mimetype, 'video/mp4');
    assert.equal(sent.content.fileName, 'video.mp4');

    await assert.rejects(fs.stat(filePath), (error) => error.code === 'ENOENT');
    await fs.rm(dir, { recursive: true, force: true });
});

test('autodownload envia o arquivo e remove o temporário', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nazuna-send-'));
    const filePath = path.join(dir, 'autodl.m4a');
    await fs.writeFile(filePath, 'conteudo-autodl');

    let contentDuringSend = null;
    const h = harness();

    h.context.nazu.sendMessage = async (from, content, options) => {
        h.messages.push({ from, content, options });
        if (content.audio?.stream) {
            const chunks = [];
            for await (const chunk of content.audio.stream) chunks.push(chunk);
            contentDuringSend = Buffer.concat(chunks).toString('utf8');
        }
        return { key: { id: 'x' } };
    };

    h.context.runApi = async (feature) => {
        if (feature === 'youtube.audio') {
            return {
                media: createMediaSource({
                    filePath,
                    sizeBytes: 14,
                    meta: { title: 'Música', durationSeconds: 90 },
                    mimetype: 'audio/mp4',
                    fileName: 'autodl.m4a'
                })
            };
        }
        throw new Error(`feature inesperada: ${feature}`);
    };

    const result = await autoDownloadYoutube({
        ...h.context,
        url: 'https://youtu.be/dQw4w9WgXcQ'
    });

    assert.equal(result, true);
    assert.equal(contentDuringSend, 'conteudo-autodl');
    assert.ok(h.messages.some((item) => item.content.audio));
    await assert.rejects(fs.stat(filePath), (error) => error.code === 'ENOENT');
    await fs.rm(dir, { recursive: true, force: true });
});

test('stream de vídeo que falhou é fechado e o arquivo é limpo', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nazuna-send-'));
    const filePath = path.join(dir, 'video.mp4');
    await fs.writeFile(filePath, 'conteudo-de-video');

    const streams = [];
    const h = harness();

    h.context.nazu.sendMessage = async (from, content, options) => {
        h.messages.push({ from, content, options });
        if (content.video) throw new Error('falha no envio do vídeo');
        return { key: { id: 'x' } };
    };

    h.context.runApi = async (feature) => {
        if (feature === 'youtube.video') {
            return {
                media: {
                    filePath,
                    fileName: 'video.mp4',
                    mimetype: 'video/mp4',
                    meta: { title: 'Vídeo', durationSeconds: 60 },
                    openStream: () => {
                        const stream = fakeStream();
                        streams.push(stream);
                        return stream;
                    },
                    cleanup: async () => {
                        await fs.rm(filePath, { force: true });
                    }
                }
            };
        }
        throw new Error(`feature inesperada: ${feature}`);
    };
    h.context.command = 'ytmp4';
    h.context.q = 'https://youtu.be/dQw4w9WgXcQ';

    await runYoutubeCommand(h.context);

    assert.equal(streams.length, 1);
    assert.equal(streams[0].destroyed, true);
    assert.equal(h.replies.filter((text) => text.startsWith('❌')).length, 1);
    await assert.rejects(fs.stat(filePath), (error) => error.code === 'ENOENT');
    await fs.rm(dir, { recursive: true, force: true });
});

test('autodownload com falha não reporta sucesso', async () => {
    const h = harness();
    h.context.runApi = async () => {
        throw new ApiError(ErrorCodes.UPSTREAM, { userMessage: 'Falha no provedor' });
    };

    const result = await autoDownloadYoutube({
        ...h.context,
        url: 'https://youtu.be/dQw4w9WgXcQ'
    });

    assert.equal(result, false);
    assert.equal(h.messages.length, 0);
});

test('aliases de YouTube são roteados para a API interna', async () => {
    const cases = [
        { command: 'play', features: ['youtube.search', 'youtube.audio'], metadata: true },
        { command: 'ytmp3', features: ['youtube.search', 'youtube.audio'], metadata: true },
        { command: 'play2', features: ['youtube.search', 'youtube.audio'], metadata: false },
        { command: 'playvid', features: ['youtube.search', 'youtube.video'], metadata: true },
        { command: 'ytmp4', features: ['youtube.search', 'youtube.video'], metadata: true }
    ];

    for (const item of cases) {
        const h = harness();
        h.context.command = item.command;
        h.context.q = 'Música de teste';

        await runYoutubeCommand(h.context);

        assert.deepEqual(h.calls.map((call) => call.feature), item.features, item.command);
        const hasCaption = h.messages.some((message) => message.content.caption);
        assert.equal(hasCaption, item.metadata, item.command);
        assert.ok(
            h.messages.some((message) => message.content.audio || message.content.video),
            `${item.command} deve enviar mídia`
        );
    }
});

test('autodownload só captura links reais do YouTube', () => {
    assert.equal(isYoutubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), true);
    assert.equal(isYoutubeUrl('https://youtu.be/dQw4w9WgXcQ'), true);
    assert.equal(isYoutubeUrl('https://m.youtube.com/watch?v=dQw4w9WgXcQ'), true);
    assert.equal(isYoutubeUrl('youtube.com/watch?v=dQw4w9WgXcQ'), true);

    assert.equal(isYoutubeUrl('https://exemplo.com/?redir=youtube.com'), false);
    assert.equal(isYoutubeUrl('https://youtube.com.evil.test/watch?v=1'), false);
    assert.equal(isYoutubeUrl('https://soundcloud.com/artist/track'), false);
    assert.equal(isYoutubeUrl(''), false);
    assert.equal(isYoutubeUrl('nao-e-url'), false);
});

test('limite de tamanho do download vira erro e não envia mídia', async () => {
    const h = harness();
    h.context.runApi = async (feature) => {
        if (feature === 'youtube.audio') {
            throw new ApiError(ErrorCodes.PAYLOAD_TOO_LARGE, {
                userMessage: 'O conteúdo excede o limite permitido.'
            });
        }
        throw new Error(`feature inesperada: ${feature}`);
    };
    h.context.q = 'https://youtu.be/dQw4w9WgXcQ';

    await runYoutubeCommand(h.context);

    assert.equal(h.messages.length, 0);
    assert.equal(h.replies.filter((text) => text.startsWith('❌')).length, 1);
    assert.match(h.replies[h.replies.length - 1], /excede o limite/);
});

test('o registro de envio descreve o arquivo sem expor conteudo', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nazuna-log-'));
    const filePath = path.join(dir, 'musica.m4a');
    await fs.writeFile(filePath, 'conteudo-de-audio');

    const media = createMediaSource({
        filePath,
        sizeBytes: 17,
        meta: { title: 'Música', durationSeconds: 120 },
        mimetype: 'audio/mp4',
        fileName: 'musica.m4a'
    });

    const info = await describeMediaForLog(media);

    assert.equal(info.filePath, filePath);
    assert.equal(info.extension, '.m4a');
    assert.equal(info.mimetype, 'audio/mp4');
    assert.equal(info.durationSeconds, 120);
    assert.equal(info.sizeOnDisk, 17);
    assert.match(info.sha256, /^[0-9a-f]{64}$/);
    assert.ok(!JSON.stringify(info).includes('conteudo-de-audio'), 'não deve vazar o conteúdo do arquivo');

    await fs.rm(dir, { recursive: true, force: true });
});

test('o envio registra a mídia antes de limpar o temporário', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nazuna-log-'));
    const filePath = path.join(dir, 'musica.m4a');
    await fs.writeFile(filePath, 'conteudo-de-audio');

    const h = harness();
    h.context.runApi = async (feature) => {
        if (feature === 'youtube.audio') {
            return {
                media: createMediaSource({
                    filePath,
                    sizeBytes: 17,
                    meta: { title: 'Música', durationSeconds: 120 },
                    mimetype: 'audio/mp4',
                    fileName: 'musica.m4a'
                })
            };
        }
        throw new Error(`feature inesperada: ${feature}`);
    };
    h.context.q = 'https://youtu.be/dQw4w9WgXcQ';

    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => { logs.push(args.join(' ')); };

    try {
        await runYoutubeCommand(h.context);
    } finally {
        console.log = originalLog;
    }

    const registro = logs.find((line) => line.includes('[youtube:envio]'));
    assert.ok(registro, 'deve registrar a mídia enviada');
    assert.match(registro, /tipo=audio/);
    assert.match(registro, /"mimetype":"audio\/mp4"/);
    assert.match(registro, /"sizeOnDisk":17/);
    await assert.rejects(fs.stat(filePath), (error) => error.code === 'ENOENT');

    await fs.rm(dir, { recursive: true, force: true });
});

test('play pesquisa, envia metadados e baixa áudio com limite de 30 minutos', async () => {
    const h = harness();
    h.context.q = 'Música de teste';

    await runYoutubeCommand(h.context);

    assert.equal(h.calls.length, 2);
    assert.equal(h.calls[0].feature, 'youtube.search');
    assert.equal(h.calls[0].options.maxDurationSeconds, 1800);
    assert.equal(h.calls[1].feature, 'youtube.audio');
    assert.equal(h.calls[1].options.maxDurationSeconds, 1800);
    assert.match(h.replies[0], /Pesquisando no YouTube/);
    assert.equal(h.messages[0].content.image.url, video.thumbnail);
    assert.match(h.messages[0].content.caption, /Música Encontrada/);
    assert.ok(h.messages.some((item) => item.content.audio));
    assert.equal(h.cleanupCalls.count, 1);
});

test('comando play funciona com provedor local e não chama Vex', async () => {
    let localSearches = 0;
    let localAudios = 0;
    let vexCalls = 0;
    const cache = new BoundedCache({ maxEntries: 20, maxBytes: 1024 * 1024 });
    const limiter = new ConcurrencyLimiter({ maxConcurrent: 2, maxQueue: 10 });
    const providers = {
        local: {
            search: async () => { localSearches++; return video; },
            audio: async () => {
                localAudios++;
                return {
                    remoteUrl: 'https://googlevideo.example/audio.m4a',
                    meta: video,
                    mimetype: 'audio/mp4',
                    extension: '.m4a',
                    fileName: 'audio.m4a'
                };
            },
            video: async () => { throw new Error('não usado'); }
        },
        vex: {
            search: async () => { vexCalls++; return video; },
            audio: async () => { vexCalls++; throw new Error('Vex não deveria ser chamada'); },
            video: async () => { vexCalls++; throw new Error('Vex não deveria ser chamada'); }
        }
    };
    const config = {
        api: {
            youtube: {
                provider: 'local',
                allowVexFallback: false
            }
        }
    };
    const runApi = (feature, input, options = {}) => run(feature, input, {
        ...options,
        config,
        providers,
        cache,
        limiter,
        env: {},
        download: async () => ({ filePath: 'C:/tmp/audio.m4a', sizeBytes: 4 })
    });
    const h = harness({ runApi });
    h.context.q = 'Música de teste';

    await runYoutubeCommand(h.context);

    assert.equal(localSearches, 1);
    assert.equal(localAudios, 1);
    assert.equal(vexCalls, 0);
    const audioMessage = h.messages.find((item) => item.content.audio);
    assert.equal(audioMessage.content.mimetype, 'audio/mp4');
    assert.equal(audioMessage.content.fileName, 'audio.m4a');
});

test('comando ytmp4 funciona com provedor local e não chama Vex', async () => {
    let localVideos = 0;
    let vexCalls = 0;
    const cache = new BoundedCache({ maxEntries: 20, maxBytes: 1024 * 1024 });
    const limiter = new ConcurrencyLimiter({ maxConcurrent: 2, maxQueue: 10 });
    const providers = {
        local: {
            search: async () => video,
            audio: async () => { throw new Error('não usado'); },
            video: async () => {
                localVideos++;
                return {
                    remoteUrl: 'https://googlevideo.example/video.mp4',
                    meta: video,
                    mimetype: 'video/mp4',
                    extension: '.mp4',
                    fileName: 'video.mp4'
                };
            }
        },
        vex: {
            search: async () => { vexCalls++; return video; },
            audio: async () => { vexCalls++; throw new Error('Vex não deveria ser chamada'); },
            video: async () => { vexCalls++; throw new Error('Vex não deveria ser chamada'); }
        }
    };
    const config = {
        api: { youtube: { provider: 'local', allowVexFallback: false } }
    };
    const runApi = (feature, input, options = {}) => run(feature, input, {
        ...options,
        config,
        providers,
        cache,
        limiter,
        env: {},
        download: async () => ({ filePath: 'C:/tmp/video.mp4', sizeBytes: 4 })
    });
    const h = harness({ runApi });
    h.context.command = 'ytmp4';
    h.context.q = video.url;

    await runYoutubeCommand(h.context);

    assert.equal(localVideos, 1);
    assert.equal(vexCalls, 0);
    const videoMessage = h.messages.find((item) => item.content.video);
    assert.equal(videoMessage.content.mimetype, 'video/mp4');
    assert.equal(videoMessage.content.fileName, 'video.mp4');
});

test('autodownload funciona com provedor local e não chama Vex', async () => {
    let localAudios = 0;
    let vexCalls = 0;
    const cache = new BoundedCache({ maxEntries: 20, maxBytes: 1024 * 1024 });
    const limiter = new ConcurrencyLimiter({ maxConcurrent: 2, maxQueue: 10 });
    const providers = {
        local: {
            search: async () => video,
            audio: async () => {
                localAudios++;
                return {
                    remoteUrl: 'https://googlevideo.example/audio.m4a',
                    meta: video,
                    mimetype: 'audio/mp4',
                    extension: '.m4a',
                    fileName: 'audio.m4a'
                };
            },
            video: async () => { throw new Error('não usado'); }
        },
        vex: {
            search: async () => { vexCalls++; return video; },
            audio: async () => { vexCalls++; throw new Error('Vex não deveria ser chamada'); },
            video: async () => { vexCalls++; throw new Error('Vex não deveria ser chamada'); }
        }
    };
    const config = {
        api: { youtube: { provider: 'local', allowVexFallback: false } }
    };
    const runApi = (feature, input, options = {}) => run(feature, input, {
        ...options,
        config,
        providers,
        cache,
        limiter,
        env: {},
        download: async () => ({ filePath: 'C:/tmp/audio.m4a', sizeBytes: 4 })
    });
    const h = harness({ runApi });
    h.context.q = '';

    const result = await autoDownloadYoutube({
        ...h.context,
        url: video.url
    });

    assert.equal(result, true);
    assert.equal(localAudios, 1);
    assert.equal(vexCalls, 0);
    assert.ok(h.messages.some((item) => item.content.audio));
});

test('play com link direto preserva ausência de limite de busca', async () => {
    const h = harness();
    h.context.q = video.url;

    await runYoutubeCommand(h.context);

    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].feature, 'youtube.audio');
    assert.equal(h.calls[0].options, undefined);
});

test('play2 baixa áudio sem enviar metadados', async () => {
    const h = harness();
    h.context.command = 'play2';
    h.context.q = 'Música de teste';

    await runYoutubeCommand(h.context);

    assert.equal(h.calls[0].feature, 'youtube.search');
    assert.equal(h.calls[1].feature, 'youtube.audio');
    assert.equal(h.messages.filter((item) => item.content.image).length, 0);
    assert.ok(h.messages.some((item) => item.content.audio));
});

test('ytmp4 aceita link direto e envia vídeo sem busca', async () => {
    const h = harness();
    h.context.command = 'ytmp4';
    h.context.q = 'https://youtu.be/dQw4w9WgXcQ';

    await runYoutubeCommand(h.context);

    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].feature, 'youtube.video');
    assert.equal(h.calls[0].input.url, video.url);
    assert.equal(h.replies[0], 'Aguarde um momentinho... ☀️');
    assert.ok(h.messages.some((item) => item.content.video));
    assert.equal(h.cleanupCalls.count, 1);
});

test('ytmp3 e playvid continuam roteados para a API interna', async () => {
    const audio = harness();
    audio.context.command = 'ytmp3';
    audio.context.q = 'Música de teste';

    await runYoutubeCommand(audio.context);

    assert.deepEqual(audio.calls.map((item) => item.feature), ['youtube.search', 'youtube.audio']);
    assert.ok(audio.messages.some((item) => item.content.image));
    assert.ok(audio.messages.some((item) => item.content.audio));

    const videoCase = harness();
    videoCase.context.command = 'playvid';
    videoCase.context.q = 'Vídeo de teste';

    await runYoutubeCommand(videoCase.context);

    assert.deepEqual(videoCase.calls.map((item) => item.feature), ['youtube.search', 'youtube.video']);
    assert.ok(videoCase.messages.some((item) => item.content.image));
    assert.ok(videoCase.messages.some((item) => item.content.video));
});

test('play3 não é capturado pelo módulo do YouTube', async () => {
    const h = harness();
    h.context.command = 'play3';
    h.context.q = 'SoundCloud';

    await runYoutubeCommand(h.context);

    assert.equal(h.calls.length, 0);
    assert.equal(h.messages.length, 0);
    assert.equal(h.replies.length, 0);
});

test('playvid pesquisa e envia vídeo com metadados', async () => {
    const h = harness();
    h.context.command = 'playvid';
    h.context.q = 'Vídeo de teste';

    await runYoutubeCommand(h.context);

    assert.equal(h.calls[0].feature, 'youtube.search');
    assert.equal(h.calls[1].feature, 'youtube.video');
    assert.match(h.messages[0].content.caption, /Vídeo Encontrado/);
    assert.ok(h.messages.some((item) => item.content.video));
});

test('rejeita link inválido sem chamar a API', async () => {
    const h = harness();
    h.context.q = 'https://example.com/watch?v=dQw4w9WgXcQ';

    await runYoutubeCommand(h.context);

    assert.equal(h.calls.length, 0);
    assert.equal(h.replies.length, 1);
    assert.match(h.replies[0], /^❌/);
});

test('erro do provedor gera apenas uma resposta de erro', async () => {
    const h = harness({
        runApi: async (feature) => {
            if (feature === 'youtube.search') {
                throw new ApiError(ErrorCodes.UPSTREAM, {
                    userMessage: 'Falha no provedor'
                });
            }
            throw new Error('não deveria continuar');
        }
    });
    h.context.q = 'teste';

    await runYoutubeCommand(h.context);

    assert.equal(h.replies.length, 2);
    assert.match(h.replies[0], /Pesquisando/);
    assert.equal(h.replies[1], '❌ Falha no provedor');
});

test('falha de tamanho no áudio envia documento como fallback', async () => {
    const h = harness({ failAudioSend: true });
    h.context.command = 'play2';
    h.context.q = 'https://youtu.be/dQw4w9WgXcQ';

    await runYoutubeCommand(h.context);

    assert.ok(h.replies.some((text) => text.includes('Arquivo muito grande')));
    assert.ok(h.messages.some((item) => item.content.document));
    assert.equal(h.cleanupCalls.count, 1);
});

test('autodl usa a API nova e limpa a mídia', async () => {
    const h = harness();

    const result = await autoDownloadYoutube({
        ...h.context,
        q: '',
        url: video.url
    });

    assert.equal(result, true);
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].feature, 'youtube.audio');
    assert.ok(h.messages.some((item) => item.content.audio));
    assert.equal(h.cleanupCalls.count, 1);
});

test('caption usa fallback seguro para campos ausentes', () => {
    const caption = buildPlayCaption({
        title: 'Título',
        author: '',
        durationSeconds: 61,
        views: null,
        ago: '',
        description: '',
        url: video.url
    });

    assert.match(caption, /Não informado/);
    assert.match(caption, /1:01/);
    assert.match(caption, /Sem descrição disponível/);
});
