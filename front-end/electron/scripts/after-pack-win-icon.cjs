'use strict';

const fs = require('fs');
const path = require('path');

module.exports = async function afterPackWinIcon(context) {
  if (context.electronPlatformName !== 'win32') return;

  const exeName = `${context.packager.appInfo.productFilename}.exe`;
  const exePath = path.join(context.appOutDir, exeName);
  const iconPath = path.join(context.packager.projectDir, 'build', 'icon.ico');

  if (!fs.existsSync(exePath) || !fs.existsSync(iconPath)) {
    console.warn('[afterPack] Ícone do .exe não aplicado (arquivo ausente).', {
      exePath,
      iconPath,
    });
    return;
  }

  // rcedit v4: default export via require; v5+: named export via ESM
  const mod = require('rcedit');
  const rceditFn = typeof mod === 'function' ? mod : mod.rcedit || mod.default;
  if (typeof rceditFn !== 'function') {
    throw new TypeError('rcedit is not a function — use rcedit@4.x');
  }

  await rceditFn(exePath, { icon: iconPath });
  console.log('[afterPack] Ícone do executável Windows aplicado:', exePath);
};
