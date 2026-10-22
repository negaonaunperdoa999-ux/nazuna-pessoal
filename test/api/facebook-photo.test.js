import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
    classifyFacebookUrl,
    detectImageMimetype,
    downloadFacebookPhoto,
    extractImageUrl,
    extractVideoUrl
} from '../../dados/src/funcs/api/providers/local/facebookPhoto.js';
import { downloadSocialMedia } from '../../dados/src/funcs/api/providers/local/socialMedia.js';

function jpegBytes() {
    return Buffer.concat([
        Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]),
        Buffer.alloc(32, 0x01)
    ]);
}

function fakeResponse({ status = 200, url = '', headers = {}, text = '', bytes = null } = {}) {
    return {
        ok: status >= 200 && status < 400,
        status,
        url,
        headers: {
            get(name) {
                return headers[String(name).toLowerCase()] ?? null;
            }
        },
        async text() {
            return text;
        },
        async arrayBuffer() {
            if (!bytes) return new ArrayBuffer(0);
            return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        }
    };
}

function fakeSpawn({ onSpawn, exitCode = 0, stderr = '' } = {}) {
    return (binary, args) => {
        const child = new EventEmitter();
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();
        child.kill = () => {};

        setImmediate(async () => {
            if (onSpawn) {
                await onSpawn({
                    args,
                    child,
                    emitStdout: (value) => child.stdout.emit('data', Buffer.from(value)),
                    emitStderr: (value) => child.stderr.emit('data', Buffer.from(value))
                });
            }
            if (stderr) child.stderr.emit('data', Buffer.from(stderr));
            child.emit('close', exitCode);
        });

        return child;
    };
}

async function tempRoot() {
    return fsp.mkdtemp(path.join(os.tmpdir(), 'nazuna-facebook-test-'));
}

const PHOTO_URL = 'https://www.facebook.com/photo.php?fbid=122103691322525821&set=a.122103687506525821&type=3';
const IMAGE_URL = 'https://scontent.fbcdn.net/v/t39/photo.jpg?oh=abc&oe=123';

test('classifica photo.php?fbid como foto e photo.php?v como vídeo', () => {
    assert.equal(classifyFacebookUrl(PHOTO_URL).kind, 'photo');
    assert.equal(classifyFacebookUrl('https://www.facebook.com/photo?fbid=123').kind, 'photo');
    assert.equal(classifyFacebookUrl('https://www.facebook.com/photo.php?v=123').kind, 'video');
    assert.equal(classifyFacebookUrl('https://www.facebook.com/watch/?v=123').kind, 'video');
    assert.equal(classifyFacebookUrl('https://www.facebook.com/reel/123').kind, 'video');
    assert.equal(classifyFacebookUrl('https://www.facebook.com/user/videos/123/').kind, 'video');
    assert.equal(classifyFacebookUrl('https://www.facebook.com/share/v/abc/').kind, 'video');
    assert.equal(classifyFacebookUrl('https://www.facebook.com/share/p/abc/').kind, 'unknown');
    assert.equal(classifyFacebookUrl('https://fb.watch/abc/').kind, 'unknown');
    assert.equal(classifyFacebookUrl('https://exemplo.com/photo.php?fbid=1').kind, 'unknown');
});

test('extrai og:image inclusive com atributos invertidos e entidades HTML', () => {
    assert.equal(
        extractImageUrl('<meta property="og:image" content="https://scontent.fbcdn.net/a.jpg?x=1&amp;y=2">'),
        'https://scontent.fbcdn.net/a.jpg?x=1&y=2'
    );
    assert.equal(
        extractImageUrl('<meta content="https://scontent.fbcdn.net/b.jpg" property="og:image">'),
        'https://scontent.fbcdn.net/b.jpg'
    );
    assert.equal(
        extractVideoUrl('<meta content="https://video.fbcdn.net/v.mp4" property="og:video">'),
        'https://video.fbcdn.net/v.mp4'
    );
});

test('valida a assinatura real da imagem', () => {
    assert.equal(detectImageMimetype(jpegBytes()), 'image/jpeg');
    assert.equal(detectImageMimetype(Buffer.from('{"erro":"sem imagem"}')), null);
    assert.equal(detectImageMimetype(Buffer.from('<html>login</html>')), null);
});

