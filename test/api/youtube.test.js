import test from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
    normalizeYoutubeInput,
    normalizeYoutubeSearchData,
    runYoutubeAudio,
    runYoutubeSearch,
    runYoutubeVideo,
    YOUTUBE_MAX_DURATION_SECONDS
} from '../../dados/src/funcs/api/features/youtube.js';
import { BoundedCache } from '../../dados/src/funcs/api/cache.js';
import { ConcurrencyLimiter } from '../../dados/src/funcs/api/limiter.js';
import { ApiError, ErrorCodes } from '../../dados/src/funcs/api/errors.js';

const videoId = 'dQw4w9WgXcQ';

function isolated() {
    return {
        cache: new BoundedCache({ maxEntries: 20, maxBytes: 1024 * 1024 }),
        limiter: new ConcurrencyLimiter({ maxConcurrent: 2, maxQueue: 10 })
    };
}

function video(overrides = {}) {
    return {
        videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title: 'Vídeo de teste',
        author: 'Canal de teste',
        seconds: 120,
        timestamp: '2:00',
        views: 1000,
        ago: 'há 1 dia',
        description: 'Descrição',
        thumbnail: 'https://cdn.example/thumb.jpg',
        ...overrides
    };
}

function providerSet(overrides = {}) {
    return {
        local: {
            search: async () => video(),
            audio: async () => ({ remoteUrl: 'https://cdn.example/audio.mp3' }),
            video: async () => ({ remoteUrl: 'https://cdn.example/video.mp4' }),
            ...(overrides.local || {})
        },
        vex: {
            search: async () => video(),
            audio: async () => ({ remoteUrl: 'https://cdn.example/audio.mp3' }),
            video: async () => ({ remoteUrl: 'https://cdn.example/video.mp4' }),
            ...(overrides.vex || {})
        }
    };
}

test('normaliza links do YouTube e rejeita hosts/IDs inválidos', () => {
    assert.deepEqual(
        normalizeYoutubeInput('https://youtu.be/dQw4w9WgXcQ?t=10').url,
        `https://www.youtube.com/watch?v=${videoId}`
    );
    assert.equal(
        normalizeYoutubeInput(`https://www.youtube.com/shorts/${videoId}`).videoId,
        videoId
    );
    assert.equal(normalizeYoutubeInput('Back to Black').kind, 'query');

    assert.throws(
        () => normalizeYoutubeInput('https://example.com/watch?v=dQw4w9WgXcQ'),
        (error) => error.code === ErrorCodes.INPUT_INVALID
    );
    assert.throws(
        () => normalizeYoutubeInput('https://www.youtube.com/watch?v=curto'),
        (error) => error.code === ErrorCodes.INPUT_INVALID
    );
});

test('normaliza autor objeto e duração do resultado', () => {
    const data = normalizeYoutubeSearchData({
        videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title: 'Teste',
        author: { name: 'Canal' },
        duration: 90,
        views: '1.000'
    });

    assert.equal(data.author, 'Canal');
    assert.equal(data.durationSeconds, 90);
    assert.equal(data.timestamp, '1:30');
});

test('provedor padrão é local e não chama Vex', async () => {
    let vexCalls = 0;
    const providers = providerSet({
        vex: {
            search: async () => { vexCalls++; return video(); }
        }
    });
    const { cache, limiter } = isolated();

    const result = await runYoutubeSearch(
        { query: 'teste' },
        { config: {}, providers, cache, limiter, env: {} }
    );

    assert.equal(result.provider, 'local');
    assert.equal(result.data.videoId, videoId);
    assert.equal(vexCalls, 0);
});

test('vex explícito continua funcionando com fallback desativado', async () => {
    let localCalls = 0;
    let vexCalls = 0;
    const providers = providerSet({
        local: {
            search: async () => { localCalls++; return video(); }
        },
        vex: {
            search: async () => { vexCalls++; return video(); }
        }
    });
    const { cache, limiter } = isolated();

    const result = await runYoutubeSearch(
        { query: 'teste' },
        {
            provider: 'vex',
            config: { api: { youtube: { allowVexFallback: false } } },
            providers,
            cache,
            limiter,
            env: {}
        }
    );

    assert.equal(result.provider, 'vex');
    assert.equal(localCalls, 0);
    assert.equal(vexCalls, 1);
});

