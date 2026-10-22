import test from 'node:test';
import assert from 'node:assert/strict';

import { gerarLogo, gerarLogo2, isImageBuffer } from '../../dados/src/funcs/logos/index.js';

function pngBytes() {
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
        Buffer.from([0x00, 0x00, 0x00, 0x0D]),
        Buffer.from('IHDR'),
        Buffer.alloc(16, 0x03)
    ]);
}

function jpegBytes() {
    return Buffer.concat([
        Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]),
        Buffer.alloc(32, 0x04)
    ]);
}

const baseOptions = (overrides = {}) => ({
    config: { site_vex: 'https://vex.example/', apikey_vex: 'chave-teste' },
    verify: async () => true,
    requestJSON: async () => null,
    requestBuffer: async () => pngBytes(),
    ...overrides
});

test('reconhece assinaturas de imagem e rejeita JSON/HTML', () => {
    assert.equal(isImageBuffer(jpegBytes()), true);
    assert.equal(isImageBuffer(pngBytes()), true);
    assert.equal(isImageBuffer(Buffer.from('GIF89a' + 'x'.repeat(20))), true);
    assert.equal(isImageBuffer(Buffer.concat([
        Buffer.from('RIFF'),
        Buffer.alloc(4),
        Buffer.from('WEBPVP8 '),
        Buffer.alloc(8)
    ])), true);
    assert.equal(isImageBuffer(Buffer.from('{"erro":"limite diário atingido"}')), false);
    assert.equal(isImageBuffer(Buffer.from('<html>erro</html>')), false);
    assert.equal(isImageBuffer(Buffer.alloc(0)), false);
    assert.equal(isImageBuffer(null), false);
});

test('gera logo 1txt e devolve o Buffer validado', async () => {
    let requestedUrl = '';
    const result = await gerarLogo({ query: 'Olá Mundo', type: 'neon' }, baseOptions({
        requestBuffer: async (url) => {
            requestedUrl = url;
            return jpegBytes();
        }
    }));

    assert.equal(result.ok, true);
    assert.ok(Buffer.isBuffer(result.buffer));
    assert.equal(requestedUrl, 'https://vex.example/api/logos/neon?apikey=chave-teste&query=Ol%C3%A1%20Mundo');
});

test('gera logo 2txt com os dois textos codificados', async () => {
    let requestedUrl = '';
    const result = await gerarLogo2({ query: 'Nazuna', query2: 'Bot & Cia', type: 'marvel' }, baseOptions({
        requestBuffer: async (url) => {
            requestedUrl = url;
            return pngBytes();
        }
    }));

    assert.equal(result.ok, true);
    assert.equal(
        requestedUrl,
        'https://vex.example/api/duallogos/marvel?apikey=chave-teste&query=Nazuna&text2=Bot%20%26%20Cia'
    );
});

test('JSON de erro da API vira falha explícita, nunca imagem', async () => {
    const result = await gerarLogo({ query: 'teste-erro', type: 'neon' }, baseOptions({
        verify: async (data) => (data?.error ? `⚠️ ${data.error}` : true),
        requestJSON: async () => ({ error: 'Limite diário atingido' })
    }));

    assert.equal(result.ok, false);
    assert.match(result.msg, /Limite diário atingido/);
});

test('resposta 200 que não é imagem falha em vez de ser enviada', async () => {
    const result = await gerarLogo({ query: 'teste-json', type: 'neon' }, baseOptions({
        requestBuffer: async () => Buffer.from('{"status":true,"error":"sem imagem"}')
    }));

    assert.equal(result.ok, false);
    assert.match(result.msg, /imagem válida/i);
});

test('resposta vazia falha em vez de enviar Buffer vazio', async () => {
    const result = await gerarLogo({ query: 'teste-vazio', type: 'neon' }, baseOptions({
        requestBuffer: async () => Buffer.alloc(0)
    }));

    assert.equal(result.ok, false);
    assert.match(result.msg, /imagem válida/i);
});

test('chave ausente mantém a mensagem de configuração da VexAPI', async () => {
    const tutorial = '⚠️ Configure a apikey...';
    const result = await gerarLogo({ query: 'teste-sem-chave', type: 'neon' }, baseOptions({
        verify: async () => tutorial
    }));

    assert.equal(result.ok, false);
    assert.equal(result.msg, tutorial);
});

test('resultado idêntico é servido do cache sem nova requisição', async () => {
    let calls = 0;
    const options = baseOptions({
        requestBuffer: async () => {
            calls += 1;
            return jpegBytes();
        }
    });

    const first = await gerarLogo({ query: 'teste-cache-unico', type: 'neon' }, options);
    const second = await gerarLogo({ query: 'teste-cache-unico', type: 'neon' }, options);

    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(second.cached, true);
    assert.equal(calls, 1);
});
