import test from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import menuLogos from '../../dados/src/menus/menulogo.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function extractCommands(text) {
    return [...text.matchAll(/!([a-z0-9]+)/gi)].map((match) => match[1].toLowerCase());
}

test('menu de logos lista exatamente os comandos esperados, sem duplicatas', async () => {
    const menu = await menuLogos('!');
    const marker = '🖼 LOGOTIPOS 2TXT';
    assert.ok(menu.includes(marker));

    const [oneTextSection, twoTextSection] = menu.split(marker);
    const oneText = extractCommands(oneTextSection);
    const twoText = extractCommands(twoTextSection);

    assert.equal(oneText.length, 34);
    assert.equal(twoText.length, 4);
    assert.deepEqual(twoText, ['pornhub', 'avengers', 'marvel', 'deadpool']);
    assert.equal(new Set([...oneText, ...twoText]).size, 38);
    assert.equal(new Set(oneText).size, oneText.length);
});

test('todos os comandos do menu têm case no roteador de logos', async () => {
    const menu = await menuLogos('!');
    const commands = extractCommands(menu);

    const source = await fsp.readFile(path.join(ROOT, 'dados', 'src', 'index.js'), 'utf8');
    const start = source.indexOf('//COMANDOS DE LOGOS');
    const end = source.indexOf('//comandos de edits', start);
    assert.ok(start > 0 && end > start, 'bloco de logos não encontrado em index.js');

    const block = source.slice(start, end);
    const cases = [...block.matchAll(/case '([^']+)':/g)].map((match) => match[1]);
    const caseSet = new Set(cases);

    for (const command of commands) {
        assert.ok(caseSet.has(command), `comando !${command} está no menu mas não tem case`);
    }

    // O bloco de logos não deve rotear comandos que não aparecem no menu.
    for (const command of caseSet) {
        assert.ok(commands.includes(command), `case '${command}' não está no menu de logos`);
    }

    const [oneTextSection, twoTextSection] = block.split("case 'pornhub':");
    assert.match(oneTextSection, /logos\.gerarLogo\(/);
    assert.match(twoTextSection, /logos\.gerarLogo2\(/);
});
