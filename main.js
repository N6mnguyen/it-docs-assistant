const { app, BrowserWindow, ipcMain, shell, screen, clipboard, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const COLLAPSED = { w: 64, h: 64 };
const EXPANDED = { w: 520, h: 640 };
const SCREEN_GAP = 32;
const MARGIN = 16;
const TEXT_EXT = new Set(['.txt', '.md']);
const MAX_TEXT = 200 * 1024;

let win;
let expanded = false;

const configPath = () => path.join(app.getPath('userData'), 'config.json');

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath(), 'utf8'));
  } catch {
    return {};
  }
}

function saveConfig(cfg) {
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2));
}

// Ban portable: PORTABLE_EXECUTABLE_DIR la thu muc chua file exe (khong phai thu muc tam)
const defaultDocs = () =>
  app.isPackaged
    ? path.join(process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath), 'docs')
    : path.join(__dirname, 'docs');

function docsFolder() {
  return loadConfig().docsFolder || defaultDocs();
}

// Bo dau tieng Viet + ha chu thuong de tim kiem khong phu thuoc dau
function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase();
}

function walk(dir, out = []) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.name.toLowerCase() !== 'docs.json') out.push(full);
  }
  return out;
}

let idxCache = { t: 0, key: '', data: null };
function buildIndex() {
  // cache 3s de moi lan go khong phai doc lai toan bo file
  const key = docsFolder();
  if (idxCache.data && idxCache.key === key && Date.now() - idxCache.t < 3000) return idxCache.data;
  const data = buildIndexRaw();
  idxCache = { t: Date.now(), key, data };
  return data;
}

function buildIndexRaw() {
  const folder = docsFolder();
  const files = walk(folder);

  // docs.json (tuy chon): [{ "file": "cai-dat.pdf", "title": "Huong dan cai dat", "keywords": "cai dat, install" }]
  let meta = {};
  try {
    const arr = JSON.parse(fs.readFileSync(path.join(folder, 'docs.json'), 'utf8'));
    for (const m of arr) meta[norm(m.file)] = m;
  } catch {}

  return files.map((full) => {
    const rel = path.relative(folder, full);
    const base = path.basename(full);
    const m = meta[norm(base)] || meta[norm(rel)] || {};
    let content = '';
    if (TEXT_EXT.has(path.extname(full).toLowerCase())) {
      try {
        content = fs.readFileSync(full, 'utf8').slice(0, MAX_TEXT);
      } catch {}
    }
    return {
      path: full,
      name: m.title || base,
      nameN: norm((m.title || '') + ' ' + rel),
      kwN: norm(m.keywords || ''),
      contentN: norm(content),
      snippet: content ? content.replace(/\s+/g, ' ').slice(0, 120) : ''
    };
  });
}

const STOP = new Set(['tai','lieu','huong','dan','file','cho','toi','xin','can','muon','hay','gui','cach','la','va','de','nao','the','ve','cua']);

