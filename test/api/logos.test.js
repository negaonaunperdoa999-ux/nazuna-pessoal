import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    gerarLogo,
    gerarLogo2,
    isImageBuffer,
    buildLogoSvg,
    LOGO_COMMANDS,
    TWO_TEXT_COMMANDS,
    LOGO_STYLES
} from '../../dados/src/funcs/logos/index.js';
import { buildSocialMediaPayload } from '../../dados/src/funcs/downloads/socialMediaMessage.js';
import { RENDERERS } from '../../dados/src/funcs/logos/renderers/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function sha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

function inputFor(command, query = 'Nazuna', query2 = 'Bot & Cia') {
    return TWO_TEXT_COMMANDS.includes(command)
        ? { type: command, query, query2 }
        : { type: command, query };
}

async function generate(command, query = 'Nazuna', query2 = 'Bot & Cia') {
    const input = inputFor(command, query, query2);
    return TWO_TEXT_COMMANDS.includes(command)
        ? gerarLogo2(input)
        : gerarLogo(input);
}

test('os 38 comandos têm configurações visuais próprias e únicas', () => {
    assert.equal(LOGO_COMMANDS.length, 38);
    assert.equal(new Set(LOGO_COMMANDS).size, 38);
    assert.equal(TWO_TEXT_COMMANDS.length, 4);
    assert.equal(LOGO_COMMANDS.filter((command) => TWO_TEXT_COMMANDS.includes(command)).length, 4);

    const fingerprints = LOGO_COMMANDS.map((command) => JSON.stringify(LOGO_STYLES[command]));
    assert.equal(new Set(fingerprints).size, 38);

    const svgs = LOGO_COMMANDS.map((command) => buildLogoSvg(inputFor(command)));
    assert.equal(new Set(svgs).size, 38);
});

test('os 13 estilos de referência usam renderizadores dedicados e escapam os textos', () => {
    const referenceStyles = [
        'pornhub', 'deadpool', 'avengers', 'marvel',
        'amongus', 'royal', 'mascotemetal', 'firework', 'summerbeach',
        'cloudsky', 'techstyle', 'watercolor', 'ligatures'
    ];

    assert.equal(Object.keys(RENDERERS).length, referenceStyles.length);
    for (const command of referenceStyles) {
        assert.equal(typeof RENDERERS[command], 'function', command);
        const svg = buildLogoSvg(inputFor(command, 'Nazuna', 'Bot & Cia'));
        assert.match(svg, /^<svg /, command);
        assert.doesNotMatch(svg, /id="logo-bg"/, `${command} caiu no renderer genérico`);
    }

    const escaped = buildLogoSvg({
        type: 'deadpool',
        query: '<b>Naz</b>',
        query2: '& "B"'
    });
    assert.match(escaped, /&lt;b&gt;Naz&lt;\/b&gt;/);
    assert.match(escaped, /&amp; &quot;B&quot;/);
    assert.doesNotMatch(escaped, /<b>Naz<\/b>/);
});

test('todos os 38 comandos geram PNG local válido sem chave', async () => {
    const hashes = new Set();

    for (const command of LOGO_COMMANDS) {
        const result = await generate(command, 'Olá Mundo ✨', 'Bot & Cia');

        assert.equal(result.ok, true, `${command}: ${result.msg || 'falhou'}`);
        assert.equal(result.provider, 'local', command);
        assert.equal(result.style, command);
        assert.equal(result.type, 'image');
        assert.equal(result.mimetype, 'image/png');
        assert.ok(Buffer.isBuffer(result.buffer), command);
        assert.ok(result.buffer.length > 1000, `${command} gerou PNG pequeno demais`);
        assert.equal(result.sizeBytes, result.buffer.length);
        assert.equal(isImageBuffer(result.buffer), true, command);
        assert.match(result.buffer.subarray(1, 4).toString('latin1'), /^PNG$/, command);

        hashes.add(sha256(result.buffer));
    }

    assert.equal(hashes.size, 38);
});

test('os quatro comandos de dois textos preservam os dois argumentos', () => {
    for (const command of TWO_TEXT_COMMANDS) {
        const svg = buildLogoSvg({
            type: command,
            query: 'Nazuna',
            query2: 'Bot & Cia'
        });

        assert.match(svg, /Nazuna/, command);
        assert.match(svg, /Bot &amp; Cia/, command);
        assert.doesNotMatch(svg, /Bot & Cia/, command);
    }
});

