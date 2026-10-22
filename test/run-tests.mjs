import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DEFAULT_CONFIG } from '../dados/src/utils/defaultConfig.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(projectRoot, 'dados', 'src', 'config.json');

// O config.json real do usuario e preservado: o conteudo original fica em
// memoria e volta ao disco no fim. Durante os testes entra uma configuracao
// completa (com prefixo), para que a suite nunca dependa do config da maquina
// e nunca deixe um "{}" para tras (um config incompleto derrubava o bot em
// qualquer mensagem).
const configExistia = fs.existsSync(configPath);
const configOriginal = configExistia ? await fsp.readFile(configPath, 'utf8') : null;

await fsp.mkdir(path.dirname(configPath), { recursive: true });
await fsp.writeFile(configPath, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, 'utf8');
console.log('ℹ️  config.json de teste aplicado (o original será restaurado ao final)');

let exitCode = 1;

try {
    const child = spawn(process.execPath, ['--test', 'test/**/*.test.js'], {
        cwd: projectRoot,
        stdio: 'inherit',
        env: { ...process.env }
    });

    exitCode = await new Promise((resolve) => {
        child.on('close', (code) => resolve(code ?? 1));
        child.on('error', () => resolve(1));
    });
} finally {
    if (configExistia) {
        await fsp.writeFile(configPath, configOriginal, 'utf8');
        console.log('ℹ️  config.json original restaurado');
    } else {
        await fsp.rm(configPath, { force: true });
        console.log('ℹ️  config.json temporário removido');
    }
}

process.exit(exitCode);
