import test from 'node:test';
import assert from 'node:assert/strict';
import {
    extractBalancedJson,
    extractYtInitialPlayerResponse,
    prepareAudio as prepareAudioRaw,
    prepareVideo as prepareVideoRaw,
    searchYoutube
} from '../../dados/src/funcs/api/providers/local/youtube.js';
import { ApiError, ErrorCodes } from '../../dados/src/funcs/api/errors.js';

const DIRECT_ONLY = {
    config: { api: { youtube: { useYtDlp: false } } },
    env: {}
};

const YT_DLP_ENABLED = {
    config: { api: { youtube: { useYtDlp: true } } },
    env: {}
};

function prepareAudio(input, options = {}) {
    return prepareAudioRaw(input, { ...DIRECT_ONLY, ...options });
}

function prepareVideo(input, options = {}) {
    return prepareVideoRaw(input, { ...DIRECT_ONLY, ...options });
}

function playerResponse(overrides = {}) {
    return {
        playabilityStatus: { status: 'OK' },
        videoDetails: {
            videoId: 'dQw4w9WgXcQ',
            title: 'Música de teste',
            author: 'Canal',
            lengthSeconds: '120',
            viewCount: '1000',
            shortDescription: 'Descrição',
            isLive: false
        },
        microformat: {
            playerMicroformatRenderer: {
                publishDate: '2024-01-01',
                thumbnail: {
                    thumbnails: [{ url: 'https://cdn.example/thumb.jpg' }]
                }
            }
        },
        streamingData: {
            formats: [],
            adaptiveFormats: []
        },
        ...overrides
    };
}

function watchHtml(player) {
    return `<html><script>var ytInitialPlayerResponse = ${JSON.stringify(player)};</script></html>`;
}

function fakeHttp(html) {
    return {
        calls: [],
        async getText(url, options) {
            this.calls.push({ url, options });
            return { data: html };
        }
    };
}

function audioFormat(overrides = {}) {
    return {
        itag: 140,
        mimeType: 'audio/mp4; codecs="mp4a.40.2"',
        bitrate: 128000,
        url: 'https://googlevideo.example/audio.m4a',
        ...overrides
    };
}

function videoFormat(overrides = {}) {
    return {
        itag: 18,
        mimeType: 'video/mp4; codecs="avc1.42001E, mp4a.40.2"',
        height: 360,
        bitrate: 600000,
        audioCodecs: 'mp4a.40.2',
        url: 'https://googlevideo.example/video.mp4',
        ...overrides
    };
}

test('busca local normaliza resultado do yt-search', async () => {
    const result = await searchYoutube('teste', {
        search: async () => ({
            videos: [{
                videoId: 'dQw4w9WgXcQ',
                url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                title: 'Música',
                author: { name: 'Canal' },
                seconds: 120,
                timestamp: '2:00',
                views: 1000,
                ago: 'há 1 dia',
                description: 'Descrição',
                thumbnail: 'https://cdn.example/thumb.jpg'
            }]
        })
    });

    assert.equal(result.videoId, 'dQw4w9WgXcQ');
    assert.equal(result.author, 'Canal');
    assert.equal(result.durationSeconds, 120);
});

test('busca local sem vídeos permite fallback', async () => {
    await assert.rejects(
        searchYoutube('nada', {
            search: async () => ({ videos: [] })
        }),
        (error) => error.code === ErrorCodes.UNSUPPORTED && error.recoverable === true
    );
});

test('busca local converte erro inesperado em NETWORK', async () => {
    await assert.rejects(
        searchYoutube('erro', {
            search: async () => { throw new Error('falhou'); }
        }),
        (error) => error.code === ErrorCodes.NETWORK
    );
});

test('busca local respeita timeout', async () => {
    await assert.rejects(
        searchYoutube('lento', {
            timeoutMs: 5,
            search: () => new Promise(() => {})
        }),
        (error) => error.code === ErrorCodes.TIMEOUT
    );
});