test('textos especiais, quebras de linha e emojis são escapados sem virar markup', async () => {
    const svg = buildLogoSvg({
        type: 'comics',
        query: '<b>Naz</b>\n& "B" ✨'
    });

    assert.match(svg, /&lt;b&gt;Naz&lt;\/b&gt;/);
    assert.match(svg, /&amp; &quot;B&quot;/);
    assert.match(svg, /✨/);
    assert.doesNotMatch(svg, /<b>Naz<\/b>/);

    const result = await gerarLogo({ type: 'comics', query: '<b>Naz</b> & "B"' });
    assert.equal(result.ok, true);
    assert.equal(isImageBuffer(result.buffer), true);
});

test('entradas vazias, texto longo e estilo desconhecido falham com mensagem clara', async () => {
    const empty = await gerarLogo({ type: 'royal', query: '   ' });
    assert.equal(empty.ok, false);
    assert.match(empty.msg, /texto.*obrigat/i);

    const missingSecond = await gerarLogo2({ type: 'marvel', query: 'Nazuna', query2: ' ' });
    assert.equal(missingSecond.ok, false);
    assert.match(missingSecond.msg, /dois textos.*obrigat/i);

    const tooLong = await gerarLogo({ type: 'galaxy', query: 'N'.repeat(81) });
    assert.equal(tooLong.ok, false);
    assert.match(tooLong.msg, /80 caracteres/i);

    const unknown = await gerarLogo({ type: 'nao-existe', query: 'Nazuna' });
    assert.equal(unknown.ok, false);
    assert.match(unknown.msg, /estilo.*não encontrado/i);
});

test('o resultado vira payload de imagem válido para o Baileys', async () => {
    const result = await gerarLogo({ type: 'glossy', query: 'Nazuna Local' });
    const payload = buildSocialMediaPayload(result);

    assert.equal(payload.ok, true);
    assert.equal(payload.type, 'image');
    assert.ok(Buffer.isBuffer(payload.media));
    assert.equal(payload.mimetype, 'image/png');
    assert.equal(payload.fileName, 'logo-glossy.png');
    assert.equal(payload.sizeBytes, result.buffer.length);
    assert.equal(payload.media, result.buffer);
});

test('cache local evita renderizar o mesmo logo duas vezes', async () => {
    const first = await gerarLogo({ type: 'frozen', query: 'Cache Local Único' });
    const second = await gerarLogo({ type: 'frozen', query: 'Cache Local Único' });

    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(second.cached, true);
    assert.equal(second.buffer, first.buffer);
});

test('módulo e handlers dos logos não chamam VexAPI nem exigem chave', async () => {
    const logosSource = await fsp.readFile(
        path.join(ROOT, 'dados', 'src', 'funcs', 'logos', 'index.js'),
        'utf8'
    );
    assert.doesNotMatch(logosSource, /verificarAPI|site_vex|apikey_vex|api\/logos|duallogos|https\.get|fetch\(/i);

    const localSource = await fsp.readFile(
        path.join(ROOT, 'dados', 'src', 'funcs', 'logos', 'local.js'),
        'utf8'
    );
    assert.doesNotMatch(localSource, /verificarAPI|site_vex|apikey_vex|api\/logos|duallogos|https\.get|fetch\(/i);

    const indexSource = await fsp.readFile(path.join(ROOT, 'dados', 'src', 'index.js'), 'utf8');
    const start = indexSource.indexOf('//COMANDOS DE LOGOS');
    const end = indexSource.indexOf('//comandos de edits', start);
    assert.ok(start > 0 && end > start, 'bloco de logos não encontrado em index.js');

    const block = indexSource.slice(start, end);
    assert.doesNotMatch(block, /verificarAPI|site_vex|apikey_vex|api\/logos|duallogos|fallback/i);
    assert.match(block, /logos\.gerarLogo\(/);
    assert.match(block, /logos\.gerarLogo2\(/);

    const cases = [...block.matchAll(/case '([^']+)':/g)].map((match) => match[1]);
    assert.equal(cases.length, 38);
    assert.equal(new Set(cases).size, 38);
    assert.deepEqual(new Set(cases), new Set(LOGO_COMMANDS));
});
