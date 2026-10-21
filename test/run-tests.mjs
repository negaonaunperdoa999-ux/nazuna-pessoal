import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(projectRoot, 'dados', 'src', 'config.json');
const createdConfig = !fs.existsSync(configPath);

if (createdConfig) {
    await fsp.mkdir(path.dirname(configPath), { recursive: true });
    await fsp.writeFile(configPath, '{}', { encoding: 'utf8' });
    console.log('ℹ️  config.json temporário criado (será removido ao final)');
}

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
    if (createdConfig) {
        await fsp.rm(configPath, { force: true });
        console.log('ℹ️  config.json temporário removido');
    } else {
        console.log('ℹ️  config.json pré-existente preservado');
    }
}

process.exit(exitCode);