test('extrai JSON do player mesmo com chaves dentro de strings', () => {
    const html = '<script>var ytInitialPlayerResponse = {"title":"a } \\" b","streamingData":{}};</script>';
    const parsed = extractYtInitialPlayerResponse(html);

    assert.equal(parsed.title, 'a } " b');
});

test('extrai objeto JSON balanceado com escapes', () => {
    const json = extractBalancedJson('xx {"a":"b\\\\\\"c","d":{"e":1}} yy', 3);
    assert.equal(json, '{"a":"b\\\\\\"c","d":{"e":1}}');
});

test('aceita somente atribuição direta do player', () => {
    assert.throws(
        () => extractYtInitialPlayerResponse(
            '<script>const x = ytInitialPlayerResponse; var y = {"streamingData":{}};</script>'
        ),
        (error) => error.code === ErrorCodes.UPSTREAM
    );
    assert.throws(
        () => extractYtInitialPlayerResponse(
            '<script>foo.ytInitialPlayerResponse = {"streamingData":{}};</script>'
        ),
        (error) => error.code === ErrorCodes.UPSTREAM
    );
});

test('ignora marcador em string/comentário e aceita window', () => {
    const player = playerResponse();
    const html = `<script>
        const texto = 'ytInitialPlayerResponse = {"streamingData":{}}';
        /* ytInitialPlayerResponse = {} */
        window["ytInitialPlayerResponse"] = ${JSON.stringify(player)};
    </script>`;

    const parsed = extractYtInitialPlayerResponse(html);
    assert.equal(parsed.videoDetails.title, 'Música de teste');

    const dot = extractYtInitialPlayerResponse(
        `<script>window.ytInitialPlayerResponse = ${JSON.stringify(player)};</script>`
    );
    assert.equal(dot.videoDetails.videoId, 'dQw4w9WgXcQ');
});

test('tenta a próxima atribuição quando o JSON é inválido', () => {
    const player = playerResponse();
    const html = `<script>
        var ytInitialPlayerResponse = {"streamingData":;
        var ytInitialPlayerResponse = ${JSON.stringify(player)};
    </script>`;

    assert.equal(extractYtInitialPlayerResponse(html).videoDetails.title, 'Música de teste');
    assert.throws(
        () => extractYtInitialPlayerResponse(
            '<script>var ytInitialPlayerResponse = {"streamingData":{</script>'
        ),
        (error) => error.code === ErrorCodes.UPSTREAM
    );
});

test('parser não executa scripts da página', () => {
    const key = '__nazuna_player_probe__';
    delete globalThis[key];
    const html = `<script>globalThis.${key} = true; var ytInitialPlayerResponse = ${JSON.stringify(playerResponse())};</script>`;

    extractYtInitialPlayerResponse(html);

    assert.equal(globalThis[key], undefined);
});

