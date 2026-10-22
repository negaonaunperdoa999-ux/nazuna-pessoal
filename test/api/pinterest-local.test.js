import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
    downloadPinterestPin,
    extractPinId,
    extractPinImage,
    extractPinVideo,
    isPinterestPinUrl
} from '../../dados/src/funcs/api/providers/local/pinterest.js';

const PIN_ID = '206743439137437195';
const VIDEO_PIN_ID = '450148925278476311';
const HASH = 'aabbccddeeff00112233445566778899';
const PIN_URL = `https://www.pinterest.com/pin/${PIN_ID}/`;
const VIDEO_PIN_URL = `https://www.pinterest.com/pin/${VIDEO_PIN_ID}/`;
const IMAGE_736 = `https://i.pinimg.com/736x/aa/bb/cc/${HASH}.jpg`;
const IMAGE_ORIGINAL = `https://i.pinimg.com/originals/aa/bb/cc/${HASH}.jpg`;

function jpegBytes() {
    return Buffer.concat([
        Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]),
        Buffer.alloc(32, 0x02)
    ]);
}

function mp4Bytes() {
    return Buffer.concat([
        Buffer.from([0x00, 0x00, 0x00, 0x20]),
        Buffer.from('ftypisom'),
        Buffer.from('moov'),
        Buffer.from('avc1'),
        Buffer.from('mp4a'),
        Buffer.alloc(64)
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
    return fsp.mkdtemp(path.join(os.tmpdir(), 'nazuna-pinterest-test-'));
}

function imagePage(html = '') {
    return `<html><head>
        <meta property="og:image" content="${IMAGE_736}">
        <meta property="og:title" content="Pin de teste">
        <link rel="preload" as="image" href="${IMAGE_ORIGINAL}">
    </head><body>${html}</body></html>`;
}

test('reconhece pin do Pinterest e extrai o id', () => {
    assert.equal(isPinterestPinUrl(PIN_URL), true);
    assert.equal(isPinterestPinUrl('https://br.pinterest.com/pin/123/'), true);
    assert.equal(isPinterestPinUrl('https://pin.it/abc123'), true);
    assert.equal(isPinterestPinUrl('https://www.pinterest.com/search/pins/?q=flor'), false);
    assert.equal(isPinterestPinUrl('https://exemplo.com/pin/123/'), false);
    assert.equal(extractPinId(PIN_URL), PIN_ID);
    assert.equal(extractPinId('https://pin.it/abc123'), null);
});

test('prefere a imagem originals apenas quando o hash é o mesmo da og:image', () => {
    assert.equal(extractPinImage(imagePage()), IMAGE_ORIGINAL);

    const related = `<meta property="og:image" content="${IMAGE_736}">
        <a href="https://i.pinimg.com/originals/11/22/33/ffffffffffffffffffffffffffffffff.jpg">relacionado</a>`;
    assert.equal(extractPinImage(related), IMAGE_736);

    const noMeta = `<a href="${IMAGE_ORIGINAL}">imagem</a>`;
    assert.equal(extractPinImage(noMeta), IMAGE_ORIGINAL);
    assert.equal(extractPinImage('<html>sem imagem</html>'), null);
});

test('detecta pin de vídeo pelo og:video ou host de vídeo', () => {
    assert.equal(
        extractPinVideo('<meta property="og:video" content="https://v1.pinimg.com/videos/abc.mp4">'),
        'https://v1.pinimg.com/videos/abc.mp4'
    );
    assert.equal(extractPinVideo('<script>https://v1.pinimg.com/videos/abc.m3u8</script>'), 'embedded-video');
    assert.equal(extractPinVideo(imagePage()), null);
});

test('pin de imagem: yt-dlp sem formatos cai para a página pública', async () => {
    const root = await tempRoot();
    const fetchCalls = [];
    const fetchImpl = async (url) => {
        fetchCalls.push(url);
        if (url === PIN_URL) return fakeResponse({ url, text: imagePage() });
        if (url === IMAGE_ORIGINAL) {
            return fakeResponse({ url, headers: { 'content-type': 'image/jpeg' }, bytes: jpegBytes() });
        }
        throw new Error(`URL inesperada: ${url}`);
    };

    const spawn = fakeSpawn({
        exitCode: 1,
        stderr: 'ERROR: [Pinterest] No video formats found!'
    });

    const result = await downloadPinterestPin(PIN_URL, {
        binary: 'yt-dlp',
        ffmpegPath: null,
        spawn,
        fetch: fetchImpl,
        tempRoot: root
    });

    assert.equal(result.ok, true);
    assert.equal(result.type, 'image');
    assert.equal(result.mimetype, 'image/jpeg');
    assert.equal(result.fileName, `pinterest-${PIN_ID}.jpg`);
    assert.equal(result.title, 'Pin de teste');
    assert.equal(result.via, 'pinterest-page');
    assert.deepEqual(fetchCalls, [PIN_URL, IMAGE_ORIGINAL]);

    await fsp.rm(root, { recursive: true, force: true });
});

test('pin de vídeo: baixa pelo yt-dlp e devolve Buffer de vídeo', async () => {
    const root = await tempRoot();
    const spawn = fakeSpawn({
        async onSpawn({ args, emitStdout }) {
            const template = args[args.indexOf('-o') + 1];
            const target = template.replace('%(ext)s', 'mp4');
            await fsp.writeFile(target, mp4Bytes());
            emitStdout(`{"title":"Vídeo de teste"}\n${target}\n`);
        }
    });

    const result = await downloadPinterestPin(VIDEO_PIN_URL, {
        binary: 'yt-dlp',
        ffmpegPath: null,
        spawn,
        fetch: async () => {
            throw new Error('não deveria consultar a página de um vídeo');
        },
        tempRoot: root,
        formatSelector: ['b']
    });

    assert.equal(result.ok, true);
    assert.equal(result.type, 'video');
    assert.equal(result.mimetype, 'video/mp4');
    assert.equal(result.fileName, 'pinterest.mp4');
    assert.equal(result.title, 'Vídeo de teste');
    assert.ok(Buffer.isBuffer(result.buffer));

    await fsp.rm(root, { recursive: true, force: true });
});

test('pin de vídeo indisponível não envia a capa como se fosse vídeo', async () => {
    const root = await tempRoot();
    const fetchImpl = async (url) => fakeResponse({
        url,
        text: `${imagePage()}<meta property="og:video" content="https://v1.pinimg.com/videos/abc.mp4">`
    });

    const spawn = fakeSpawn({
        exitCode: 1,
        stderr: 'ERROR: [Pinterest] Unable to extract video data'
    });

    const result = await downloadPinterestPin(VIDEO_PIN_URL, {
        binary: 'yt-dlp',
        ffmpegPath: null,
        spawn,
        fetch: fetchImpl,
        tempRoot: root,
        formatSelector: ['b']
    });

    assert.equal(result.ok, false);
    assert.equal(result.code, 'video_unavailable');
    assert.match(result.msg, /vídeo/i);

    await fsp.rm(root, { recursive: true, force: true });
});

test('pin.it é resolvido para a URL canônica antes de extrair a imagem', async () => {
    const fetchCalls = [];
    const shortUrl = 'https://pin.it/abc123';
    const fetchImpl = async (url) => {
        fetchCalls.push(url);
        if (url === shortUrl) return fakeResponse({ url: PIN_URL, text: imagePage() });
        if (url === IMAGE_ORIGINAL) {
            return fakeResponse({ url, headers: { 'content-type': 'image/jpeg' }, bytes: jpegBytes() });
        }
        throw new Error(`URL inesperada: ${url}`);
    };

    const result = await downloadPinterestPin(shortUrl, {
        binary: null,
        ffmpegPath: null,
        fetch: fetchImpl
    });

    assert.equal(result.ok, true);
    assert.equal(result.type, 'image');
    assert.equal(result.fileName, `pinterest-${PIN_ID}.jpg`);
    assert.deepEqual(fetchCalls, [shortUrl, IMAGE_ORIGINAL]);
});

test('link fora do Pinterest e página sem imagem falham com mensagem clara', async () => {
    const invalid = await downloadPinterestPin('https://www.pinterest.com/search/pins/?q=flor', {
        binary: null,
        fetch: async () => fakeResponse({ text: '' })
    });
    assert.equal(invalid.ok, false);
    assert.equal(invalid.code, 'invalid_url');

    const semImagem = await downloadPinterestPin(PIN_URL, {
        binary: null,
        ffmpegPath: null,
        fetch: async (url) => fakeResponse({ url, text: '<html>pin removido</html>' })
    });
    assert.equal(semImagem.ok, false);
    assert.equal(semImagem.code, 'extract_failed');
});
