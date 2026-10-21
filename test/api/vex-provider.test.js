import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildBratUrl,
    checkVexKey,
    generateBrat
} from '../../dados/src/funcs/api/providers/vex.js';
import { ErrorCodes } from '../../dados/src/funcs/api/errors.js';

const config = {
    site_vex: 'https://vex.example',
    apikey_vex: 'secret-key'
};

function fakeHttp(response) {
    return {
        calls: [],
        async request(options) {
            this.calls.push(options);
            return response;
        }
    };
}

test('monta URL do brat com parâmetros codificados', () => {
    const url = buildBratUrl({
        query: 'Olá 😀',
        bg: '%23FF0000',
        text_color: 'white',
        blur: '3'
    }, {
        siteVex: 'https://vex.example',
        apiKey: 'secret-key'
    });

    assert.match(url, /query=Ol%C3%A1%20%F0%9F%98%80/);
    assert.match(url, /bg=%2523FF0000/);
    assert.match(url, /text_color=white/);
    assert.match(url, /blur=3/);
    assert.ok(!url.includes('Olá 😀'));
});

test('não chama a Vex quando falta configuração', async () => {
    const http = fakeHttp({ status: 200, data: '{}' });

    await assert.rejects(
        generateBrat({ query: 'teste' }, {
            config: { site_vex: 'https://vex.example' },
            http
        }),
        (error) => error.code === ErrorCodes.CONFIG_MISSING
    );
    assert.equal(http.calls.length, 0);

    await assert.rejects(
        generateBrat({ query: 'teste' }, {
            config: { apikey_vex: 'secret-key' },
            http
        }),
        (error) => error.code === ErrorCodes.CONFIG_MISSING
    );
    assert.equal(http.calls.length, 0);
});

test('verifica chave e retorna URL no modo Vex', async () => {
    const http = fakeHttp({ status: 200, data: '{"ok":true}' });

    const result = await generateBrat({ query: 'teste' }, { config, http });

    assert.equal(result.ok, true);
    assert.equal(result.provider, 'vex');
    assert.match(result.url, /\/api\/canvas\/brat/);
    assert.equal(http.calls.length, 1);
    assert.equal(http.calls[0].throwOnHttpError, false);
});

test('mapeia limite, autenticação e indisponibilidade da Vex', async () => {
    const limited = fakeHttp({ status: 429, data: '{}' });
    await assert.rejects(
        checkVexKey({ config, http: limited }),
        (error) => error.code === ErrorCodes.RATE_LIMITED
    );

    const auth = fakeHttp({
        status: 400,
        data: '{"error":"api key inválida"}'
    });
    await assert.rejects(
        checkVexKey({ config, http: auth }),
        (error) => error.code === ErrorCodes.AUTH_INVALID
    );

    const unavailable = fakeHttp({ status: 503, data: '{}' });
    await assert.rejects(
        checkVexKey({ config, http: unavailable }),
        (error) => error.code === ErrorCodes.UPSTREAM
    );
});

test('mensagens de erro não expõem a chave', async () => {
    const http = fakeHttp({ status: 401, data: '{}' });

    try {
        await checkVexKey({ config, http });
        assert.fail('deveria falhar');
    } catch (error) {
        assert.ok(!String(error.message).includes('secret-key'));
        assert.ok(!String(error.userMessage).includes('secret-key'));
    }
});
