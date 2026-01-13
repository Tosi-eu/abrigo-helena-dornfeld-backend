#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DESKTOP_FILE = path.join(os.homedir(), '.local/share/applications/abrigo-estoque.desktop');
const ICON_PATH = path.join(PROJECT_ROOT, 'build/icons/icon.png');
const START_SCRIPT = path.join(PROJECT_ROOT, 'start.js');

const desktopDir = path.dirname(DESKTOP_FILE);
if (!fs.existsSync(desktopDir)) {
  fs.mkdirSync(desktopDir, { recursive: true });
}

const desktopContent = `[Desktop Entry]
Version=1.0
Type=Application
Name=Estoque Abrigo
Comment=Aplicação de gerenciamento de estoque do Abrigo Helena Dornfeld
Exec=node "${START_SCRIPT}"
Icon=${ICON_PATH}
Terminal=true
Categories=Utility;Office;
StartupNotify=true
`;

try {
  fs.writeFileSync(DESKTOP_FILE, desktopContent);
  fs.chmodSync(DESKTOP_FILE, 0o755);
  
  console.log('✅ Atalho Linux criado com sucesso!');
  console.log(`   Localização: ${DESKTOP_FILE}`);
  console.log('   O atalho deve aparecer no menu de aplicações.');
} catch (error) {
  console.error('❌ Erro ao criar atalho:', error.message);
  process.exit(1);
}
