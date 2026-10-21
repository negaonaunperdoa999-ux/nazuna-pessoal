import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..', '..');
const gbaModulePath = path.join(projectRoot, 'dados', 'src', 'funcs', 'private', 'gba', 'gbaTestHtml.js');
const indexPath = path.join(projectRoot, 'dados', 'src', 'index.js');
const biosPath = path.join(projectRoot, 'dados', 'src', 'funcs', 'private', 'gba', 'vendor', 'gbajs', 'resources', 'bios.bin');

test('importar o módulo GBA não toca o disco (nada de BIOS no import)', async () => {
    const module = await import(`file:///${gbaModulePath.replace(/\\/g, '/')}`);

    assert.equal(typeof module.sendGbaTest, 'function');
    assert.equal(typeof module.buildGbaTestHtml, 'function');
    assert.equal(typeof module.buildGbaTestRom, 'function');
});

test('sem o BIOS, o módulo GBA só falha quando a funcionalidade é acionada', async () => {
    const module = await import(`file:///${gbaModulePath.replace(/\\/g, '/')}`);

    if (fs.existsSync(biosPath)) {
        // ambiente com BIOS: a construção do HTML precisa funcionar
        const html = module.buildGbaTestHtml();
        assert.match(html, /GameBoyAdvance/);
        return;
    }

    assert.throws(
        () => module.buildGbaTestHtml(),
        (error) => /BIOS do emulador GBA ausente/i.test(error.message)
            && /bios\.bin/.test(error.message)
    );
});

test('a ROM de teste do GBA continua sendo gerada sem o BIOS', async () => {
    const module = await import(`file:///${gbaModulePath.replace(/\\/g, '/')}`);
    const rom = module.buildGbaTestRom();

    assert.ok(rom instanceof Uint8Array);
    assert.equal(rom.length, 0x140);
    assert.equal(Buffer.from(rom.subarray(0xa0, 0xac)).toString('latin1'), 'NAZUNA GBA T');
    assert.equal(Buffer.from(rom.subarray(0xac, 0xb0)).toString('latin1'), 'NZNA');
});

test('index.js não importa o GBA estaticamente (lazy loading real)', async () => {
    const source = await fsp.readFile(indexPath, 'utf8');

    const staticImport = source.match(/^\s*import\s+[^;]*from\s+['"][^'"]*gba\/gbaTestHtml\.js['"]\s*;/m);
    assert.equal(staticImport, null, 'não deve haver import estático do módulo GBA');

    assert.match(
        source,
        /await import\(['"]\.\/funcs\/private\/gba\/gbaTestHtml\.js['"]\)/,
        'o comando gbatest deve carregar o módulo sob demanda'
    );
    assert.match(source, /case 'gbatest':/);
    assert.match(source, /case 'doon':/);
});

test('nenhum outro módulo importa o GBA estaticamente', async () => {
    const files = [];
    const walk = async (dir) => {
        for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) await walk(full);
            else if (entry.name.endsWith('.js')) files.push(full);
        }
    };
    await walk(path.join(projectRoot, 'dados', 'src'));

    const offenders = [];
    for (const file of files) {
        if (file === gbaModulePath) continue;
        const source = await fsp.readFile(file, 'utf8');
        if (/^\s*import\s+[^;]*from\s+['"][^'"]*gba\/gbaTestHtml\.js['"]\s*;/m.test(source)) {
            offenders.push(path.relative(projectRoot, file));
        }
    }

    assert.deepEqual(offenders, []);
});

test('o módulo GBA não faz leituras de arquivo no topo do módulo', async () => {
    const source = await fsp.readFile(gbaModulePath, 'utf8');
    const topLevelReads = source
        .split('\n')
        .filter((line) => /^(const|let|var)\s+\w+\s*=\s*readFileSync\(/.test(line.trim()));

    assert.deepEqual(topLevelReads, []);
});
