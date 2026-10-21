import test from 'node:test';
import assert from 'node:assert/strict';

import soundcloud from '../../dados/src/funcs/downloads/soundcloud.js';

const CLIENT_ID = 'z7SdppGR2n32vjiLbTeRJnOdA3dFn6Nn';
const TRACK_URL = 'https://soundcloud.com/dj-flux2/michael-jackson-billie-jean';

// URLs distintas por teste: o cache do modulo e compartilhado
const urlFor = (name) => `${TRACK_URL}?caso=${name}`;

function jsonResponse(body, ok = true, status = 200) {
    return {
        ok,
        status,
        json: async () => body,
        text: async () => JSON.stringify(body)
    };
}

function textResponse(body) {
    return {
        ok: true,
        status: 200,
        text: async () => body,
        json: async () => JSON.parse(body)
    };
}

function bufferResponse(buffer) {
    return { data: buffer };
}

function makeOptions(overrides = {}) {
    const calls = { pages: [], tracks: [], buffers: [] };

    const fetchImpl = async (url) => {
        const href = String(url);
        calls.pages.push(href);

        if (href.startsWith('https://soundcloud.com/')) {
            return textResponse('<html><script src="https://a-v2.sndcdn.com/assets/55-x.js"></script></html>');
        }
        if (href.includes('/assets/55-x.js')) {
            return textResponse(`var x={"client_id":"${CLIENT_ID}"};`);
        }
        if (href.includes('/search/tracks')) {
            return jsonResponse({
                collection: [{
                    id: 2404577784,
                    title: 'Michael Jackson - Billie Jean',
                    duration: 283528,
                    permalink_url: TRACK_URL,
                    user: { username: 'DJ FLUX' },
                    artwork_url: 'https://i1.sndcdn.com/artra.jpg'
                }]
            });
        }
        if (href.includes('/tracks/2404577784') || href.includes('/resolve?')) {
            return jsonResponse({
                title: 'Michael Jackson - Billie Jean',
                user: { username: 'DJ FLUX' },
                artwork_url: 'https://i1.sndcdn.com/artra.jpg',
                media: {
                    transcodings: (overrides.transcodings ?? [{
                        preset: 'mp3_0_0',
                        format: { protocol: 'progressive', mime_type: 'audio/mpeg' },
                        url: 'https://api.media.soundcloud.com/tracks/1/stream/progressive'
                    }])
                }
            });
        }
        if (href.includes('/stream/progressive')) {
            return jsonResponse({ url: overrides.progressiveUrl ?? 'https://cf-media.sndcdn.com/track.mp3' });
        }
        if (href.includes('/stream/hls')) {
            return jsonResponse({ url: 'https://playback.media-streaming.soundcloud.cloud/playlist.m3u8' });
        }
        if (href.endsWith('.m3u8')) {
            return textResponse([
                '#EXTM3U',
                '#EXT-X-MAP:URI="init.mp4"',
                '#EXTINF:9.0,',
                'seg1.mp4',
                '#EXTINF:9.0,',
                'seg2.mp4',
                ''
            ].join('\n'));
        }

        return jsonResponse({}, false, 404);
    };

    const mediaClient = {
        async get(url) {
            calls.buffers.push(String(url));
            if (String(url).endsWith('init.mp4')) return bufferResponse(Buffer.from('00000018737479706d736468', 'hex'));
            if (String(url).endsWith('seg1.mp4') || String(url).endsWith('seg2.mp4')) {
                return bufferResponse(Buffer.concat([Buffer.from('0000001c6d6f6f66', 'hex'), Buffer.alloc(2048)]));
            }
            return bufferResponse(Buffer.concat([Buffer.from('ID3fake-audio'), Buffer.alloc(4096)]));
        }
    };

    return { options: { fetchImpl, mediaClient, ...(overrides.options || {}) }, calls };
}

test('busca nativa do SoundCloud devolve os tracks normalizados', async () => {
    const { options } = makeOptions();

    const result = await soundcloud.search('billie jean', 3, options);

    assert.equal(result.ok, true);
    assert.equal(result.origem, 'nativo');
    assert.equal(result.results.length, 1);
    assert.equal(result.results[0].artist, 'DJ FLUX');
    assert.equal(result.results[0].permalink_url, TRACK_URL);
});

test('download progressivo devolve o audio e o mime coerente', async () => {
    const { options } = makeOptions();

    const result = await soundcloud.download(urlFor('progressivo'), options);

    assert.equal(result.ok, true);
    assert.equal(result.mimetype, 'audio/mpeg');
    assert.match(result.filename, /\.mp3$/);
    assert.ok(result.buffer.length > 1024);
});

test('link do SoundCloud invalido devolve erro claro, sem Invalid URL', async () => {
    const { options } = makeOptions();

    const result = await soundcloud.download('nao-e-uma-url', options);

    assert.equal(result.ok, false);
    assert.match(result.msg, /Link do SoundCloud/i);
    assert.doesNotMatch(result.msg, /Invalid URL/i);
});

