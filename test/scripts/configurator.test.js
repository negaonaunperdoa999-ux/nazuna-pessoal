import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..', '..');
const configScript = path.join(projectRoot, 'dados', 'src', '.scripts', 'config.js');

const ANSWERS = [
    'Dono de Teste',
    '5511999999999',
    'Nazuna Teste',
    '.',
    '',
    'n'
];

function runConfigurator(cwd) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [configScript], {
            cwd,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, NO_COLOR: '1' }
        });

        const stdout = [];
        const stderr = [];
        let seen = 0;
        let sent = 0;

        child.stdout.on('data', (chunk) => {
            const text = chunk.toString();
            stdout.push(text);
            seen += (text.match(/-->/g) || []).length;
            while (sent < seen && sent < ANSWERS.length) {
                child.stdin.write(`${ANSWERS[sent]}\n`);
                sent++;
            }
        });

        child.stderr.on('data', (chunk) => stderr.push(chunk.toString()));
        child.stdin.on('error', () => {});

        child.on('error', reject);
        child.on('close', (code) => {
            resolve({ code, stdout: stdout.join(''), stderr: stderr.join('') });
        });
    });
}

async function sandbox() {
    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'nazuna-config-test-'));
    await fsp.writeFile(
        path.join(dir, 'package.json'),
        JSON.stringify({ name: 'sandbox', version: '0.0.0-test', type: 'module' }),
        'utf8'
    );
    return dir;
}

test('o configurador do Nazuna roda até o fim e grava a configuração', async () => {
    const dir = await sandbox();

    try {
        const result = await runConfigurator(dir);

        assert.equal(result.code, 0, `saída: ${result.stdout}\nerros: ${result.stderr}`);
        assert.doesNotMatch(result.stdout + result.stderr, /off is not defined/);
        assert.doesNotMatch(result.stdout + result.stderr, /Erro fatal/);

        const configPath = path.join(dir, 'dados', 'src', 'config.json');
        const raw = await fsp.readFile(configPath, 'utf8');
        const config = JSON.parse(raw);

        assert.equal(config.nomedono, 'Dono de Teste');
        assert.equal(config.numerodono, '5511999999999');
        assert.equal(config.nomebot, 'Nazuna Teste');
        assert.equal(config.prefixo, '.');
        assert.equal(config.modoaluguel, false);
        assert.equal(typeof config.modoaluguel, 'boolean');
        assert.match(result.stdout, /Configuração salva com sucesso/);
    } finally {
        await fsp.rm(dir, { recursive: true, force: true });
    }
});

test('o configurador grava no sandbox e não escreve no config do projeto', async () => {
    const projectConfig = path.join(projectRoot, 'dados', 'src', 'config.json');
    const dir = await sandbox();

    try {
        await runConfigurator(dir);

        const sandboxConfig = JSON.parse(await fsp.readFile(path.join(dir, 'dados', 'src', 'config.json'), 'utf8'));
        assert.equal(sandboxConfig.nomedono, 'Dono de Teste');

        let projectRaw = null;
        try {
            projectRaw = await fsp.readFile(projectConfig, 'utf8');
        } catch {
            projectRaw = null;
        }

        if (projectRaw) {
            assert.doesNotMatch(projectRaw, /Dono de Teste/, 'o configurador não deve gravar no projeto');
            assert.doesNotMatch(projectRaw, /5511999999999/);
        }
    } finally {
        await fsp.rm(dir, { recursive: true, force: true });
    }
});
