import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { prepareWAMessageMedia } from 'baileys';
import { createMediaSource } from '../../dados/src/funcs/api/media.js';

function m4aBytes() {
    return Buffer.concat([
        Buffer.from([0x00, 0x00, 0x00, 0x20]),
        Buffer.from('ftypM4A '),
        Buffer.from('moov'),
        Buffer.from('mp4a'),
        Buffer.from('esds'),
        Buffer.alloc(64)
    ]);
}

async function tempFile(name, content) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nazuna-baileys-'));
    const filePath = path.join(dir, name);
    await fs.writeFile(filePath, content);
    return { dir, filePath };
}

function fakeUpload(register) {
    return async (filePath, options) => {
        const stat = await fs.stat(filePath);
        register.push({ filePath, sizeBytes: stat.size, options });
        return { mediaUrl: 'https://mmg.whatsapp.net/fake', directPath: '/v/t62' };
    };
}

test('o pipeline real do Baileys aceita o .m4a produced pela API interna', async () => {
    const { dir, filePath } = await tempFile('musica.m4a', m4aBytes());
    const media = createMediaSource({
        filePath,
        sizeBytes: m4aBytes().length,
        meta: { title: 'Música', durationSeconds: 120 },
        mimetype: 'audio/mp4',
        fileName: 'musica.m4a'
    });
    const uploads = [];

    const message = await prepareWAMessageMedia({
        audio: { stream: media.openStream() },
        mimetype: media.mimetype,
        fileName: media.fileName,
        seconds: 120
    }, {
        logger: { debug() {}, warn() {}, info() {} },
        mediaCache: null,
        upload: fakeUpload(uploads),
        options: {},
        jid: '5521999999999@s.whatsapp.net',
        mediaUploadTimeoutMs: 60000
    });

    const audio = message.audioMessage;
    assert.ok(audio, 'a mensagem deve conter audioMessage');
    assert.equal(audio.mimetype, 'audio/mp4');
    assert.equal(audio.seconds, 120);
    assert.equal(Number(audio.fileLength), m4aBytes().length);
    assert.equal(audio.mediaKey.length, 32);
    assert.notEqual(audio.ptt, true, 'não deve ser marcado como nota de voz');
    assert.equal(audio.fileName, undefined, 'AudioMessage não possui fileName no protocolo');
    assert.equal(uploads.length, 1);
    assert.ok(uploads[0].sizeBytes >= m4aBytes().length);
    assert.equal(uploads[0].options.mediaType, 'audio');

    await media.cleanup();
    await fs.rm(dir, { recursive: true, force: true });
});

test('o pipeline real do Baileys envia vídeo mesmo sem miniatura (ffmpeg ausente no PATH)', async () => {
    const { dir, filePath } = await tempFile('video.mp4', m4aBytes());
    const media = createMediaSource({
        filePath,
        sizeBytes: m4aBytes().length,
        meta: { title: 'Vídeo', durationSeconds: 60 },
        mimetype: 'video/mp4',
        fileName: 'video.mp4'
    });
    const uploads = [];

    const message = await prepareWAMessageMedia({
        video: { stream: media.openStream() },
        mimetype: media.mimetype,
        fileName: media.fileName
    }, {
        logger: { debug() {}, warn() {}, info() {} },
        mediaCache: null,
        upload: fakeUpload(uploads),
        options: {},
        jid: '5521999999999@s.whatsapp.net',
        mediaUploadTimeoutMs: 60000
    });

    const video = message.videoMessage;
    assert.ok(video, 'a mensagem deve conter videoMessage');
    assert.equal(video.mimetype, 'video/mp4');
    assert.equal(video.mediaKey.length, 32);
    assert.equal(uploads.length, 1);
    assert.equal(uploads[0].options.mediaType, 'video');
    assert.equal(video.jpegThumbnail == null, true);

    await media.cleanup();
    await fs.rm(dir, { recursive: true, force: true });
});
