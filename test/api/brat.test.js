import test from 'node:test';
import assert from 'node:assert/strict';
import { runBrat, normalizeBratInput } from '../../dados/src/funcs/api/features/brat.js';
import { BoundedCache } from '../../dados/src/funcs/api/cache.js';
import { ConcurrencyLimiter } from '../../dados/src/funcs/api/limiter.js';
import { ApiError, ErrorCodes, inputError } from '../../dados/src/funcs/api/errors.js';
import { run } from '../../dados/src/funcs/api/index.js';

function isolated() {
    return {
        cache: new BoundedCache({ maxEntries: 20, maxBytes: 1024 * 1024 }),
        limiter: new ConcurrencyLimiter({ maxConcurrent: 2, maxQueue: 10 })
    };
}

function localResult(input) {
    return {
        ok: true,
        type: 'image',
        mime: 'image/webp',
        mimetype: 'image/webp',
        query: input.query,
        buffer: Buffer.from('local'),
        provider: 'local'
    };
}

function vexResult(input) {
    return {
        ok: true,
        type: 'image',
        mime: 'image/webp',
        mimetype: 'image/webp',
        query: input.query,
        url: 'https://vex.example/image',
        provider: 'vex'
    };
}

test('normaliza entrada preservando acentos e emojis', () => {
    const input = normalizeBratInput({
        query: '  Olá, ação! 😀  ',
        bg: '',
        text_color: null,
        blur: ''
    });

    assert.equal(input.query, 'Olá, ação! 😀');
    assert.equal(input.bg, 'white');
    assert.equal(input.text_color, 'black');
    assert.equal(input.blur, '');
});

test('rejeita entradas inválidas sem chamar provedor', async () => {
    let calls = 0;
    const providers = {
        local: async () => { calls++; return localResult({ query: 'x' }); },
        vex: async () => { calls++; return vexResult({ query: 'x' }); }
    };
    const { cache, limiter } = isolated();

    await assert.rejects(
        runBrat({ query: '' }, { provider: 'auto', providers, cache, limiter }),
        (error) => error.code === ErrorCodes.INPUT_INVALID
    );
    await assert.rejects(
        runBrat({ query: 'x', blur: 'abc' }, { provider: 'auto', providers, cache, limiter }),
        (error) => error.code === ErrorCodes.INPUT_INVALID
    );
    await assert.rejects(
        runBrat({ query: 'a'.repeat(201) }, { provider: 'auto', providers, cache, limiter }),
        (error) => error.code === ErrorCodes.INPUT_INVALID
    );
    assert.equal(calls, 0);
});

test('executa local quando configurado', async () => {
    let localCalls = 0;
    let vexCalls = 0;
    const providers = {
        local: async (input) => { localCalls++; return localResult(input); },
        vex: async (input) => { vexCalls++; return vexResult(input); }
    };
    const { cache, limiter } = isolated();

    const result = await runBrat(
        { query: 'Teste local' },
        { provider: 'local', providers, cache, limiter }
    );

    assert.equal(result.ok, true);
    assert.equal(result.provider, 'local');
    assert.equal(localCalls, 1);
    assert.equal(vexCalls, 0);
});

test('auto faz fallback apenas em erro recuperável', async () => {
    let vexCalls = 0;
    const providers = {
        local: async () => { throw new ApiError(ErrorCodes.DEPENDENCY_MISSING); },
        vex: async (input) => { vexCalls++; return vexResult(input); }
    };
    const { cache, limiter } = isolated();

    const result = await runBrat(
        { query: 'Fallback' },
        { provider: 'auto', providers, cache, limiter }
    );

    assert.equal(result.provider, 'vex');
    assert.equal(vexCalls, 1);
});

test('auto não faz fallback em erro de entrada ou erro interno', async () => {
    let vexCalls = 0;
    const providers = {
        local: async () => { throw inputError('cor inválida'); },
        vex: async (input) => { vexCalls++; return vexResult(input); }
    };
    const { cache, limiter } = isolated();

    await assert.rejects(
        runBrat({ query: 'Sem fallback' }, { provider: 'auto', providers, cache, limiter }),
        (error) => error.code === ErrorCodes.INPUT_INVALID
    );
    assert.equal(vexCalls, 0);

    const internalProviders = {
        local: async () => { throw new ApiError(ErrorCodes.INTERNAL); },
        vex: async (input) => { vexCalls++; return vexResult(input); }
    };

    await assert.rejects(
        runBrat({ query: 'Sem fallback 2' }, {
            provider: 'auto',
            providers: internalProviders,
            cache,
            limiter
        }),
        (error) => error.code === ErrorCodes.INTERNAL
    );
    assert.equal(vexCalls, 0);
});

test('cache evita chamadas repetidas e não mistura provedores', async () => {
    let localCalls = 0;
    let vexCalls = 0;
    const providers = {
        local: async (input) => { localCalls++; return localResult(input); },
        vex: async (input) => { vexCalls++; return vexResult(input); }
    };
    const { cache, limiter } = isolated();

    const first = await runBrat(
        { query: 'Cache' },
        { provider: 'local', providers, cache, limiter }
    );
    const second = await runBrat(
        { query: 'Cache' },
        { provider: 'local', providers, cache, limiter }
    );

    assert.equal(first.cached, undefined);
    assert.equal(second.cached, true);
    assert.equal(localCalls, 1);

    const fromVex = await runBrat(
        { query: 'Cache' },
        { provider: 'vex', providers, cache, limiter }
    );
    assert.equal(fromVex.provider, 'vex');
    assert.equal(vexCalls, 1);

    await runBrat(
        { query: 'cache' },
        { provider: 'local', providers, cache, limiter }
    );
    assert.equal(localCalls, 2);
});

test('fachada rejeita feature não suportada', async () => {
    await assert.rejects(
        run('desconhecida', {}),
        (error) => error.code === ErrorCodes.UNSUPPORTED
    );
});
