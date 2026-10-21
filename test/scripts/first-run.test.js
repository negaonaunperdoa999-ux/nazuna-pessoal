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
const configPath = path.join(projectRoot, 'dados', 'src', 'config.json');
const qrDir = path.join(projectRoot, 'dados', 'database', 'qr-code');

/**
 * Sandbox com o layout minimo do projeto: sem dados/database/qr-code (sem sessao,
 * logo o menu aparece) e sem tocar a sessao real nem o node_modules real.
 */
async function startSandbox() {
    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'nazuna-first-'));
    await fsp.mkdir(path.join(dir, 'dados', 'src'), { recursive: true });
    await fsp.mkdir(path.join(dir, 'node_modules'), { recursive: true });
    await fsp.writeFile(path.join(dir, 'dados', 'src', 'connect.js'), '// dummy\n', 'utf8');
    await fsp.writeFile(path.join(dir, 'startup.js'), '// dummy\n', 'utf8');
    return dir;
}

function runStartScript(cwd) {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, [startScript], {
            cwd,
            env: { ...process.env, NO_COLOR: '1' },
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';
        let sent = false;

        const timer = setTimeout(() => {
            child.kill();
        }, 30000);

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString();
            if (!sent && /desejada/.test(stdout)) {
                sent = true;
                child.stdin.write('3\n');
            }
        });
        child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
        child.stdin.on('error', () => {});

        child.on('close', (code) => {
            clearTimeout(timer);
            resolve({ code, stdout, stderr });
        });
        child.on('error', () => {
            clearTimeout(timer);
            resolve({ code: 1, stdout, stderr: 'spawn error' });
        });
    });
}

test('sem config.json, o início NÃO abre o configurador e chega ao menu de conexão', async () => {
    const dir = await startSandbox();

    try {
        const result = await runStartScript(dir);
        const output = result.stdout + result.stderr;

        assert.equal(result.code, 0, output);
        assert.match(output, /Escolha o m.todo de conex.o/i);
        assert.match(output, /QR Code/);
        assert.match(output, /pareamento/i);
        assert.doesNotMatch(output, /Iniciando configura..o autom.tica/i);
        assert.doesNotMatch(output, /Nome do dono do bot/i);
        assert.doesNotMatch(output, /Configura..o salva com sucesso/i);
        assert.doesNotMatch(output, /Escaneie o QR/i);
    } finally {
        await fsp.rm(dir, { recursive: true, force: true });
    }
});

test('o start.js nunca chama npm run config automaticamente', async () => {
    const source = await fsp.readFile(startScript, 'utf8');

    assert.doesNotMatch(source, /npm['"]\s*,\s*\[['\"]run['"]\s*,\s*['"]config['"]/);
    assert.doesNotMatch(source, /Iniciando configura[çc][ãa]o autom[áa]tica/);
    assert.match(source, /config:install/);
    assert.match(source, /DEFAULT_CONFIG/);
});

test('a leitura do config da pasta do index.js tolera arquivo ausente', async () => {
    const { carregarConfigLocal } = await import('../../dados/src/funcs/API.js');
    const config = carregarConfigLocal();

    assert.equal(typeof config, 'object');
    assert.notEqual(config, null);
});

test('o /lid continua acessível sem dono configurado e sem conceder privilégios', async () => {
    const source = await fsp.readFile(path.join(projectRoot, 'dados', 'src', 'index.js'), 'utf8');
    const start = source.indexOf("case 'lid':");
    const end = source.indexOf('break', start);
    const block = source.slice(start, end);

    assert.ok(start > 0, 'o comando /lid deve existir');
    assert.doesNotMatch(block, /isOwner|isOwnerOrSub|numerodono/, '/lid nao pode exigir permissao de dono');
    assert.match(block, /remoteJid|participant/);

    const ownerGate = source.slice(source.indexOf('const isOwner ='), source.indexOf('const isOwnerOrSub'));
    assert.match(ownerGate, /lidowner/, 'o acesso de dono depende do lidowner configurado');
    assert.match(ownerGate, /numerodono|nmrdn/, 'o acesso de dono depende do numerodono configurado');
});

test('sem dono configurado, o buildUserId nao gera identificador valido', async () => {
    // helpers.js mantem setInterval no import, entao rodamos em processo filho
    // (que encerra explicitamente) para nao segurar o event loop do teste.
    const code = "import('./dados/src/utils/helpers.js').then(m => { console.log(m.buildUserId('', {})); process.exit(0); })";
    const result = await new Promise((resolve) => {
        const child = spawn(process.execPath, ['--input-type=module', '-e', code], {
            cwd: projectRoot,
            stdio: ['ignore', 'pipe', 'pipe']
        });
        let stdout = '';
        child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
        child.on('close', () => resolve(stdout.trim()));
    });

    assert.equal(result, '@s.whatsapp.net');
    assert.doesNotMatch(result, /\d/, 'sem numero de dono nao pode gerar um id de usuario valido');
});
