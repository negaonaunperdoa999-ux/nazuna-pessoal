import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..', '..');
const startScript = path.join(projectRoot, 'dados', 'src', '.scripts', 'start.js');
const startupScript = path.join(projectRoot, 'startup.js');
const configPath = path.join(projectRoot, 'dados', 'src', 'config.json');

/**
 * Sandbox com o layout minimo do projeto para o start.js rodar isolado:
 * sem dados/database/qr-code (portanto sem sessao e com o menu aparecendo),
 * sem tocar a sessao real nem o node_modules real.
 */
async function startSandbox() {
    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'nazuna-start-'));
    await fsp.mkdir(path.join(dir, 'dados', 'src'), { recursive: true });
    await fsp.mkdir(path.join(dir, 'node_modules'), { recursive: true });
    await fsp.writeFile(path.join(dir, 'dados', 'src', 'connect.js'), '// dummy\n', 'utf8');
    await fsp.writeFile(path.join(dir, 'startup.js'), '// dummy\n', 'utf8');
    return dir;
}

test('o fluxo original é preservado: npm start usa .scripts/start.js', async () => {
    const pkg = JSON.parse(await fsp.readFile(path.join(projectRoot, 'package.json'), 'utf8'));

    assert.equal(pkg.scripts.start, 'node dados/src/.scripts/start.js');
    assert.equal(pkg.scripts.dev, 'nodemon dados/src/.scripts/start.js');
    assert.ok(pkg.scripts.config, 'npm run config continua disponível');
    assert.ok(pkg.scripts['config:install']);
});

test('o startup.js da raiz segue sendo o entry point simples do original', async () => {
    const source = await fsp.readFile(startupScript, 'utf8');

    assert.match(source, /import ['"]\.\/dados\/src\/index\.js['"]/);
    assert.match(source, /import ['"]\.\/dados\/src\/connect\.js['"]/);
    assert.doesNotMatch(source, /bootstrap/i, 'não deve existir bootstrap alternativo');
});

test('.scripts/start.js verifica dependências, config e só então conecta', async () => {
    const source = await fsp.readFile(startScript, 'utf8');

    assert.match(source, /NODE_MODULES_PATH/);
    assert.match(source, /config:install/);
    assert.match(source, /npm run config/);
    assert.match(source, /case 'play':|method === 'qr'|method === 'code'/);
    assert.match(source, /const MAIN_FILE = path\.join\(process\.cwd\(\), 'startup\.js'\)/);
    assert.match(source, /spawn\(process\.execPath, args/);
    assert.doesNotMatch(source, /spawn\('node'/);
});

test('o fluxo de inicialização original roda em isolamento e NÃO conecta ao WhatsApp', async () => {
    const dir = await startSandbox();

    try {
        const child = spawn(process.execPath, [startScript], {
            cwd: dir,
            env: { ...process.env, NO_COLOR: '1' },
            stdio: ['pipe', 'pipe', 'pipe']
        });

        const stdout = [];
        const stderr = [];
        let sent = false;

        const timer = setTimeout(() => {
            child.kill();
        }, 30000);

        child.stdout.on('data', (chunk) => {
            const text = chunk.toString();
            stdout.push(text);
            const acc = stdout.join('');
            // responde "3" (sair) assim que o menu de conexao aparecer
            if (!sent && /desejada/.test(acc)) {
                sent = true;
                child.stdin.write('3\n');
            }
        });
        child.stderr.on('data', (chunk) => stderr.push(chunk.toString()));
        child.stdin.on('error', () => {});

        const code = await new Promise((resolve) => {
            child.on('close', (exitCode) => {
                clearTimeout(timer);
                resolve(exitCode);
            });
            child.on('error', () => {
                clearTimeout(timer);
                resolve(1);
            });
        });

        const output = stdout.join('') + stderr.join('');

        assert.equal(code, 0, `saida: ${output}`);
        assert.match(output, /Escolha o m.todo de conex.o/i);
        assert.doesNotMatch(output, /Escaneie o QR/i, 'não deve gerar QR');
        assert.doesNotMatch(output, /pareamento:/i, 'não deve gerar código de pareamento');
        assert.doesNotMatch(output, /bios\.bin/, 'não deve tentar ler o BIOS do GBA');
    } finally {
        await fsp.rm(dir, { recursive: true, force: true });
    }
});

test('a inicialização não carrega o GBA nem o Pokémon antes do uso', async () => {
    const indexSource = await fsp.readFile(path.join(projectRoot, 'dados', 'src', 'index.js'), 'utf8');

    assert.doesNotMatch(
        indexSource,
        /^\s*import\s+[^;]*from\s+['"][^'"]*gba\/gbaTestHtml\.js['"]\s*;/m,
        'GBA não pode ser importado estaticamente'
    );
    assert.doesNotMatch(
        indexSource,
        /^\s*import\s+[^;]*from\s+['"][^'"]*pokemonRichHtml\.js['"]\s*;/m,
        'Pokémon não pode ser importado estaticamente'
    );
    assert.match(indexSource, /await import\(['"]\.\/funcs\/private\/gba\/gbaTestHtml\.js['"]\)/);
    assert.match(indexSource, /case 'doon':/);
});
