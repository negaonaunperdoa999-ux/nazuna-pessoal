import test from 'node:test';
import assert from 'node:assert/strict';
import {
    getBratProvider,
    getYoutubeProvider,
    normalizeProvider,
    resolveProviderChain,
    resolveYoutubeProviderChain,
    shouldFallback
} from '../../dados/src/funcs/api/policy.js';
import { ApiError, ErrorCodes, inputError } from '../../dados/src/funcs/api/errors.js';
import { getYoutubeSettings } from '../../dados/src/funcs/api/config.js';

test('provedor padrão continua sendo vex', () => {
    assert.equal(getBratProvider({}, {}), 'vex');
    assert.deepEqual(resolveProviderChain('vex'), ['vex']);
});

test('flags local, vex e auto são aceitas', () => {
    assert.equal(normalizeProvider('local'), 'local');
    assert.equal(normalizeProvider('VEX'), 'vex');
    assert.deepEqual(resolveProviderChain('auto'), ['local', 'vex']);
    assert.equal(getBratProvider({ api: { brat: { provider: 'local' } } }, {}), 'local');
    assert.equal(getBratProvider({ api: { brat: { provider: 'local' } } }, {
        NAZUNA_BRAT_PROVIDER: 'auto'
    }), 'auto');
});

test('YouTube usa provedor local por padrão e Vex fica desativada como fallback', () => {
    assert.equal(getYoutubeProvider({}, {}), 'local');
    assert.deepEqual(
        resolveYoutubeProviderChain('auto', { allowVexFallback: false }),
        ['local']
    );
    assert.deepEqual(
        resolveYoutubeProviderChain('auto', { allowVexFallback: true }),
        ['local', 'vex']
    );
    assert.deepEqual(resolveYoutubeProviderChain('local', { allowVexFallback: true }), ['local']);
    assert.deepEqual(resolveYoutubeProviderChain('vex', { allowVexFallback: false }), ['vex']);
    assert.equal(getYoutubeProvider({ api: { youtube: { provider: 'vex' } } }, {}), 'vex');
    assert.equal(
        getYoutubeProvider({}, { NAZUNA_YOUTUBE_PROVIDER: 'auto' }),
        'auto'
    );
    assert.equal(getYoutubeSettings({}, {}).allowVexFallback, false);
    assert.equal(
        getYoutubeSettings({ api: { youtube: { allowVexFallback: true } } }, {}).allowVexFallback,
        true
    );
    assert.equal(
        getYoutubeSettings({}, { NAZUNA_YOUTUBE_ALLOW_VEX_FALLBACK: '0' }).allowVexFallback,
        false
    );
    assert.equal(getYoutubeSettings({}, {}).useYtDlp, true);
    assert.equal(
        getYoutubeSettings({ api: { youtube: { useYtDlp: false } } }, {}).useYtDlp,
        false
    );
    assert.equal(
        getYoutubeSettings({}, { NAZUNA_YOUTUBE_USE_YTDLP: '0' }).useYtDlp,
        false
    );
    assert.equal(
        getYoutubeSettings({ api: { youtube: { ytDlpPath: 'C:/bin/yt-dlp.exe' } } }, {}).ytDlpPath,
        'C:/bin/yt-dlp.exe'
    );
    assert.equal(
        getYoutubeSettings({}, { NAZUNA_YOUTUBE_YTDLP_TIMEOUT_MS: '90000' }).ytDlpTimeoutMs,
        90000
    );
});

test('provedor inválido gera erro de configuração', () => {
    assert.throws(
        () => normalizeProvider('outro'),
        (error) => error.code === ErrorCodes.CONFIG_INVALID && error.recoverable === false
    );
});

test('fallback só ocorre em auto e com erro recuperável', () => {
    const chain = ['local', 'vex'];

    assert.equal(shouldFallback('auto', new ApiError(ErrorCodes.TIMEOUT), 0, chain), true);
    assert.equal(shouldFallback('auto', inputError('texto vazio'), 0, chain), false);
    assert.equal(shouldFallback('local', new ApiError(ErrorCodes.TIMEOUT), 0, ['local']), false);
    assert.equal(shouldFallback('auto', new ApiError(ErrorCodes.INTERNAL), 0, chain), false);
    assert.equal(shouldFallback('auto', new ApiError(ErrorCodes.TIMEOUT), 1, chain), false);
});