test('resultado sem permalink valido devolve erro claro', async () => {
    const { options } = makeOptions();
    options.fetchImpl = async (url) => {
        const href = String(url);
        if (href.startsWith('https://soundcloud.com/')) return textResponse('<html></html>');
        if (href.includes('/search/tracks')) {
            return jsonResponse({
                collection: [{
                    id: 1,
                    title: 'Sem link',
                    duration: 1000,
                    permalink_url: null,
                    user: { username: 'x' }
                }]
            });
        }
        return jsonResponse({}, false, 404);
    };

    const result = await soundcloud.searchDownload('sem link', options);

    assert.equal(result.ok, false);
    assert.match(result.msg, /link/i);
    assert.doesNotMatch(result.msg, /Invalid URL/i);
});

test('faixa sem stream de audio devolve erro util', async () => {
    const { options } = makeOptions({ transcodings: [] });

    const result = await soundcloud.download(urlFor('sem-stream'), options);

    assert.equal(result.ok, false);
    assert.match(result.msg, /stream/i);
});

test('audio vazio ou invalido e rejeitado', async () => {
    const { options } = makeOptions();
    options.mediaClient = { async get() { return bufferResponse(Buffer.alloc(10)); } };

    const empty = await soundcloud.download(urlFor('vazio'), options);
    assert.equal(empty.ok, false);
    assert.match(empty.msg, /vazio|incompleto/i);

    const { options: options2 } = makeOptions();
    options2.mediaClient = { async get() { return bufferResponse(Buffer.concat([Buffer.from('<html>erro</html>'), Buffer.alloc(4096)])); } };

    const invalid = await soundcloud.download(urlFor('invalido'), options2);
    assert.equal(invalid.ok, false);
    assert.match(invalid.msg, /válido/i);
});

test('stream HLS de audio/mp4 e montado em um unico arquivo m4a', async () => {
    const { options, calls } = makeOptions({
        transcodings: [{
            preset: 'aac_96k',
            format: { protocol: 'hls', mime_type: 'audio/mp4; codecs="mp4a.40.2"' },
            url: 'https://api.media.soundcloud.com/tracks/1/stream/hls'
        }]
    });

    const result = await soundcloud.download(urlFor('hls'), options);

    assert.equal(result.ok, true);
    assert.equal(result.mimetype, 'audio/mp4');
    assert.match(result.filename, /\.m4a$/);
    assert.ok(result.buffer.length > 1024);
    assert.ok(calls.buffers.some((url) => url.endsWith('init.mp4')));
    assert.ok(calls.buffers.some((url) => url.endsWith('seg1.mp4')));
    assert.ok(calls.buffers.some((url) => url.endsWith('seg2.mp4')));
});

test('download_url nulo do serviço auxiliar vira erro com etapa (nunca "Invalid URL")', async () => {
    const { options } = makeOptions();

    // a resolucao nativa falha (sem client_id) e o servico auxiliar devolve null
    options.fetchImpl = async () => { throw new Error('sem rede'); };
    options.axios = {
        async get() {
            return { data: { status: 200, data: { title: 'X', artist: 'Y', download_url: null } } };
        }
    };
    options.mediaClient = {
        async get() {
            throw new Error('Invalid URL');
        }
    };

    const result = await soundcloud.download(urlFor('auxiliar-null'), options);

    assert.equal(result.ok, false);
    assert.notEqual(result.msg, 'Invalid URL');
    assert.ok(result.etapa, 'o erro deve informar a etapa');
    assert.ok(result.provider, 'o erro deve informar o provider');
    assert.match(result.msg, /URL de áudio válida|falha/i);
});

test('o provider identifica a origem e as etapas no resultado', async () => {
    const { options } = makeOptions();

    const busca = await soundcloud.search('billie jean', 3, options);
    assert.equal(busca.provider, 'nativo-v2');
    assert.equal(busca.origem, 'nativo');
    assert.equal(busca.total, 1);

    const download = await soundcloud.download(urlFor('etapas'), options);
    assert.equal(download.provider, 'nativo-v2');
    assert.equal(download.etapa, 'resolucao');
    assert.equal(download.mimetype, 'audio/mpeg');
    assert.match(download.filename, /\.mp3$/);
});

test('searchDownload entrega faixa, autor e thumbnail', async () => {
    const { options } = makeOptions();

    const result = await soundcloud.searchDownload('billie jean', options);

    assert.equal(result.ok, true);
    assert.equal(result.title, 'Michael Jackson - Billie Jean');
    assert.equal(result.artist, 'DJ FLUX');
    assert.equal(result.mimetype, 'audio/mpeg');
    assert.ok(result.buffer.length > 1024);
    assert.equal(result.track.permalink_url, TRACK_URL);
});
