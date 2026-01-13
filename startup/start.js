#!/usr/bin/env node

/**
 * Script de startup multiplataforma (Windows, Linux, macOS)
 * Substitui o Electron e funciona em todas as plataformas
 */

const { spawn, exec } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const FRONTEND_URL = 'http://localhost:8081';
const CHECK_INTERVAL = 2000; // 2 segundos
const PROJECT_ROOT = __dirname;
const LOADING_HTML = path.join(PROJECT_ROOT, 'loading.html');

const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';

function checkFrontendReady() {
  return new Promise((resolve) => {
    const req = http.get(FRONTEND_URL, (res) => {
      resolve(res.statusCode === 200);
    });
    
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function openInBrowser(url) {
  let command;
  
  if (isWindows) {
    command = `start "" "${url}"`;
  } else if (isMac) {
    command = `open "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }
  
  exec(command, (error) => {
    if (error) {
      console.warn(`⚠ Não foi possível abrir o navegador automaticamente.`);
      console.log(`   Por favor, abra manualmente: ${url}`);
    }
  });
}

function runDockerCompose(command) {
  let cmd;
  let args;
  
  if (isWindows) {
    cmd = 'docker-compose';
    args = command === 'up' ? ['up', '-d'] : ['down'];
  } else {
    cmd = 'docker';
    args = command === 'up' ? ['compose', 'up', '-d'] : ['compose', 'down'];
  }
  
  return spawn(cmd, args, {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    shell: isWindows,
  });
}

async function cleanup() {
  console.log('\n\n🛑 Encerrando aplicação...');
  
  const dockerProcess = runDockerCompose('down');
  
  dockerProcess.on('close', (code) => {
    console.log('✓ Docker Compose encerrado.');
    process.exit(0);
  });
  setTimeout(() => {
    console.log('⚠ Timeout ao encerrar Docker Compose.');
    process.exit(0);
  }, 10000);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

if (isWindows) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  rl.on('SIGINT', () => {
    cleanup();
  });
}

async function main() {
  console.log('🚀 Iniciando aplicação...\n');
  
  if (!fs.existsSync(LOADING_HTML)) {
    console.warn('⚠ Arquivo loading.html não encontrado. Continuando sem tela de loading...');
  } else {
    console.log('📱 Abrindo tela de loading...');
    openInBrowser(`file://${LOADING_HTML}`);
  }
  
  console.log('🐳 Iniciando Docker Compose...');
  const dockerProcess = runDockerCompose('up');
  
  await new Promise((resolve, reject) => {
    dockerProcess.on('error', async (error) => {
      if (isWindows && error.code === 'ENOENT') {
        console.log('⚠ Tentando com "docker compose" (nova sintaxe)...');
        const altProcess = spawn('docker', ['compose', 'up', '-d'], {
          cwd: PROJECT_ROOT,
          stdio: 'inherit',
          shell: true,
        });
        
        altProcess.on('error', (altError) => {
          console.error('❌ Erro ao executar Docker Compose:', altError.message);
          console.log('\n💡 Certifique-se de que o Docker está instalado e rodando.');
          reject(altError);
        });
        
        altProcess.on('close', (code) => {
          if (code === 0) {
            console.log('✓ Docker Compose iniciado com sucesso!');
            resolve(code);
          } else {
            reject(new Error(`Docker Compose falhou com código ${code}`));
          }
        });
        
        return;
      }
      
      console.error('❌ Erro ao executar Docker Compose:', error.message);
      console.log('\n💡 Certifique-se de que o Docker está instalado e rodando.');
      reject(error);
    });
    
    dockerProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✓ Docker Compose iniciado com sucesso!');
        resolve(code);
      } else {
        reject(new Error(`Docker Compose falhou com código ${code}`));
      }
    });
  });
  
  await new Promise((resolve) => setTimeout(resolve, 5000));
  
  console.log('⏳ Aguardando aplicação ficar pronta...');
  let attempts = 0;
  const maxAttempts = 60; // 2 minutos máximo
  
  while (attempts < maxAttempts) {
    if (await checkFrontendReady()) {
      console.log('✓ Aplicação pronta!\n');
      break;
    }
    
    attempts++;
    process.stdout.write(`\r   Tentativa ${attempts}/${maxAttempts}...`);
    await new Promise((resolve) => setTimeout(resolve, CHECK_INTERVAL));
  }
  
  if (attempts >= maxAttempts) {
    console.log('\n⚠ Timeout aguardando aplicação. Tentando abrir mesmo assim...');
  }
  
  console.log(`🌐 Abrindo aplicação em ${FRONTEND_URL}...`);
  openInBrowser(FRONTEND_URL);
  
  console.log('\n✅ Aplicação iniciada!');
  console.log(`   URL: ${FRONTEND_URL}`);
  console.log('   Pressione Ctrl+C para encerrar\n');
  
  process.stdin.resume();
}

main().catch((error) => {
  console.error('❌ Erro ao iniciar aplicação:', error);
  process.exit(1);
});

