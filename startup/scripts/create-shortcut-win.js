#!/usr/bin/env node

/**
 * Script para criar atalho Windows (.bat e .vbs)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

if (process.platform !== 'win32') {
  console.log('⚠ Este script é apenas para Windows. Use create-shortcut-linux.js para Linux.');
  process.exit(0);
}

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DESKTOP_DIR = path.join(os.homedir(), 'Desktop');
const SHORTCUT_NAME = 'Estoque Abrigo';
const START_SCRIPT = path.join(PROJECT_ROOT, 'start.js');
const BAT_FILE = path.join(DESKTOP_DIR, `${SHORTCUT_NAME}.bat`);
const VBS_FILE = path.join(PROJECT_ROOT, 'scripts', 'create-shortcut.vbs');

// Criar arquivo .bat
const batContent = `@echo off
cd /d "${PROJECT_ROOT}"
node "${START_SCRIPT}"
pause
`;

// Criar script VBS para gerar atalho (.lnk)
const iconPath = path.join(PROJECT_ROOT, 'build/icons/icon.ico');
const linkPath = path.join(DESKTOP_DIR, SHORTCUT_NAME + '.lnk').replace(/\\/g, '\\\\');

const vbsContent = `Set oWS = WScript.CreateObject("WScript.Shell")
sLinkFile = "${linkPath}"
Set oLink = oWS.CreateShortcut(sLinkFile)
oLink.TargetPath = "node.exe"
oLink.Arguments = """${START_SCRIPT.replace(/\\/g, '\\\\')}"""
oLink.WorkingDirectory = "${PROJECT_ROOT.replace(/\\/g, '\\\\')}"
oLink.Description = "Aplicação de gerenciamento de estoque do Abrigo Helena Dornfeld"
oLink.WindowStyle = 1
If fso.FileExists("${iconPath.replace(/\\/g, '\\\\')}") Then
  oLink.IconLocation = "${iconPath.replace(/\\/g, '\\\\')}"
End If
oLink.Save
Set oLink = Nothing
Set oWS = Nothing
`;

try {
  // Criar arquivo .bat (alternativa simples)
  if (!fs.existsSync(DESKTOP_DIR)) {
    fs.mkdirSync(DESKTOP_DIR, { recursive: true });
  }
  
  fs.writeFileSync(BAT_FILE, batContent);
  console.log('✅ Arquivo .bat criado na área de trabalho!');
  console.log(`   Localização: ${BAT_FILE}`);
  
  // Criar script VBS para gerar atalho .lnk
  const scriptsDir = path.dirname(VBS_FILE);
  if (!fs.existsSync(scriptsDir)) {
    fs.mkdirSync(scriptsDir, { recursive: true });
  }
  
  fs.writeFileSync(VBS_FILE, vbsContent);
  
  // Executar VBS para criar atalho .lnk
  const { exec } = require('child_process');
  const vbsPath = VBS_FILE.replace(/\\/g, '/');
  exec(`cscript //nologo "${VBS_FILE}"`, (error, stdout, stderr) => {
    if (error) {
      console.log('⚠ Não foi possível criar atalho .lnk, mas o arquivo .bat foi criado.');
      console.log('   Você pode usar o arquivo .bat diretamente.');
      console.log(`   Erro: ${error.message}`);
    } else {
      console.log('✅ Atalho .lnk criado na área de trabalho!');
    }
    
    // Remover arquivo VBS temporário
    setTimeout(() => {
      try {
        if (fs.existsSync(VBS_FILE)) {
          fs.unlinkSync(VBS_FILE);
        }
      } catch (e) {
        // Ignora erro ao remover
      }
    }, 1000);
  });
  
} catch (error) {
  console.error('❌ Erro ao criar atalho:', error.message);
  process.exit(1);
}

