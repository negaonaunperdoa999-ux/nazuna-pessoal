import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..', '..');
const startScript = path.join(projectRoot, 'dados', 'src', '.scripts', 'start.js');

/**
 * Sandbox com o layout do projeto: o startup.js e um duble que apenas registra
 * a execucao (nada de WhatsApp), e o PATH nao tem "node" (prova de que o
 * launcher nao depende do nome "node" no PATH).
 */
async function launcherSandbox({ startupBody = 'console.log("[SANDBOX] startup rodou"); setInterval(() => {}, 1000);' } = {}) {
    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'nazuna-launcher-'));
    await fsp.mkdir(path.join(dir, 'dados', 'src'), { recursive: true });
    await fsp.mkdir(path.join(dir, 'node_modules'), { recursive: true });
    // sessao "existente" no sandbox: o launcher entra no caminho de auto-conexao
    // (sem menu) e sobe o startup.js duble
    const session = path.join(dir, 'dados', 'database', 'qr-code');
    await fsp.mkdir(session, { recursive: true });
    await fsp.writeFile(path.join(session, 'creds.json'), '{}', 'utf8');
    await fsp.writeFile(path.join(session, 'app-state.json'), '{}', 'utf8');
    await fsp.writeFile(path.join(session, 'device-list.json'), '[]', 'utf8');
    await fsp.writeFile(path.join(dir, 'dados', 'src', 'connect.js'), '// dummy\n', 'utf8');
    await fsp.writeFile(path.join(dir, 'startup.js'), startupBody, 'utf8');
    return dir;
}

function runLauncher(dir, { env = {}, timeoutMs = 20000 } = {}) {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, [startScript], {
            cwd: dir,
            env: {
                ...process.env,
                // sem "node" no PATH: um spawn por nome falharia
                PATH: path.join(dir, 'sem-node'),
                ...env
            },
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';
        let finished = false;

        const finish = (payload) => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            resolve({ stdout, stderr, ...payload });
        };

        const timer = setTimeout(() => {
            killTree(child.pid);
            finish({ code: null, timeout: true });
        }, timeoutMs);

        child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
        child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
        child.stdin.on('error', () => {});

        child.on('close', (code) => finish({ code, timeout: false }));
        child.on('error', (error) => finish({ code: 1, timeout: false, error: error.message }));
    });
}

function killTree(pid) {
    if (!pid) return;
    try {
        if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
        } else {
            process.kill(-pid, 'SIGKILL');
        }
    } catch {
        // o processo ja pode ter encerrado
    }
}

async function removeDir(dir) {
    for (let attempt = 0; attempt < 6; attempt++) {
        try {
            await fsp.rm(dir, { recursive: true, force: true });
            return;
        } catch (error) {
            if (attempt === 5) return;
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
    }
}

test('o launcher executa o startup.js da raiz, nunca main.js', async () => {
    const source = await fsp.readFile(startScript, 'utf8');

    assert.match(source, /const MAIN_FILE = path\.join\(process\.cwd\(\), 'startup\.js'\)/);
    assert.doesNotMatch(source, /main\.js/);
    assert.match(source, /spawn\(process\.execPath, args/);
    assert.doesNotMatch(source, /spawn\('node'/);
});

test('o package.json aponta o main para startup.js', async () => {
    const pkg = JSON.parse(await fsp.readFile(path.join(projectRoot, 'package.json'), 'utf8'));

    assert.equal(pkg.main, 'startup.js');
    assert.equal(pkg.scripts.start, 'node dados/src/.scripts/start.js');
});

test('o startup.js da raiz importa index.js e connect.js', async () => {
    const source = await fsp.readFile(path.join(projectRoot, 'startup.js'), 'utf8');

    assert.match(source, /import ['"]\.\/dados\/src\/index\.js['"]/);
    assert.match(source, /import ['"]\.\/dados\/src\/connect\.js['"]/);
});

test('o launcher sobe o startup.js mesmo sem "node" no PATH', async () => {
    const dir = await launcherSandbox();

    try {
        const result = await runLauncher(dir, { timeoutMs: 6000 });

        assert.match(result.stdout, /\[SANDBOX\] startup rodou/, `saida: ${result.stdout}\nerros: ${result.stderr}`);
        assert.match(result.stdout, /Arquivo principal: .*startup\.js/);
        assert.doesNotMatch(result.stdout, /spawn node ENOENT/);
    } finally {
        await removeDir(dir);
    }
});

test('o loop de reinicialização tem limite e backoff', async () => {
    const source = await fsp.readFile(startScript, 'utf8');

    assert.match(source, /MAX_RESTARTS/);
    assert.match(source, /RESTART_DELAYS_MS/);
    assert.match(source, /Limite de reinicializações atingido/);
    assert.doesNotMatch(source, /Reiniciando o bot em 500ms/);
});

test('uma falha de inicialização nao entra em loop infinito', async () => {
    const dir = await launcherSandbox({
        startupBody: 'process.exit(3);',
        exitCode: 3
    });

    try {
        const result = await runLauncher(dir, { timeoutMs: 8000 });

        const execucoes = (result.stdout.match(/\[SANDBOX\]/g) || []).length;
        const delays = [...result.stdout.matchAll(/Reiniciando o bot em (\d+)ms/g)].map((m) => Number(m[1]));

        assert.ok(execucoes <= 3, `não deve repetir em loop rapido (${execucoes} execuções em 8s)`);
        assert.ok(delays.length > 0, 'deve registrar o backoff');
        assert.ok(delays.every((delay) => delay >= 1000), `o backoff deve crescer (${delays.join(',')})`);
    } finally {
        await removeDir(dir);
    }
});
