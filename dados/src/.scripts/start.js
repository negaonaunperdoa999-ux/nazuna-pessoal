#!/usr/bin/env node

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { spawn, execSync } from 'child_process';
import readline from 'readline/promises';
import os from 'os';

const CONFIG_PATH = path.join(process.cwd(), 'dados', 'src', 'config.json');
const NODE_MODULES_PATH = path.join(process.cwd(), 'node_modules');
const QR_CODE_DIR = path.join(process.cwd(), 'dados', 'database', 'qr-code');
// Arquivo principal do projeto: o bot e iniciado por ele (importa index.js + connect.js).
const MAIN_FILE = path.join(process.cwd(), 'startup.js');
const CONNECT_FILE = path.join(process.cwd(), 'dados', 'src', 'connect.js');
const isWindows = os.platform() === 'win32';
const isTermux = fsSync.existsSync('/data/data/com.termux');
const MAX_RESTARTS = 10;
const RESTART_DELAYS_MS = [1000, 2000, 5000, 10000, 30000];

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[1;32m',
  red: '\x1b[1;31m',
  blue: '\x1b[1;34m',
  yellow: '\x1b[1;33m',
  cyan: '\x1b[1;36m',
  bold: '\x1b[1m',
};

const mensagem = (text) => console.log(`${colors.green}${text}${colors.reset}`);
const aviso = (text) => console.log(`${colors.red}${text}${colors.reset}`);
const info = (text) => console.log(`${colors.cyan}${text}${colors.reset}`);
const separador = () => console.log(`${colors.blue}============================================${colors.reset}`);

