import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
    createMediaSource,
    downloadToTemp,
    validateRemoteMediaUrl
} from '../../dados/src/funcs/api/media.js';

async function withServer(handler, callback) {
    const server = http.createServer(handler);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;

    try {
        return await callback(base);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

async function tempDir() {
    return fs.mkdtemp(path.join(os.tmpdir(), 'nazuna-media-'));
}

test('rejeita destinos privados e protocolos não HTTP', async () => {
    assert.throws(
        () => validateRemoteMediaUrl('http://127.0.0.1/audio.mp3'),
        (error) => error.code === 'INPUT_INVALID'
    );
    assert.throws(
        () => validateRemoteMediaUrl('http://localhost/audio.mp3'),
        (error) => error.code === 'INPUT_INVALID'
    );
    assert.throws(
        () => validateRemoteMediaUrl('file:///tmp/audio.mp3'),
        (error) => error.code === 'INPUT_INVALID'
    );
});

test('baixa mídia para arquivo temporário e remove no cleanup', async () => {
    const dir = await tempDir();

    await withServer((request, response) => {
        response.writeHead(200, {
            'content-type': 'audio/mpeg',
            'content-length': '10'
        });
        response.end('media-data');
    }, async (base) => {
        const downloaded = await downloadToTemp({
            url: `${base}/audio`,
            tempDir: dir,
            validateUrl: () => {},
            timeoutMs: 3000
        });

        assert.equal(await fs.readFile(downloaded.filePath, 'utf8'), 'media-data');
        assert.equal(downloaded.sizeBytes, 10);
        assert.equal(downloaded.contentType, 'audio/mpeg');

        await fs.rm(downloaded.filePath, { force: true });
    });

    await fs.rm(dir, { recursive: true, force: true });
});

test('respeita limite de redirects', async () => {
    const dir = await tempDir();

    await withServer((request, response) => {
        if (request.url === '/redirect') {
            response.writeHead(302, { location: '/audio' });
            response.end();
            return;
        }
        response.writeHead(200, { 'content-type': 'audio/mpeg' });
        response.end('data');
    }, async (base) => {
        await assert.rejects(
            downloadToTemp({
                url: `${base}/redirect`,
                maxRedirects: 0,
                tempDir: dir,
                validateUrl: () => {}
            }),
            (error) => error.code === 'UPSTREAM'
        );

        const downloaded = await downloadToTemp({
            url: `${base}/redirect`,
            maxRedirects: 1,
            tempDir: dir,
            validateUrl: () => {}
        });
        assert.equal(await fs.readFile(downloaded.filePath, 'utf8'), 'data');
        await fs.rm(downloaded.filePath, { force: true });
    });

    await fs.rm(dir, { recursive: true, force: true });
});

test('aplica maxBytes e limpa arquivo parcial', async () => {
    const dir = await tempDir();

    await withServer((request, response) => {
        response.writeHead(200, {
            'content-type': 'video/mp4',
            'content-length': '8'
        });
        response.end('12345678');
    }, async (base) => {
        await assert.rejects(
            downloadToTemp({
                url: `${base}/video`,
                maxBytes: 4,
                tempDir: dir,
                validateUrl: () => {}
            }),
            (error) => error.code === 'PAYLOAD_TOO_LARGE'
        );

        assert.deepEqual(await fs.readdir(dir), []);
    });

    await fs.rm(dir, { recursive: true, force: true });
});

test('createMediaSource remove diretórios temporários extras no cleanup', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nazuna-media-'));
    const workDir = path.join(dir, 'yt-dlp');
    await fs.mkdir(workDir, { recursive: true });
    const filePath = path.join(workDir, 'audio.m4a');
    await fs.writeFile(filePath, 'abc');

    const media = createMediaSource({
        filePath,
        sizeBytes: 3,
        mimetype: 'audio/mp4',
        fileName: 'audio.m4a',
        cleanupPaths: [workDir]
    });

    await media.cleanup();

    await assert.rejects(fs.stat(filePath), (error) => error.code === 'ENOENT');
    await assert.rejects(fs.stat(workDir), (error) => error.code === 'ENOENT');

    await fs.rm(dir, { recursive: true, force: true });
});

test('createMediaSource faz cleanup idempotente', async () => {
    const dir = await tempDir();
    const filePath = path.join(dir, 'audio.mp3');
    await fs.writeFile(filePath, 'abc');

    const media = createMediaSource({
        filePath,
        sizeBytes: 3,
        mimetype: 'audio/mpeg',
        fileName: 'audio.mp3'
    });

    const chunks = [];
    for await (const chunk of media.openStream()) chunks.push(chunk);
    assert.equal(Buffer.concat(chunks).toString(), 'abc');

    await media.cleanup();
    await media.cleanup();
    await assert.rejects(fs.stat(filePath), (error) => error.code === 'ENOENT');

    await fs.rm(dir, { recursive: true, force: true });
});
