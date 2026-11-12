// Gan icon vao exe (rcedit), thay cho buoc editExecutable bi loi symlink tren Windows
const path = require('path');
exports.default = async (ctx) => {
  if (ctx.electronPlatformName !== 'win32') return;
  const m = require('rcedit');
  const rcedit = typeof m === 'function' ? m : m.default || m.rcedit;
  const exe = path.join(ctx.appOutDir, ctx.packager.appInfo.productFilename + '.exe');
  await rcedit(exe, { icon: path.join(ctx.packager.projectDir, 'assets', 'logo.ico') });
};
