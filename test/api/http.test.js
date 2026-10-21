import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpClient } from '../../dados/src/funcs/api/http.js';

function transport(handler) {
    return {
        calls: [],
        async request(config) {
            this.calls.push(config);
            return handler(config);
        }
    };
}

test('HttpClient envia timeout e limite para o transporte', async () => {
    const fake = transport(() => ({
        status: 200,
        headers: {},
        data: '{"ok":true}'
    }));
    const client = new HttpClient({
        timeoutMs: 1234,
        maxBytes: 100,
        transport: fake
    });

    const response = await client.getJson('https://example.test/api');
    assert.equal(response.data.ok, true);
    assert.equal(fake.calls[0].timeout, 1234);
    assert.equal(fake.calls[0].maxContentLength, 100);
});

test('HttpClient converte timeout e erro de rede', async () => {
    const timeout = new Error('timeout');
    timeout.code = 'ECONNABORTED';
    const timeoutClient = new HttpClient({
        transport: transport(() => { throw timeout; })
    });

    await assert.rejects(
        timeoutClient.getText('https://example.test'),
        (error) => error.code === 'TIMEOUT'
    );

    const networkClient = new HttpClient({
        transport: transport(() => {
            const error = new Error('network');
            error.code = 'ENOTFOUND';
            throw error;
        })
    });

    await assert.rejects(
        networkClient.getText('https://example.test'),
        (error) => error.code === 'NETWORK'
    );
});

test('HttpClient aplica limite de tamanho', async () => {
    const fake = transport(() => ({
        status: 200,
        headers: {},
        data: Buffer.alloc(11)
    }));
    const client = new HttpClient({ maxBytes: 10, transport: fake });

    await assert.rejects(
        client.getBuffer('https://example.test'),
        (error) => error.code === 'PAYLOAD_TOO_LARGE'
    );

    const declared = transport(() => ({
        status: 200,
        headers: { 'content-length': '11' },
        data: Buffer.alloc(1)
    }));
    const declaredClient = new HttpClient({ maxBytes: 10, transport: declared });

    await assert.rejects(
        declaredClient.getBuffer('https://example.test'),
        (error) => error.code === 'PAYLOAD_TOO_LARGE'
    );
});

test('HttpClient mapeia status HTTP', async () => {
    const cases = [
        [401, 'AUTH_INVALID'],
        [403, 'AUTH_INVALID'],
        [429, 'RATE_LIMITED'],
        [404, 'UNSUPPORTED'],
        [413, 'PAYLOAD_TOO_LARGE'],
        [500, 'UPSTREAM']
    ];

    for (const [status, code] of cases) {
        const client = new HttpClient({
            transport: transport(() => ({ status, headers: {}, data: '{}' }))
        });
        await assert.rejects(
            client.getText('https://example.test'),
            (error) => error.code === code
        );
    }

    const badRequest = new HttpClient({
        transport: transport(() => ({ status: 400, headers: {}, data: '{}' }))
    });
    await assert.rejects(
        badRequest.getText('https://example.test'),
        (error) => error.code === 'UPSTREAM' && error.recoverable === false
    );
});

test('HttpClient permite inspecionar status sem lançar erro', async () => {
    const client = new HttpClient({
        transport: transport(() => ({ status: 429, headers: {}, data: '{}' }))
    });

    const response = await client.request({
        url: 'https://example.test',
        throwOnHttpError: false
    });
    assert.equal(response.status, 429);
});

test('HttpClient rejeita JSON inválido', async () => {
    const client = new HttpClient({
        transport: transport(() => ({ status: 200, headers: {}, data: 'html' }))
    });

    await assert.rejects(
        client.getJson('https://example.test'),
        (error) => error.code === 'UPSTREAM'
    );
});
