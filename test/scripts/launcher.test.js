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

function runLauncher(dir, { env = {}, fullEnv = null, timeoutMs = 20000 } = {}) {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, [startScript], {
            cwd: dir,
            env: fullEnv || {
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

test('o launcher injeta as pastas do yt-dlp e do FFmpeg no PATH do bot', async () => {
    const dir = await launcherSandbox({
        startupBody: 'console.log("[SANDBOX] PATH=" + process.env.PATH); setInterval(() => {}, 1000);'
    });
    const toolsDir = path.join(dir, 'tools');
    await fsp.mkdir(toolsDir, { recursive: true });
    const ytDlp = path.join(toolsDir, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
    const ffmpeg = path.join(toolsDir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
    await fsp.writeFile(ytDlp, 'fake');
    await fsp.writeFile(ffmpeg, 'fake');

    try {
        const result = await runLauncher(dir, {
            timeoutMs: 8000,
            env: {
                NAZUNA_YOUTUBE_YTDLP_PATH: ytDlp,
                NAZUNA_YOUTUBE_FFMPEG_PATH: ffmpeg
            }
        });

        assert.match(result.stdout, /\[SANDBOX\] PATH=(.*)/, `saida: ${result.stdout}`);
        const childPath = result.stdout.match(/\[SANDBOX\] PATH=(.*)/)[1];
        assert.ok(childPath.includes(toolsDir), `o PATH do bot deve conter a pasta do yt-dlp/ffmpeg (${childPath})`);
        assert.match(result.stdout, /yt-dlp disponível no PATH do bot/);
        assert.match(result.stdout, /FFmpeg disponível para miniaturas/);
    } finally {
        await removeDir(dir);
    }
});

test('o launcher informa o provider do YouTube e avisa quando o fallback da VexAPI está ativo', async () => {
    const dir = await launcherSandbox();

    try {
        await fsp.writeFile(
            path.join(dir, 'dados', 'src', 'config.json'),
            JSON.stringify({ api: { youtube: { provider: 'auto', allowVexFallback: true } } }),
            'utf8'
        );

        const result = await runLauncher(dir, { timeoutMs: 8000 });

        assert.match(result.stdout, /YouTube: provider=auto fallbackVex=ATIVO/, `saida: ${result.stdout}`);
        assert.match(result.stdout, /Fallback da VexAPI ATIVO/);
    } finally {
        await removeDir(dir);
    }
});

test('sem configuracao, o launcher mostra o provider local sem fallback da VexAPI', async () => {
    const dir = await launcherSandbox();

    try {
        const result = await runLauncher(dir, { timeoutMs: 8000 });

        assert.match(result.stdout, /YouTube: provider=local fallbackVex=desativado/, `saida: ${result.stdout}`);
        assert.doesNotMatch(result.stdout, /Fallback da VexAPI ATIVO/);
    } finally {
        await removeDir(dir);
    }
});

/**
 * Reconstrói o ambiente do processo com a chave do PATH em uma caixa específica
 * (o Windows usa "Path") ou sem PATH algum.
 */
function envWithPathKey(key, value) {
    const env = {};
    for (const [nome, conteudo] of Object.entries(process.env)) {
        if (nome.toUpperCase() === 'PATH') continue;
        env[nome] = conteudo;
    }
    if (key) env[key] = value;
    return env;
}

test('o launcher sobe quando o PATH do Windows vem com a chave "Path" (sem "PATH")', async () => {
    const dir = await launcherSandbox({
        startupBody: 'console.log("[SANDBOX] PATH=" + process.env.PATH); setInterval(() => {}, 1000);'
    });
    const toolsDir = path.join(dir, 'tools');
    await fsp.mkdir(toolsDir, { recursive: true });
    const ytDlp = path.join(toolsDir, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
    const ffmpeg = path.join(toolsDir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
    await fsp.writeFile(ytDlp, 'fake');
    await fsp.writeFile(ffmpeg, 'fake');

    const fullEnv = envWithPathKey('Path', path.join(dir, 'sem-node'));
    fullEnv.NAZUNA_YOUTUBE_YTDLP_PATH = ytDlp;
    fullEnv.NAZUNA_YOUTUBE_FFMPEG_PATH = ffmpeg;

    try {
        const result = await runLauncher(dir, { fullEnv, timeoutMs: 8000 });

        assert.doesNotMatch(
            result.stdout,
            /Erro inesperado/,
            `o launcher não pode quebrar com o PATH em "Path" (saida: ${result.stdout}\nerros: ${result.stderr})`
        );
        assert.doesNotMatch(result.stdout, /reading 'split'/);
        assert.match(result.stdout, /\[SANDBOX\] PATH=/, `saida: ${result.stdout}\nerros: ${result.stderr}`);

        const childPath = result.stdout.match(/\[SANDBOX\] PATH=(.*)/)[1];
        assert.ok(
            childPath.includes(toolsDir),
            `as pastas do yt-dlp/FFmpeg devem entrar no PATH do bot (${childPath})`
        );
    } finally {
        await removeDir(dir);
    }
});

test('sem PATH no ambiente, o launcher não quebra e ainda sobe o bot', async () => {
    const dir = await launcherSandbox();

    // No Windows o próprio sistema devolve um PATH mesmo quando o processo
    // não o tem, então a checagem é feita no código e o cenário é validado
    // pelo comportamento: o launcher nunca pode quebrar.
    const source = await fsp.readFile(startScript, 'utf8');
    assert.match(source, /PATH não encontrado no ambiente/);
    assert.match(source, /NAZUNA_YOUTUBE_YTDLP_PATH/);

    const fullEnv = envWithPathKey(null, null);

    try {
        const result = await runLauncher(dir, { fullEnv, timeoutMs: 8000 });

        assert.doesNotMatch(result.stdout, /reading 'split'/);
        assert.doesNotMatch(result.stdout, /Erro inesperado/, `saida: ${result.stdout}\nerros: ${result.stderr}`);
        assert.match(result.stdout, /\[SANDBOX\] startup rodou/, `saida: ${result.stdout}\nerros: ${result.stderr}`);
    } finally {
        await removeDir(dir);
    }
});

test('o launcher completa um config.json incompleto sem perder o que já exists', async () => {
    const dir = await launcherSandbox();

    try {
        const configPath = path.join(dir, 'dados', 'src', 'config.json');
        await fsp.writeFile(configPath, JSON.stringify({ prefixo: '#' }), 'utf8');

        const result = await runLauncher(dir, { timeoutMs: 8000 });

        assert.doesNotMatch(result.stdout, /Erro inesperado/, `saida: ${result.stdout}\nerros: ${result.stderr}`);
        assert.match(result.stdout, /config\.json incompleto/, `saida: ${result.stdout}`);

        const repaired = JSON.parse(await fsp.readFile(configPath, 'utf8'));
        assert.equal(repaired.prefixo, '#', 'o prefixo do usuário precisa ser preservado');
        assert.equal(repaired.nomebot, 'Nazuna');
        assert.equal(typeof repaired.numerodono, 'string');
        assert.equal(repaired.modoaluguel, false);
    } finally {
        await removeDir(dir);
    }
});

test('o launcher cria o config.json com prefixo quando ele não existe', async () => {
    const dir = await launcherSandbox();

    try {
        const configPath = path.join(dir, 'dados', 'src', 'config.json');
        await fsp.rm(configPath, { force: true });

        const result = await runLauncher(dir, { timeoutMs: 8000 });

        assert.match(result.stdout, /config\.json criado com valores padrão/, `saida: ${result.stdout}`);

        const created = JSON.parse(await fsp.readFile(configPath, 'utf8'));
        assert.equal(created.prefixo, '!');
        assert.ok(created.prefixo.length > 0);
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