test('auto sem fallback habilitado não chama Vex', async () => {
    let vexCalls = 0;
    const providers = providerSet({
        local: {
            search: async () => { throw new ApiError(ErrorCodes.NETWORK); }
        },
        vex: {
            search: async () => { vexCalls++; return video(); }
        }
    });
    const { cache, limiter } = isolated();

    await assert.rejects(
        runYoutubeSearch(
            { query: 'teste' },
            { provider: 'auto', config: {}, providers, cache, limiter, env: {} }
        ),
        (error) => error.code === ErrorCodes.NETWORK
    );
    assert.equal(vexCalls, 0);
});

test('auto com fallback habilitado usa Vex apenas em erro recuperável', async () => {
    let vexCalls = 0;
    const providers = providerSet({
        local: {
            search: async () => { throw new ApiError(ErrorCodes.NETWORK); }
        },
        vex: {
            search: async () => { vexCalls++; return video(); }
        }
    });
    const { cache, limiter } = isolated();

    const result = await runYoutubeSearch(
        { query: 'teste' },
        {
            provider: 'auto',
            config: { api: { youtube: { allowVexFallback: true } } },
            providers,
            cache,
            limiter,
            env: {}
        }
    );

    assert.equal(result.provider, 'vex');
    assert.equal(result.data.videoId, videoId);
    assert.equal(vexCalls, 1);
});

test('auto não faz fallback em erro de autenticação', async () => {
    let vexCalls = 0;
    const providers = providerSet({
        local: {
            search: async () => { throw new ApiError(ErrorCodes.AUTH_INVALID); }
        },
        vex: {
            search: async () => { vexCalls++; return video(); }
        }
    });
    const { cache, limiter } = isolated();

    await assert.rejects(
        runYoutubeSearch(
            { query: 'teste' },
            {
                provider: 'auto',
                config: { api: { youtube: { allowVexFallback: true } } },
                providers,
                cache,
                limiter,
                env: {}
            }
        ),
        (error) => error.code === ErrorCodes.AUTH_INVALID
    );
    assert.equal(vexCalls, 0);
});

test('cache evita repetir a mesma busca por provedor', async () => {
    let calls = 0;
    const providers = providerSet({
        vex: {
            search: async () => { calls++; return video(); }
        }
    });
    const { cache, limiter } = isolated();

    const first = await runYoutubeSearch(
        { query: 'cache' },
        { provider: 'vex', config: {}, providers, cache, limiter }
    );
    const second = await runYoutubeSearch(
        { query: 'cache' },
        { provider: 'vex', config: {}, providers, cache, limiter }
    );

    assert.equal(first.cached, false);
    assert.equal(second.cached, true);
    assert.equal(calls, 1);
});

test('rejeita vídeo acima de 1800 segundos na busca', async () => {
    const providers = providerSet({
        vex: {
            search: async () => video({ seconds: YOUTUBE_MAX_DURATION_SECONDS + 1 })
        }
    });
    const { cache, limiter } = isolated();

    await assert.rejects(
        runYoutubeSearch(
            { query: 'longo' },
            {
                provider: 'vex',
                config: {},
                providers,
                cache,
                limiter,
                maxDurationSeconds: YOUTUBE_MAX_DURATION_SECONDS
            }
        ),
        (error) => error.code === ErrorCodes.INPUT_INVALID
    );
});

test('áudio baixa via provider e repassa opções de mídia', async () => {
    let preparedInput;
    let downloadOptions;
    const providers = providerSet({
        vex: {
            audio: async (input) => {
                preparedInput = input;
                return {
                    remoteUrl: 'https://cdn.example/audio.mp3',
                    meta: { title: 'Música', durationSeconds: 120 },
                    mimetype: 'audio/mpeg',
                    extension: '.mp3',
                    fileName: 'musica.mp3'
                };
            }
        }
    });
    const { cache, limiter } = isolated();

    const result = await runYoutubeAudio(
        { url: `https://youtu.be/${videoId}` },
        {
            provider: 'vex',
            config: {},
            providers,
            cache,
            limiter,
            maxDurationSeconds: YOUTUBE_MAX_DURATION_SECONDS,
            download: async (options) => {
                downloadOptions = options;
                return { filePath: 'C:/tmp/audio.mp3', sizeBytes: 4 };
            }
        }
    );

    assert.equal(preparedInput.videoId, videoId);
    assert.equal(preparedInput.url, `https://www.youtube.com/watch?v=${videoId}`);
    assert.equal(result.provider, 'vex');
    assert.equal(result.media.fileName, 'musica.mp3');
    assert.equal(downloadOptions.url, 'https://cdn.example/audio.mp3');
    assert.equal(downloadOptions.maxBytes, 0);
    assert.equal(downloadOptions.timeoutMs, 120000);
    assert.equal(downloadOptions.maxRedirects, 3);
});