test('baixa a foto pública e devolve Buffer de imagem', async () => {
    const fetchCalls = [];
    const fetchImpl = async (url) => {
        fetchCalls.push(url);
        if (url === PHOTO_URL) {
            return fakeResponse({
                url: PHOTO_URL,
                headers: { 'content-type': 'text/html' },
                text: `<html><head><meta property="og:image" content="${IMAGE_URL.replace('&', '&amp;')}"><meta property="og:title" content="Foto de teste"></head></html>`
            });
        }
        if (url === IMAGE_URL) {
            return fakeResponse({ url: IMAGE_URL, headers: { 'content-type': 'image/jpeg' }, bytes: jpegBytes() });
        }
        throw new Error(`URL inesperada: ${url}`);
    };

    const result = await downloadFacebookPhoto(PHOTO_URL, { fetch: fetchImpl });

    assert.equal(result.ok, true);
    assert.equal(result.type, 'image');
    assert.equal(result.mimetype, 'image/jpeg');
    assert.equal(result.fileName, 'facebook.jpg');
    assert.equal(result.title, 'Foto de teste');
    assert.ok(Buffer.isBuffer(result.buffer));
    assert.ok(result.sizeBytes > 0);
    assert.deepEqual(fetchCalls, [PHOTO_URL, IMAGE_URL]);
});

test('foto que exige login devolve mensagem específica, sem fallback para yt-dlp', async () => {
    const fetchImpl = async (url) => fakeResponse({
        url,
        headers: { 'content-type': 'text/html' },
        text: '<html><title>Facebook</title><form id="login_form">Log into Facebook</form></html>'
    });

    const result = await downloadSocialMedia('facebook', PHOTO_URL, {
        binary: null,
        fetch: fetchImpl
    });

    assert.equal(result.ok, false);
    assert.equal(result.etapa, 'foto');
    assert.match(result.msg, /exige login|não usa cookies/i);
    assert.doesNotMatch(result.msg, /yt-dlp não está disponível/i);
    assert.doesNotMatch(result.msg, /Unsupported URL/i);
});

test('foto pública funciona mesmo sem yt-dlp disponível', async () => {
    const fetchImpl = async (url) => {
        if (url === PHOTO_URL) {
            return fakeResponse({
                url: PHOTO_URL,
                text: `<meta property="og:image" content="${IMAGE_URL}">`
            });
        }
        return fakeResponse({ url: IMAGE_URL, headers: { 'content-type': 'image/jpeg' }, bytes: jpegBytes() });
    };

    const result = await downloadSocialMedia('facebook', PHOTO_URL, {
        binary: null,
        fetch: fetchImpl
    });

    assert.equal(result.ok, true);
    assert.equal(result.type, 'image');
    assert.ok(Buffer.isBuffer(result.buffer));
});

test('página com og:video não envia a capa como se fosse a mídia pedida', async () => {
    const fetchImpl = async (url) => fakeResponse({
        url,
        text: `<meta property="og:image" content="${IMAGE_URL}"><meta property="og:video" content="https://video.fbcdn.net/v.mp4">`
    });

    const result = await downloadFacebookPhoto(PHOTO_URL, { fetch: fetchImpl });

    assert.equal(result.ok, false);
    assert.equal(result.code, 'video');
    assert.match(result.resolvedUrl, /facebook\.com/);
});

test('imagem inválida (JSON/HTML) não vira sucesso', async () => {
    const fetchImpl = async (url) => {
        if (url === PHOTO_URL) {
            return fakeResponse({ url: PHOTO_URL, text: `<meta property="og:image" content="${IMAGE_URL}">` });
        }
        return fakeResponse({
            url: IMAGE_URL,
            headers: { 'content-type': 'text/html' },
            bytes: Buffer.from('<html>erro</html>')
        });
    };

    const result = await downloadFacebookPhoto(PHOTO_URL, { fetch: fetchImpl });

    assert.equal(result.ok, false);
    assert.equal(result.code, 'image_invalid');
});

test('photo.php?v continua sendo vídeo e usa o yt-dlp compartilhado', async () => {
    const root = await tempRoot();
    const spawn = fakeSpawn({
        async onSpawn({ args, emitStdout }) {
            const template = args[args.indexOf('-o') + 1];
            const target = template.replace('%(ext)s', 'mp4');
            await fsp.writeFile(target, Buffer.concat([
                Buffer.from([0x00, 0x00, 0x00, 0x20]),
                Buffer.from('ftypisom'),
                Buffer.from('moov'),
                Buffer.from('avc1'),
                Buffer.from('mp4a'),
                Buffer.alloc(64)
            ]));
            emitStdout(`${target}\n`);
        }
    });

    const result = await downloadSocialMedia('facebook', 'https://www.facebook.com/photo.php?v=123', {
        binary: 'yt-dlp',
        spawn,
        tempRoot: root,
        fetch: async () => {
            throw new Error('não deveria consultar a página de um vídeo');
        }
    });

    assert.equal(result.ok, true);
    assert.equal(result.type, 'video');

    await fsp.rm(root, { recursive: true, force: true });
});
