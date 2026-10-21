import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildDownloadUrl,
    buildSearchUrl,
    prepareAudio,
    prepareVideo,
    searchYoutube
} from '../../dados/src/funcs/api/providers/vex/youtube.js';
import { ErrorCodes } from '../../dados/src/funcs/api/errors.js';

const config = {
    site_vex: 'https://vex.example/',
    apikey_vex: 'secret-key'
};

function fakeHttp(payload, requestResponse = { status: 200, data: '{"ok":true}' }) {
    return {
        calls: [],
        async request(options) {
            this.calls.push({ type: 'request', options });
            return requestResponse;
        },
        async getJson(url, options) {
            this.calls.push({ type: 'json', url, options });
            return { data: payload };
        }
    };
}

const verifyKey = async () => {};

test('monta URLs de busca e download com parâmetros codificados', () => {
    const settings = { siteVex: 'https://vex.example', apiKey: 'secret-key' };

    assert.equal(
        buildSearchUrl('Olá mundo', settings),
        'https://vex.example/api/pesquisa/youtube?apikey=secret-key&query=Ol%C3%A1%20mundo'
    );
    assert.equal(
        buildDownloadUrl('audio', 'https://youtu.be/abc', settings),
        'https://vex.example/api/downloads/youtubemp3?apikey=secret-key&query=https%3A%2F%2Fyoutu.be%2Fabc'
    );
    assert.match(buildDownloadUrl('video', 'https://youtu.be/abc', settings), /youtubemp4/);
});

test('busca normaliza autor e duração', async () => {
    const http = fakeHttp({
        status: true,
        results: [{
            videoId: 'dQw4w9WgXcQ',
            title: 'Música',
            author: 'Canal',
            seconds: 120,
            timestamp: '2:00',
            views: 1000,
            ago: 'há 1 dia',
            thumbnail: 'https://cdn.example/thumb.jpg'
        }]
    });

    const result = await searchYoutube('teste', { config, http, verifyKey });

    assert.equal(result.videoId, 'dQw4w9WgXcQ');
    assert.equal(result.author, 'Canal');
    assert.equal(result.durationSeconds, 120);
    assert.equal(result.url, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    assert.equal(http.calls[0].url, 'https://vex.example/api/pesquisa/youtube?apikey=secret-key&query=teste');
    assert.equal(http.calls[0].options.maxBytes, 2 * 1024 * 1024);
});

test('prepara áudio e vídeo a partir da resposta da Vex', async () => {
    const audioHttp = fakeHttp({
        status: true,
        resposta: {
            dlurl: 'https://cdn.example/audio.mp3',
            title: 'Música',
            author: 'Canal',
            seconds: 60
        }
    });

    const audio = await prepareAudio(
        { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
        { config, http: audioHttp, verifyKey }
    );

    assert.equal(audio.remoteUrl, 'https://cdn.example/audio.mp3');
    assert.equal(audio.mimetype, 'audio/mpeg');
    assert.equal(audio.extension, '.mp3');
    assert.equal(audio.fileName, 'Música.mp3');
    assert.match(audioHttp.calls[0].url, /\/youtubemp3/);

    const videoHttp = fakeHttp({
        status: true,
        resposta: {
            dlurl: 'https://cdn.example/video.mp4',
            title: 'Vídeo',
            seconds: 60
        }
    });
    const video = await prepareVideo(
        { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
        { config, http: videoHttp, verifyKey }
    );

    assert.equal(video.remoteUrl, 'https://cdn.example/video.mp4');
    assert.equal(video.mimetype, 'video/mp4');
    assert.equal(video.extension, '.mp4');
    assert.match(videoHttp.calls[0].url, /\/youtubemp4/);
});

test('mapeia erros da Vex sem expor a chave', async () => {
    const limited = fakeHttp({ status: true, error: 'Limite diário atingido' });
    await assert.rejects(
        searchYoutube('teste', { config, http: limited, verifyKey }),
        (error) => error.code === ErrorCodes.RATE_LIMITED
    );

    const auth = fakeHttp({ status: true, error: 'api key inválida' });
    await assert.rejects(
        searchYoutube('teste', { config, http: auth, verifyKey }),
        (error) => error.code === ErrorCodes.AUTH_INVALID
    );

    const failed = fakeHttp({ status: false, error: 'Serviço indisponível' });
    try {
        await searchYoutube('teste', { config, http: failed, verifyKey });
        assert.fail('deveria falhar');
    } catch (error) {
        assert.equal(error.code, ErrorCodes.UPSTREAM);
        assert.ok(!String(error.userMessage).includes('secret-key'));
    }
});

test('não chama HTTP quando falta configuração', async () => {
    const http = fakeHttp({ status: true, results: [] });

    await assert.rejects(
        searchYoutube('teste', {
            config: { site_vex: 'https://vex.example' },
            http,
            verifyKey
        }),
        (error) => error.code === ErrorCodes.CONFIG_MISSING
    );
    assert.equal(http.calls.length, 0);
});

test('verifica a chave antes da busca quando não há injeção', async () => {
    const http = fakeHttp({
        status: true,
        results: [{ videoId: 'dQw4w9WgXcQ', title: 'Teste', seconds: 1 }]
    });

    const result = await searchYoutube('teste', { config, http });

    assert.equal(result.videoId, 'dQw4w9WgXcQ');
    assert.equal(http.calls[0].type, 'request');
    assert.match(http.calls[0].options.url, /\/api\/verificarkey/);
    assert.equal(http.calls[1].type, 'json');
});