test('provedor que já baixou o arquivo local não passa pelo downloader', async () => {
    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'nazuna-ytdlp-feature-'));
    const filePath = path.join(dir, 'media.m4a');
    await fsp.writeFile(filePath, 'audio-data');

    let downloadCalls = 0;
    const providers = providerSet({
        local: {
            audio: async () => ({
                filePath,
                sizeBytes: 10,
                meta: { title: 'Música', durationSeconds: 60 },
                mimetype: 'audio/mp4',
                extension: '.m4a',
                fileName: 'musica.m4a',
                cleanupPaths: [dir]
            })
        }
    });
    const { cache, limiter } = isolated();

    const result = await runYoutubeAudio(
        { url: `https://youtu.be/${videoId}` },
        {
            provider: 'local',
            config: {},
            providers,
            cache,
            limiter,
            env: {},
            download: async () => {
                downloadCalls++;
                throw new Error('não deveria baixar pela rede');
            }
        }
    );

    assert.equal(downloadCalls, 0);
    assert.equal(result.provider, 'local');
    assert.equal(result.media.filePath, filePath);
    assert.equal(result.media.mimetype, 'audio/mp4');
    assert.equal(result.media.fileName, 'musica.m4a');
    assert.equal(result.media.sizeBytes, 10);

    await result.media.cleanup();

    await assert.rejects(fsp.stat(filePath), (error) => error.code === 'ENOENT');
    await assert.rejects(fsp.stat(dir), (error) => error.code === 'ENOENT');
});

test('URL privada do provedor local é bloqueada antes do download', async () => {
    const providers = providerSet({
        local: {
            audio: async () => ({
                remoteUrl: 'http://127.0.0.1/audio.mp3',
                meta: { durationSeconds: 60 }
            })
        }
    });
    const { cache, limiter } = isolated();

    await assert.rejects(
        runYoutubeAudio(
            { url: `https://youtu.be/${videoId}` },
            { provider: 'local', config: {}, providers, cache, limiter, env: {} }
        ),
        (error) => error.code === ErrorCodes.INPUT_INVALID
    );
});

test('auto sem fallback não tenta Vex para mídia', async () => {
    let vexAudioCalls = 0;
    const providers = providerSet({
        local: {
            audio: async () => { throw new ApiError(ErrorCodes.NETWORK); }
        },
        vex: {
            audio: async () => {
                vexAudioCalls++;
                return { remoteUrl: 'https://cdn.example/audio.mp3' };
            }
        }
    });
    const { cache, limiter } = isolated();

    await assert.rejects(
        runYoutubeAudio(
            { url: `https://youtu.be/${videoId}` },
            {
                provider: 'auto',
                config: {},
                providers,
                cache,
                limiter,
                env: {},
                download: async () => ({ filePath: 'C:/tmp/audio.mp3', sizeBytes: 4 })
            }
        ),
        (error) => error.code === ErrorCodes.NETWORK
    );
    assert.equal(vexAudioCalls, 0);
});

test('auto sem fallback não tenta Vex para vídeo', async () => {
    let vexVideoCalls = 0;
    const providers = providerSet({
        local: {
            video: async () => { throw new ApiError(ErrorCodes.NETWORK); }
        },
        vex: {
            video: async () => {
                vexVideoCalls++;
                return { remoteUrl: 'https://cdn.example/video.mp4' };
            }
        }
    });
    const { cache, limiter } = isolated();

    await assert.rejects(
        runYoutubeVideo(
            { url: `https://youtu.be/${videoId}` },
            {
                provider: 'auto',
                config: {},
                providers,
                cache,
                limiter,
                env: {},
                download: async () => ({ filePath: 'C:/tmp/video.mp4', sizeBytes: 4 })
            }
        ),
        (error) => error.code === ErrorCodes.NETWORK
    );
    assert.equal(vexVideoCalls, 0);
});