const getVersion = () => {
  try {
    const packageJson = JSON.parse(fsSync.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
    return packageJson.version || 'Desconhecida';
  } catch {
    return 'Desconhecida';
  }
};

let botProcess = null;
let restartAttempts = 0;
const version = getVersion();

async function setupTermuxAutostart() {
  if (!isTermux) {
    info('📱 Não está rodando no Termux. Ignorando configuração de autostart.');
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await rl.question(`${colors.yellow}📱 Detectado ambiente Termux. Deseja configurar inicialização automática? (s/n): ${colors.reset}`);
  rl.close();

  if (answer.trim().toLowerCase() !== 's') {
    info('📱 Configuração de autostart ignorada pelo usuário.');
    return;
  }

  info('📱 Configurando inicialização automática no Termux...');

  try {
    const termuxProperties = path.join(process.env.HOME, '.termux', 'termux.properties');
    await fs.mkdir(path.dirname(termuxProperties), { recursive: true });
    if (!fsSync.existsSync(termuxProperties)) {
      await fs.writeFile(termuxProperties, '');
    }
    execSync(`sed '/^# *allow-external-apps *= *true/s/^# *//' ${termuxProperties} -i && termux-reload-settings`, { stdio: 'inherit' });
    mensagem('📝 Configuração de termux.properties concluída.');

    const bashrcPath = path.join(process.env.HOME, '.bashrc');
    const termuxServiceCommand = `
am startservice --user 0 \\
  -n com.termux/com.termux.app.RunCommandService \\
  -a com.termux.RUN_COMMAND \\
  --es com.termux.RUN_COMMAND_PATH '/data/data/com.termux/files/usr/bin/npm' \\
  --esa com.termux.RUN_COMMAND_ARGUMENTS 'start' \\
  --es com.termux.RUN_COMMAND_SESSION_NAME 'Nazuna Bot' \\
  --es com.termux.RUN_COMMAND_WORKDIR '${path.join(process.cwd())}' \\
  --ez com.termux.RUN_COMMAND_BACKGROUND 'false' \\
  --es com.termux.RUN_COMMAND_SESSION_ACTION '0'
`.trim();

    let bashrcContent = '';
    if (fsSync.existsSync(bashrcPath)) {
      bashrcContent = await fs.readFile(bashrcPath, 'utf8');
    }

    if (!bashrcContent.includes(termuxServiceCommand)) {
      await fs.appendFile(bashrcPath, `\n${termuxServiceCommand}\n`);
      mensagem('📝 Comando am startservice adicionado ao ~/.bashrc');
    } else {
      info('📝 Comando am startservice já presente no ~/.bashrc');
    }

    mensagem('📱 Configuração de inicialização automática no Termux concluída!');
  } catch (error) {
    aviso(`❌ Erro ao configurar autostart no Termux: ${error.message}`);
  }
}

function setupGracefulShutdown() {
  const shutdown = () => {
    mensagem('🛑 Encerrando o Nazuna... Até logo!');
    if (botProcess) {
      botProcess.removeAllListeners();
      botProcess.kill();
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  if (isWindows) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.on('SIGINT', shutdown);
  }
}

async function displayHeader() {
  const header = [
    `${colors.bold}🚀 Nazuna - Conexão WhatsApp${colors.reset}`,
    `${colors.bold}📦 Versão: ${version}${colors.reset}`,
  ];

  separador();
  for (const line of header) {
    console.log(line);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  separador();
  console.log();
}

const DEFAULT_CONFIG = {
  nomedono: '',
  numerodono: '',
  nomebot: 'Nazuna',
  prefixo: '!',
  site_vex: 'https://vexapi.com.br',
  apikey_vex: '',
  github_ofc: 'https://github.com/DevTokyoVx/nazuna',
  autor: 'DevTokyoVx',
  repositorio: 'nazuna',
  modoaluguel: false,
  WA_WEB_VERSION: {
    aviso: 'Não mexa aqui, pode afetar o funcionamento do BOT.',
    value: [2, 3000, 1034740716]
  }
};

async function ensureConfigFile() {
  if (fsSync.existsSync(CONFIG_PATH)) {
    return;
  }

  try {
    fsSync.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fsSync.writeFileSync(CONFIG_PATH, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, 'utf8');
    aviso('ℹ️ config.json criado com valores padrão (dados/src/config.json).');
    mensagem('📝 Conecte-se normalmente; depois configure o dono (veja /lid e o comando /numerodono).');
  } catch (error) {
    aviso(`❌ Falha ao criar o config.json padrão: ${error.message}`);
    mensagem('📝 O bot pode iniciar assim mesmo, mas confira as permissões de arquivo da pasta.');
  }
}

async function checkPrerequisites() {
  await ensureConfigFile();

  if (!fsSync.existsSync(NODE_MODULES_PATH)) {
    aviso('⚠️ Módulos do Node.js não encontrados! Iniciando instalação automática...');
    try {
      await new Promise((resolve, reject) => {
        const installProcess = spawn('npm', ['run', 'config:install'], { stdio: 'inherit', shell: isWindows });
        installProcess.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Instalação falhou com código ${code}`))));
        installProcess.on('error', reject);
      });
      mensagem('📦 Instalação dos módulos concluída com sucesso!');
    } catch (error) {
      aviso(`❌ Falha na instalação dos módulos: ${error.message}`);
      mensagem('📦 Tente executar manualmente: npm run config:install');
      process.exit(1);
    }
  }

  if (!fsSync.existsSync(MAIN_FILE)) {
    aviso(`⚠️ Arquivo principal (${MAIN_FILE}) não encontrado!`);
    aviso('🔍 Verifique a instalação do projeto (o startup.js fica na raiz).');
    process.exit(1);
  }

  if (!fsSync.existsSync(CONNECT_FILE)) {
    aviso(`⚠️ Arquivo de conexão (${CONNECT_FILE}) não encontrado!`);
    aviso('🔍 Verifique a instalação do projeto.');
    process.exit(1);
  }
}

function detectFfmpegDir() {
  const candidates = [];

  if (process.env.NAZUNA_YOUTUBE_FFMPEG_PATH) {
    candidates.push(path.dirname(process.env.NAZUNA_YOUTUBE_FFMPEG_PATH));
  }

  const envPath = process.env.PATH || '';
  for (const dir of envPath.split(path.delimiter).filter(Boolean)) {
    candidates.push(dir);
  }

  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    const packages = path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Packages');
    try {
      for (const entry of fsSync.readdirSync(packages)) {
        if (!entry.startsWith('yt-dlp.FFmpeg')) continue;
        const base = path.join(packages, entry);
        for (const inner of fsSync.readdirSync(base)) {
          candidates.push(path.join(base, inner, 'bin'));
        }
      }
    } catch { /* sem pacotes do WinGet */ }
  }

  const names = process.platform === 'win32' ? ['ffmpeg.exe'] : ['ffmpeg'];
  for (const dir of candidates) {
    for (const name of names) {
      const candidate = path.join(dir, name);
      try {
        if (fsSync.existsSync(candidate)) return dir;
      } catch { /* ignora */ }
    }
  }

  return null;
}

function startBot(codeMode = false) {
  const args = ['--expose-gc', MAIN_FILE];
  if (codeMode) args.push('--code');

  info(`📷 Iniciando com ${codeMode ? 'código de pareamento' : 'QR Code'}`);
  info(`📄 Arquivo principal: ${MAIN_FILE}`);

  // O Baileys gera a miniatura de video chamando "ffmpeg" do PATH.
  // Sem o FFmpeg no PATH do processo, o video vai sem miniatura.
  // O caminho do Node continua no PATH (usamos process.execPath para o spawn).
  const env = { ...process.env, FORCE_COLOR: '1' };
  const ffmpegDir = detectFfmpegDir();

  if (ffmpegDir) {
    env.PATH = `${ffmpegDir}${path.delimiter}${env.PATH || ''}`;
    info(`🎞️ FFmpeg disponível para miniaturas: ${ffmpegDir}`);
  } else {
    aviso('⚠️ FFmpeg não encontrado: vídeos serão enviados sem miniatura (o iOS pode exibir capa preta).');
  }

  // process.execPath: o executavel exato deste Node, sem depender do "node" no PATH.
  const startedAt = Date.now();
  botProcess = spawn(process.execPath, args, {
    stdio: 'inherit',
    env,
  });

  let settled = false;

  botProcess.on('error', (error) => {
    if (settled) return;
    settled = true;
    aviso(`❌ Erro ao iniciar o processo do bot: ${error.message}`);
    scheduleRestart(codeMode);
  });

  botProcess.on('close', (code) => {
    if (settled) return;
    settled = true;
    // Se o bot rodou por um tempo razoavel, a proxima falha nao conta como reincidencia.
    if (Date.now() - startedAt > 30000) restartAttempts = 0;
    if (code === 0) {
      info(`✅ O bot terminou normalmente (código: ${code}). Reiniciando...`);
    } else {
      aviso(`⚠️ O bot terminou com erro (código: ${code}). Reiniciando...`);
    }
    scheduleRestart(codeMode);
  });

  return botProcess;
}

function scheduleRestart(codeMode) {
  restartAttempts += 1;

  if (restartAttempts > MAX_RESTARTS) {
    aviso(`🛑 Limite de reinicializações atingido (${MAX_RESTARTS}). Verifique o arquivo principal e as dependências antes de tentar de novo.`);
    process.exitCode = 1;
    process.exit(1);
    return;
  }

  const delay = RESTART_DELAYS_MS[Math.min(restartAttempts - 1, RESTART_DELAYS_MS.length - 1)];
  aviso(`🔄 Reiniciando o bot em ${delay}ms (tentativa ${restartAttempts}/${MAX_RESTARTS})...`);

  setTimeout(() => {
    if (botProcess) botProcess.removeAllListeners();
    startBot(codeMode);
  }, delay);
}

async function checkAutoConnect() {
  try {
    if (!fsSync.existsSync(QR_CODE_DIR)) {
      await fs.mkdir(QR_CODE_DIR, { recursive: true });
      return false;
    }
    const files = await fs.readdir(QR_CODE_DIR);
    return files.length > 2;
  } catch (error) {
    aviso(`❌ Erro ao verificar diretório de QR Code: ${error.message}`);
    return false;
  }
}

async function promptConnectionMethod() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(`${colors.yellow}🔧 Escolha o método de conexão:${colors.reset}`);
  console.log(`${colors.yellow}1. 📷 Conectar via QR Code${colors.reset}`);
  console.log(`${colors.yellow}2. 🔑 Conectar via código de pareamento${colors.reset}`);
  console.log(`${colors.yellow}3. 🚪 Sair${colors.reset}`);

  const answer = await rl.question('➡️ Digite o número da opção desejada: ');
  console.log();
  rl.close();

  switch (answer.trim()) {
    case '1':
      mensagem('📷 Iniciando conexão via QR Code...');
      return { method: 'qr' };
    case '2':
      mensagem('🔑 Iniciando conexão via código de pareamento...');
      return { method: 'code' };
    case '3':
      mensagem('👋 Encerrando... Até mais!');
      process.exit(0);
    default:
      aviso('⚠️ Opção inválida! Usando conexão via QR Code como padrão.');
      return { method: 'qr' };
  }
}

async function main() {
  try {
    setupGracefulShutdown();
    await displayHeader();
    await checkPrerequisites();
    await setupTermuxAutostart();

    const hasSession = await checkAutoConnect();
    if (hasSession) {
      mensagem('📷 Sessão de QR Code detectada. Conectando automaticamente...');
      startBot(false);
    } else {
      const { method } = await promptConnectionMethod();
      startBot(method === 'code');
    }
  } catch (error) {
    aviso(`❌ Erro inesperado: ${error.message}`);
    process.exit(1);
  }
}

(async () => {
  await main();
})();