test('áudio local escolhe faixa mp4 direta e monta metadata', async () => {
    const http = fakeHttp(watchHtml(playerResponse({
        streamingData: {
            formats: [],
            adaptiveFormats: [
                audioFormat({ itag: 251, mimeType: 'audio/webm', bitrate: 160000, url: 'https://googlevideo.example/audio.webm' }),
                audioFormat()
            ]
        }
    })));

    const result = await prepareAudio(
        { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
        { http }
    );

    assert.equal(result.remoteUrl, 'https://googlevideo.example/audio.m4a');
    assert.equal(result.mimetype, 'audio/mp4');
    assert.equal(result.extension, '.m4a');
    assert.equal(result.fileName, 'Música de teste.m4a');
    assert.equal(result.meta.title, 'Música de teste');
    assert.equal(result.meta.durationSeconds, 120);
    assert.equal(http.calls[0].url, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
});

test('vídeo local escolhe formato progressivo mp4 direto', async () => {
    const http = fakeHttp(watchHtml(playerResponse({
        streamingData: {
            formats: [
                videoFormat({ height: 720, url: 'https://googlevideo.example/video720.mp4' }),
                videoFormat({ height: 360, url: 'https://googlevideo.example/video360.mp4' })
            ],
            adaptiveFormats: [audioFormat()]
        }
    })));

    const result = await prepareVideo(
        { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
        { http }
    );

    assert.equal(result.remoteUrl, 'https://googlevideo.example/video720.mp4');
    assert.equal(result.mimetype, 'video/mp4');
    assert.equal(result.extension, '.mp4');
    assert.equal(result.meta.videoId, 'dQw4w9WgXcQ');
});

test('áudio local ignora faixas de vídeo adaptativas', async () => {
    const http = fakeHttp(watchHtml(playerResponse({
        streamingData: {
            formats: [],
            adaptiveFormats: [
                videoFormat({
                    mimeType: 'video/mp4; codecs="avc1.42001E"',
                    audioCodecs: 'none',
                    url: 'https://googlevideo.example/video-only.mp4'
                }),
                audioFormat()
            ]
        }
    })));

    const result = await prepareAudio(
        { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
        { http }
    );

    assert.equal(result.remoteUrl, 'https://googlevideo.example/audio.m4a');
    assert.equal(result.mimetype, 'audio/mp4');
});

test('vídeo local rejeita progressivo WebM', async () => {
    const http = fakeHttp(watchHtml(playerResponse({
        streamingData: {
            formats: [
                videoFormat({
                    mimeType: 'video/webm; codecs="vp9, opus"',
                    url: 'https://googlevideo.example/video.webm'
                })
            ],
            adaptiveFormats: []
        }
    })));

    await assert.rejects(
        prepareVideo(
            { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
            { http }
        ),
        (error) => error.code === ErrorCodes.UNSUPPORTED
    );
});

test('mídia local rejeita formato sem URL direta e sem cipher', async () => {
    const http = fakeHttp(watchHtml(playerResponse({
        streamingData: {
            formats: [],
            adaptiveFormats: [{
                itag: 140,
                mimeType: 'audio/mp4',
                bitrate: 128000
            }]
        }
    })));

    await assert.rejects(
        prepareAudio(
            { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
            { http }
        ),
        (error) => error.code === ErrorCodes.UPSTREAM
            && /adaptativo de servidor/i.test(error.userMessage)
    );
});

test('mídia local relata streaming adaptativo de servidor', async () => {
    const http = fakeHttp(watchHtml(playerResponse({
        streamingData: {
            expiresInSeconds: '21540',
            serverAbrStreamingUrl: 'https://rr3---sn.example.googlevideo.com/abr_stream',
            adaptiveFormats: [
                {
                    itag: 140,
                    mimeType: 'audio/mp4; codecs="mp4a.40.2"',
                    bitrate: 130797,
                    contentLength: '4759811',
                    approxDurationMs: '294057'
                },
                {
                    itag: 251,
                    mimeType: 'audio/webm; codecs="opus"',
                    bitrate: 145145,
                    contentLength: '4923854',
                    approxDurationMs: '294021'
                }
            ]
        }
    })));

    await assert.rejects(
        prepareAudio(
            { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
            { http }
        ),
        (error) => error.code === ErrorCodes.UPSTREAM
            && error.recoverable === true
            && /adaptativo de servidor/i.test(error.userMessage)
            && !/Nenhuma faixa de áudio/i.test(error.message)
    );

    await assert.rejects(
        prepareVideo(
            { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
            { http }
        ),
        (error) => error.code === ErrorCodes.UPSTREAM
            && /adaptativo de servidor/i.test(error.userMessage)
    );
});

test('mídia local distingue ausência real de faixa de áudio', async () => {
    const http = fakeHttp(watchHtml(playerResponse({
        streamingData: {
            formats: [],
            adaptiveFormats: []
        }
    })));

    await assert.rejects(
        prepareAudio(
            { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
            { http }
        ),
        (error) => error.code === ErrorCodes.UNSUPPORTED
            && /Nenhuma faixa de áudio/i.test(error.message)
    );
});

test('mídia local rejeita transmissão ao vivo', async () => {
    const http = fakeHttp(watchHtml(playerResponse({
        videoDetails: {
            ...playerResponse().videoDetails,
            isLive: true
        }
    })));

    await assert.rejects(
        prepareAudio(
            { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
            { http }
        ),
        (error) => error.code === ErrorCodes.UNSUPPORTED
            && String(error.userMessage).includes('ao vivo')
    );
});

test('erro HTTP de bloqueio do YouTube não vira erro de api-key', async () => {
    const http = {
        async getText() {
            throw new ApiError(ErrorCodes.AUTH_INVALID, { details: { status: 403 } });
        }
    };

    await assert.rejects(
        prepareAudio(
            { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
            { http }
        ),
        (error) => error.code === ErrorCodes.UPSTREAM
            && error.recoverable === true
            && !String(error.userMessage).includes('api-key')
    );
});

test('provider local usa yt-dlp quando o YouTube não devolve URL direta', async () => {
    const http = fakeHttp(watchHtml(playerResponse({
        streamingData: {
            expiresInSeconds: '21540',
            serverAbrStreamingUrl: 'https://rr3---sn.example.googlevideo.com/abr_stream',
            adaptiveFormats: [{
                itag: 140,
                mimeType: 'audio/mp4; codecs="mp4a.40.2"',
                bitrate: 130797,
                contentLength: '4759811'
            }]
        }
    })));

    let ytdlpCalls = 0;
    let ytdlpOptions = null;
    const ytdlp = {
        async findYtDlpBinary() { return 'C:/fake/yt-dlp.exe'; },
        async findFfmpegBinary() { return null; },
        async prepareMediaWithYtDlp(kind, input, options) {
            ytdlpCalls++;
            ytdlpOptions = options;
            assert.equal(kind, 'audio');
            assert.equal(options.binary, 'C:/fake/yt-dlp.exe');
            return {
                filePath: 'C:/tmp/nazuna/media.m4a',
                sizeBytes: 1024,
                meta: { title: 'Música de teste' },
                mimetype: 'audio/mp4',
                extension: '.m4a',
                fileName: 'Música de teste.m4a',
                cleanupPaths: ['C:/tmp/nazuna']
            };
        }
    };

    const result = await prepareAudio(
        { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
        { http, ytdlp, ...YT_DLP_ENABLED }
    );

    assert.equal(ytdlpCalls, 1);
    assert.equal(ytdlpOptions.ffmpegPath, null);
    assert.equal(result.filePath, 'C:/tmp/nazuna/media.m4a');
    assert.equal(result.mimetype, 'audio/mp4');
    assert.equal(result.extension, '.m4a');
    assert.equal(result.remoteUrl, undefined);
});

test('provider local explica a falta do yt-dlp sem quebrar o download direto', async () => {
    const http = fakeHttp(watchHtml(playerResponse({
        streamingData: {
            serverAbrStreamingUrl: 'https://rr3---sn.example.googlevideo.com/abr_stream',
            adaptiveFormats: [{
                itag: 140,
                mimeType: 'audio/mp4; codecs="mp4a.40.2"',
                bitrate: 130797
            }]
        }
    })));

    const ytdlp = {
        async findYtDlpBinary() { return null; },
        async findFfmpegBinary() { return null; },
        async prepareMediaWithYtDlp() { throw new Error('não deveria ser chamado'); }
    };

    await assert.rejects(
        prepareAudio(
            { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
            { http, ytdlp, ...YT_DLP_ENABLED }
        ),
        (error) => error.code === ErrorCodes.UPSTREAM
            && /adaptativo de servidor/i.test(error.userMessage)
            && /yt-dlp/i.test(error.userMessage)
            && /api\.youtube\.ytDlpPath/.test(error.userMessage)
            && error.details.ytDlpAvailable === false
    );
});

test('provider local não chama yt-dlp quando a URL direta funciona', async () => {
    const http = fakeHttp(watchHtml(playerResponse({
        streamingData: {
            formats: [],
            adaptiveFormats: [audioFormat()]
        }
    })));

    const ytdlp = {
        async findYtDlpBinary() { throw new Error('yt-dlp não deveria ser consultado'); },
        async findFfmpegBinary() { throw new Error('yt-dlp não deveria ser consultado'); },
        async prepareMediaWithYtDlp() { throw new Error('yt-dlp não deveria ser chamado'); }
    };

    const result = await prepareAudio(
        { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
        { http, ytdlp, ...YT_DLP_ENABLED }
    );

    assert.equal(result.remoteUrl, 'https://googlevideo.example/audio.m4a');
    assert.equal(result.filePath, undefined);
});

test('provider local desliga o yt-dlp quando configurado', async () => {
    const http = fakeHttp(watchHtml(playerResponse({
        streamingData: {
            serverAbrStreamingUrl: 'https://rr3---sn.example.googlevideo.com/abr_stream',
            adaptiveFormats: [{
                itag: 140,
                mimeType: 'audio/mp4; codecs="mp4a.40.2"',
                bitrate: 130797
            }]
        }
    })));

    const ytdlp = {
        async findYtDlpBinary() { throw new Error('yt-dlp não deveria ser consultado'); },
        async findFfmpegBinary() { throw new Error('yt-dlp não deveria ser consultado'); },
        async prepareMediaWithYtDlp() { throw new Error('yt-dlp não deveria ser chamado'); }
    };

    await assert.rejects(
        prepareAudio(
            { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
            {
                http,
                ytdlp,
                config: { api: { youtube: { useYtDlp: false } } },
                env: {}
            }
        ),
        (error) => error.code === ErrorCodes.UPSTREAM
            && /adaptativo de servidor/i.test(error.userMessage)
    );
});

test('mídia local exige streamingData no player', async () => {
    const player = playerResponse();
    delete player.streamingData;
    const http = fakeHttp(watchHtml(player));

    await assert.rejects(
        prepareAudio(
            { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
            { http }
        ),
        (error) => error.code === ErrorCodes.UPSTREAM
    );
});

test('mídia local informa bloqueio quando só há signatureCipher', async () => {
    const http = fakeHttp(watchHtml(playerResponse({
        streamingData: {
            formats: [],
            adaptiveFormats: [{
                itag: 140,
                mimeType: 'audio/mp4',
                bitrate: 128000,
                signatureCipher: 's=abc&url=https%3A%2F%2Fgooglevideo.example%2Faudio'
            }]
        }
    })));

    await assert.rejects(
        prepareAudio(
            { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
            { http }
        ),
        (error) => error.code === ErrorCodes.DEPENDENCY_MISSING
            && String(error.userMessage).includes('yt-dlp')
    );
});

test('vídeo local informa necessidade de FFmpeg para faixas separadas', async () => {
    const http = fakeHttp(watchHtml(playerResponse({
        streamingData: {
            formats: [],
            adaptiveFormats: [
                videoFormat({ url: 'https://googlevideo.example/video-only.mp4', audioCodecs: 'none', mimeType: 'video/mp4' }),
                audioFormat()
            ]
        }
    })));

    await assert.rejects(
        prepareVideo(
            { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
            { http }
        ),
        (error) => error.code === ErrorCodes.DEPENDENCY_MISSING
            && String(error.userMessage).includes('FFmpeg')
    );
});

test('distingue login/anti-bot de restrição de idade', async () => {
    const http = fakeHttp(watchHtml(playerResponse({
        playabilityStatus: {
            status: 'LOGIN_REQUIRED',
            reason: 'Sign in to confirm you are not a bot'
        }
    })));

    await assert.rejects(
        prepareAudio(
            { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
            { http }
        ),
        (error) => error.code === ErrorCodes.UNSUPPORTED
            && /login|verificação/i.test(error.userMessage)
            && !String(error.userMessage).includes('restrição de idade')
    );
});

test('rejeita restrição de idade e página sem player', async () => {
    const restricted = fakeHttp(watchHtml(playerResponse({
        playabilityStatus: {
            status: 'LOGIN_REQUIRED',
            reason: 'Sign in to confirm your age'
        }
    })));

    await assert.rejects(
        prepareAudio(
            { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
            { http: restricted }
        ),
        (error) => error.code === ErrorCodes.UNSUPPORTED
            && String(error.userMessage).includes('restrição de idade')
    );

    await assert.rejects(
        prepareAudio(
            { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
            { http: fakeHttp('<html>sem player</html>') }
        ),
        (error) => error.code === ErrorCodes.UPSTREAM
    );
});