test('falha no download sem fallback não aciona Vex', async () => {
    let vexAudioCalls = 0;
    const providers = providerSet({
        local: {
            audio: async () => ({
                remoteUrl: 'https://cdn.example/audio.mp3',
                meta: { durationSeconds: 60 }
            })
        },
        vex: {
            audio: async () => {
                vexAudioCalls++;
                return { remoteUrl: 'https://cdn.example/audio-vex.mp3' };
            }
        }
    });
    const { cache, limiter } = isolated();

    await assert.rejects(
        runYoutubeAudio(
            { url: `https://youtu.be/${videoId}` },
            {
                provider: 'auto',
                config: {},
                providers,
                cache,
                limiter,
                env: {},
                download: async () => { throw new ApiError(ErrorCodes.NETWORK); }
            }
        ),
        (error) => error.code === ErrorCodes.NETWORK
    );
    assert.equal(vexAudioCalls, 0);
});

test('falha no download não aciona Vex mesmo com fallback habilitado', async () => {
    let vexAudioCalls = 0;
    const providers = providerSet({
        local: {
            audio: async () => ({
                remoteUrl: 'https://cdn.example/audio.mp3',
                meta: { durationSeconds: 60 }
            })
        },
        vex: {
            audio: async () => {
                vexAudioCalls++;
                return { remoteUrl: 'https://cdn.example/audio-vex.mp3' };
            }
        }
    });
    const { cache, limiter } = isolated();

    await assert.rejects(
        runYoutubeAudio(
            { url: `https://youtu.be/${videoId}` },
            {
                provider: 'auto',
                config: { api: { youtube: { allowVexFallback: true } } },
                providers,
                cache,
                limiter,
                env: {},
                download: async () => { throw new ApiError(ErrorCodes.NETWORK); }
            }
        ),
        (error) => error.code === ErrorCodes.NETWORK
    );
    assert.equal(vexAudioCalls, 0);
});

test('auto faz fallback de mídia local indisponível para Vex', async () => {
    let vexAudioCalls = 0;
    const providers = providerSet({
        local: {
            audio: async () => { throw new ApiError(ErrorCodes.DEPENDENCY_MISSING); }
        },
        vex: {
            audio: async () => {
                vexAudioCalls++;
                return {
                    remoteUrl: 'https://cdn.example/audio.mp3',
                    meta: { title: 'Fallback', durationSeconds: 60 }
                };
            }
        }
    });
    const { cache, limiter } = isolated();

    const result = await runYoutubeAudio(
        { url: `https://youtu.be/${videoId}` },
        {
            provider: 'auto',
            config: { api: { youtube: { allowVexFallback: true } } },
            providers,
            cache,
            limiter,
            env: {},
            download: async () => ({ filePath: 'C:/tmp/audio.mp3', sizeBytes: 4 })
        }
    );

    assert.equal(result.provider, 'vex');
    assert.equal(vexAudioCalls, 1);
});

test('áudio rejeita duração do provider antes de baixar', async () => {
    let downloaded = false;
    const providers = providerSet({
        vex: {
            audio: async () => ({
                remoteUrl: 'https://cdn.example/audio.mp3',
                meta: { durationSeconds: YOUTUBE_MAX_DURATION_SECONDS + 1 }
            })
        }
    });
    const { cache, limiter } = isolated();

    await assert.rejects(
        runYoutubeAudio(
            { url: `https://youtu.be/${videoId}` },
            {
                provider: 'vex',
                config: {},
                providers,
                cache,
                limiter,
                maxDurationSeconds: YOUTUBE_MAX_DURATION_SECONDS,
                download: async () => {
                    downloaded = true;
                    return { filePath: 'C:/tmp/audio.mp3', sizeBytes: 4 };
                }
            }
        ),
        (error) => error.code === ErrorCodes.INPUT_INVALID
    );
    assert.equal(downloaded, false);
});

test('vídeo usa provider e retorna media com cleanup', async () => {
    const providers = providerSet({
        vex: {
            video: async () => ({
                remoteUrl: 'https://cdn.example/video.mp4',
                meta: { title: 'Vídeo', durationSeconds: 60 },
                mimetype: 'video/mp4',
                extension: '.mp4',
                fileName: 'video.mp4'
            })
        }
    });
    const { cache, limiter } = isolated();

    const result = await runYoutubeVideo(
        { url: `https://youtu.be/${videoId}` },
        {
            provider: 'vex',
            config: {},
            providers,
            cache,
            limiter,
            download: async () => ({ filePath: 'C:/tmp/video.mp4', sizeBytes: 4 })
        }
    );

    assert.equal(result.media.mimetype, 'video/mp4');
    assert.equal(typeof result.media.cleanup, 'function');
    await result.media.cleanup();
});