function search(query) {
  const qn = norm(query).trim();
  if (['huong dan', 'help', '?'].includes(qn)) {
    const all = buildIndex().map((d) => ({ name: d.name, path: d.path, snippet: d.snippet }));
    return { folder: docsFolder(), total: all.length, help: true, results: all };
  }
  let tokens = norm(query).split(/[^a-z0-9]+/).filter((t) => t.length >= 2);
  // bo tu chung (tai lieu, huong dan...) de khong lam nhieu ket qua; neu chi con tu chung thi giu nguyen
  const key = tokens.filter((t) => !STOP.has(t));
  if (key.length) tokens = key;
  const index = buildIndex();
  if (!tokens.length) return { folder: docsFolder(), total: index.length, results: [] };

  const scored = index
    .map((d) => {
      let score = 0;
      for (const t of tokens) {
        if (d.nameN.includes(t)) score += 3;
        if (d.kwN.includes(t)) score += 3;
        if (d.contentN.includes(t)) score += 1;
      }
      return { d, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const top = scored.length ? scored[0].score : 0;
  const picked = scored
    .filter((x) => x.score >= top * 0.6)
    .slice(0, 8)
    .map((x) => ({ name: x.d.name, path: x.d.path, snippet: x.d.snippet }));

  return { folder: docsFolder(), total: index.length, results: picked };
}

function boundsFor(size) {
  const wa = screen.getPrimaryDisplay().workArea;
  return {
    x: wa.x + wa.width - size.w - MARGIN,
    y: wa.y + wa.height - size.h - MARGIN,
    width: size.w,
    height: size.h
  };
}

function windowSize(isExpanded, display = screen.getPrimaryDisplay()) {
  const desired = isExpanded ? EXPANDED : COLLAPSED;
  const wa = display.workArea;
  return {
    w: Math.min(desired.w, Math.max(1, wa.width - SCREEN_GAP)),
    h: Math.min(desired.h, Math.max(1, wa.height - SCREEN_GAP))
  };
}

function initialBounds(size) {
  const saved = loadConfig().windowPosition;
  if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
    return clampBounds(saved.x, saved.y, size);
  }
  return boundsFor(size);
}

function clampBounds(x, y, size) {
  const display = screen.getDisplayNearestPoint({
    x: Math.round(x + size.w / 2),
    y: Math.round(y + size.h / 2)
  });
  const wa = display.workArea;
  return {
    x: Math.round(Math.max(wa.x, Math.min(x, wa.x + wa.width - size.w))),
    y: Math.round(Math.max(wa.y, Math.min(y, wa.y + wa.height - size.h))),
    width: size.w,
    height: size.h
  };
}

function createWindow() {
  win = new BrowserWindow({
    ...initialBounds(COLLAPSED),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    icon: path.join(__dirname, 'assets', 'logo.png'),
    webPreferences: {
      spellcheck: false,
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.loadFile('index.html');
  win.webContents.setVisualZoomLevelLimits(1, 1);
  win.webContents.setZoomFactor(1);
}

ipcMain.handle('toggle', () => {
  const bounds = win.getBounds();
  const display = screen.getDisplayNearestPoint({
    x: Math.round(bounds.x + bounds.width / 2),
    y: Math.round(bounds.y + bounds.height / 2)
  });
  expanded = !expanded;
  const next = windowSize(expanded, display);
  win.setBounds(clampBounds(
    bounds.x + bounds.width - next.w,
    bounds.y + bounds.height - next.h,
    next
  ));
  return expanded;
});

function moveWindow(position, persist = false) {
  if (!win || win.isDestroyed() || !position) return;
  const { x, y } = position;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  const bounds = clampBounds(x, y, { w: win.getSize()[0], h: win.getSize()[1] });
  win.setPosition(bounds.x, bounds.y);
  if (persist) saveConfig({ ...loadConfig(), windowPosition: { x: bounds.x, y: bounds.y } });
}

ipcMain.on('move-window', (_event, position) => moveWindow(position));
ipcMain.on('move-window-end', (_event, position) => moveWindow(position, true));

ipcMain.handle('search', (_e, q) => search(q));
ipcMain.handle('download', async (_e, p) => {
  // chi cho tai file nam trong thu muc docs
  const root = path.resolve(docsFolder()) + path.sep;
  if (!path.resolve(p).startsWith(root)) throw new Error('Invalid path');
  const r = await dialog.showSaveDialog(win, {
    defaultPath: path.join(app.getPath('downloads'), path.basename(p))
  });
  if (r.canceled || !r.filePath) return null;
  fs.copyFileSync(p, r.filePath);
  shell.showItemInFolder(r.filePath);
  return r.filePath;
});
ipcMain.handle('quit', () => app.quit());

app.whenReady().then(() => {
  try { fs.mkdirSync(defaultDocs(), { recursive: true }); } catch {}
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: true }); // tu chay khi bat may
  createWindow();
});
app.on('window-all-closed', () => app.quit());
