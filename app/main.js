// Экран — настольная оболочка (Windows / macOS 10.14+).
// Программа — это index.html (та же, что на сайте).
// Обновления: страница сама проверяет сайт (кнопка «⟳ версия», оповещение «Обновить / Позже»),
// а оболочка по «Обновить» скачивает новую программу и новую оболочку и перезапускается.
const { app, BrowserWindow, Menu, dialog, shell, protocol, net, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const SITE = 'https://slavahoh1976-ops.github.io/ekran/';
const RELEASES = 'https://slavahoh1976-ops.github.io/ekran/download/';
const BUNDLED_DIR = path.join(__dirname, 'web');
const USER_DIR = () => path.join(app.getPath('userData'), 'web');

const num = v => String(v || '0').split('.').map(x => parseInt(x, 10) || 0);
const cmp = (a, b) => { a = num(a); b = num(b); for (let i = 0; i < 3; i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) - (b[i] || 0); return 0; };
const readVer = dir => { try { return fs.readFileSync(path.join(dir, 'version.txt'), 'utf8').trim(); } catch (e) { return '0'; } };

// какую версию программы показывать: скачанную (если новее встроенной) или встроенную
function webDir() {
  const u = USER_DIR();
  if (fs.existsSync(path.join(u, 'index.html')) && cmp(readVer(u), readVer(BUNDLED_DIR)) > 0) return u;
  return BUNDLED_DIR;
}
const currentVer = () => readVer(webDir());

// данные программы (проекты, свои кабинеты) — в папке «Экран»
app.setName('Экран');
app.setPath('userData', path.join(app.getPath('appData'), 'Экран'));

protocol.registerSchemesAsPrivileged([{ scheme: 'ekran', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);

let win = null;
function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 900, minHeight: 600, show: false,
    title: 'Экран', backgroundColor: '#0f172a',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, spellcheck: false },
  });
  win.once('ready-to-show', () => win.show());
  // внешние ссылки — в браузер
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (/^https?:/.test(url)) { e.preventDefault(); shell.openExternal(url); } });
  win.loadURL('ekran://app/index.html');
}

// ---------- обновления (как в «Срочном ТЗ»): проверяет сама программа — кнопка «⟳ версия» мигает и всплывает
// оповещение «Обновить / Позже». По «Обновить» оболочка скачивает новую программу (index.html) и, если вышла,
// новую оболочку (zip для Mac / установщик для Windows), ставит её поверх и перезапускается.
const os = require('os');
const { spawn, execFileSync } = require('child_process');
const REL = 'https://github.com/slavahoh1976-ops/ekran/releases/download/';
const send = (ch, v) => { try { win && win.webContents.send(ch, v); } catch (e) { } };
const getJSON = async () => { const r = await net.fetch(SITE + 'version.json?v=' + Date.now(), { cache: 'no-store' }); if (!r.ok) throw new Error('сайт ответил ' + r.status); return r.json(); };

// новая программа (страница) — в папку пользователя
async function fetchPage(j) {
  const h = await net.fetch(SITE + 'desktop/index.html?v=' + Date.now(), { cache: 'no-store' });
  if (!h.ok) throw new Error('сайт ответил ' + h.status);
  const html = await h.text();
  if (!html.includes(`APP_VERSION = '${j.version}'`)) throw new Error('скачанный файл не версии ' + j.version);
  const u = USER_DIR(); fs.mkdirSync(u, { recursive: true });
  fs.writeFileSync(path.join(u, 'index.html.tmp'), html);
  fs.renameSync(path.join(u, 'index.html.tmp'), path.join(u, 'index.html'));
  fs.writeFileSync(path.join(u, 'version.txt'), j.version);
}

// скачивание файла с прогрессом (0..1)
async function download(url, file, from, span) {
  ulog('get ' + url);
  const r = await net.fetch(url, { cache: 'no-store' });
  ulog('status ' + r.status + ' len ' + r.headers.get('content-length'));
  if (!r.ok) throw new Error('файл не найден (' + r.status + ')');
  const total = +r.headers.get('content-length') || 0, out = fs.createWriteStream(file), rd = r.body.getReader();
  let got = 0, lastSent = 0;
  for (;;) {
    const { done, value } = await rd.read(); if (done) break;
    got += value.length; if (!out.write(Buffer.from(value))) await new Promise(ok => out.once('drain', ok));
    if (total && Date.now() - lastSent > 150) { lastSent = Date.now(); send('upd-progress', from + span * got / total); }
  }
  await new Promise((ok, bad) => { out.on('error', bad); out.end(ok); });
  if (total && got !== total) throw new Error('файл скачался не полностью');
  return got;
}

// новая оболочка: Mac — заменить приложение и открыть; Windows — тихая установка поверх и запуск
const ulog = m => { if (process.env.EKRAN_UPDTEST) console.log('UPDTEST: ' + m); };
async function installShell(v) {
  ulog('start ' + v + ' ' + process.platform + '/' + process.arch);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ekran-upd-'));
  if (process.platform === 'darwin') {
    const appPath = path.resolve(process.execPath, '../../..');
    if (!appPath.endsWith('.app') || appPath.includes('/AppTranslocation/')) throw new Error('программа запущена не из папки «Программы» — перетащите её туда и обновите снова');
    fs.accessSync(path.dirname(appPath), fs.constants.W_OK);
    const name = process.arch === 'arm64' ? 'AppleSilicon' : 'Intel';
    const zip = path.join(tmp, 'new.zip');
    ulog('app ' + appPath);
    await download(`${REL}v${v}/Ekran-Mac-${name}-${v}.zip`, zip, 0.1, 0.85);
    ulog('downloaded ' + fs.statSync(zip).size);
    const dir = path.join(tmp, 'x'); fs.mkdirSync(dir);
    execFileSync('/usr/bin/ditto', ['-x', '-k', zip, dir]);
    const nApp = fs.readdirSync(dir).find(f => f.endsWith('.app'));
    if (!nApp) throw new Error('в архиве нет приложения');
    const plist = fs.readFileSync(path.join(dir, nApp, 'Contents/Info.plist'), 'utf8');
    if (!plist.includes(`<string>${v}</string>`)) throw new Error('в архиве не версия ' + v);
    const sh = path.join(tmp, 'swap.sh');
    fs.writeFileSync(sh, `#!/bin/bash
while kill -0 ${process.pid} 2>/dev/null; do sleep 0.3; done
OLD="$1"; NEW="$2"
mv "$OLD" "$OLD.old-$$" && /usr/bin/ditto "$NEW" "$OLD" && rm -rf "$OLD.old-$$" || { rm -rf "$OLD"; mv "$OLD.old-$$" "$OLD"; }
/usr/bin/xattr -cr "$OLD" 2>/dev/null
/usr/bin/open "$OLD"
rm -rf "${tmp}"
`, { mode: 0o755 });
    ulog('unpacked ' + nApp);
    spawn('/bin/bash', [sh, appPath, path.join(dir, nApp)], { detached: true, stdio: 'ignore' }).unref();
  } else if (process.platform === 'win32') {
    const portable = process.env.PORTABLE_EXECUTABLE_FILE;
    const file = path.join(tmp, portable ? 'Ekran-new.exe' : 'Ekran-Setup.exe');
    const size = await download(`${REL}v${v}/Ekran-Windows-${portable ? 'Portable' : 'Setup'}-${v}.exe`, file, 0.1, 0.85);
    const head = Buffer.alloc(2); const fd = fs.openSync(file, 'r'); fs.readSync(fd, head, 0, 2, 0); fs.closeSync(fd);
    if (head.toString() !== 'MZ' || size < 20e6) throw new Error('скачанный файл повреждён');
    if (portable) {
      // переносная версия: заменить exe на новый и запустить
      const cmd = path.join(tmp, 'swap.cmd');
      fs.writeFileSync(cmd, `@echo off\r\n:w\r\ntasklist /FI "PID eq ${process.pid}" | find "${process.pid}" >nul && (timeout /t 1 /nobreak >nul & goto w)\r\ncopy /y "${file}" "${portable}" >nul\r\nstart "" "${portable}"\r\n`);
      spawn('cmd.exe', ['/c', cmd], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    } else {
      // установщик: тихо поверх текущей (в ту же папку) и запуск после установки
      spawn(file, ['/S', '--updated', '--force-run'], { detached: true, stdio: 'ignore' }).unref();
    }
  } else throw new Error('эта система не поддерживается');
}

let updating = false;
ipcMain.handle('update', async () => {
  if (updating) return { error: 'обновление уже идёт' };
  updating = true;
  try {
    const j = await getJSON();
    send('upd-progress', 0.02);
    const sh = j.desktop && j.desktop.shell;
    const needShell = sh && cmp(sh, app.getVersion()) > 0;
    if (cmp(j.version, currentVer()) > 0) await fetchPage(j);
    send('upd-progress', 0.1);
    if (needShell) {
      await installShell(sh);
      send('upd-progress', 1);
      setTimeout(() => app.exit(0), 600);
      return { restart: true };
    }
    send('upd-progress', 1);
    setTimeout(() => win && win.webContents.reload(), 400);
    return { reload: true };
  } catch (e) {
    updating = false;
    return { error: String(e && e.message || e) };
  }
});

// старая проверка из меню (если страница вдруг не умеет): окна с выбором
async function checkUpdates(manual) {
  // новая страница сама показывает оповещение и кнопку «Обновить»
  try { if (win && await win.webContents.executeJavaScript('typeof window.sigCheckUpdate === "function"')) return win.webContents.executeJavaScript(`window.sigCheckUpdate(${manual ? 'true' : 'false'})`); } catch (e) { }
  if (!manual) return;
  try {
    const j = await getJSON();
    if (cmp(j.version, currentVer()) > 0) { await fetchPage(j); if (win) win.webContents.reload(); return; }
    dialog.showMessageBox(win, { type: 'info', message: 'У вас последняя версия', detail: `Программа ${currentVer()}, приложение ${app.getVersion()}.` });
  } catch (e) {
    dialog.showMessageBox(win, { type: 'warning', message: 'Не удалось проверить обновления', detail: String(e && e.message || e) + '\n\nПроверьте интернет и попробуйте позже.' });
  }
}
ipcMain.handle('check-updates', () => checkUpdates(true));

// ---------- меню
function buildMenu() {
  const mac = process.platform === 'darwin';
  const upd = { label: 'Проверить обновления…', click: () => checkUpdates(true) };
  const about = { label: 'О программе', click: () => dialog.showMessageBox(win, { type: 'info', message: 'Экран — коммутация и питание LED-экранов', detail: `Программа ${currentVer()}\nПриложение ${app.getVersion()} (Electron ${process.versions.electron})\n\n${SITE}` }) };
  const tpl = [
    ...(mac ? [{ label: 'Экран', submenu: [about, upd, { type: 'separator' }, { role: 'hide', label: 'Скрыть «Экран»' }, { role: 'hideOthers', label: 'Скрыть остальные' }, { role: 'unhide', label: 'Показать все' }, { type: 'separator' }, { role: 'quit', label: 'Выйти из «Экрана»' }] }] : []),
    { label: 'Правка', submenu: [{ role: 'undo', label: 'Отменить' }, { role: 'redo', label: 'Повторить' }, { type: 'separator' }, { role: 'cut', label: 'Вырезать' }, { role: 'copy', label: 'Копировать' }, { role: 'paste', label: 'Вставить' }, { role: 'selectAll', label: 'Выделить всё' }] },
    { label: 'Вид', submenu: [{ role: 'reload', label: 'Перезагрузить' }, { role: 'togglefullscreen', label: 'Во весь экран' }, { type: 'separator' }, { role: 'resetZoom', label: 'Масштаб окна 100%' }, { role: 'zoomIn', label: 'Крупнее' }, { role: 'zoomOut', label: 'Мельче' }, { type: 'separator' }, { role: 'toggleDevTools', label: 'Инструменты разработчика' }] },
    { label: 'Окно', submenu: [{ role: 'minimize', label: 'Свернуть' }, { role: 'close', label: 'Закрыть' }] },
    { label: 'Справка', submenu: [...(mac ? [] : [about, upd, { type: 'separator' }]), { label: 'Сайт программы', click: () => shell.openExternal(SITE) }, { label: 'Страница загрузки', click: () => shell.openExternal(RELEASES) }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    // ekran://app/<файл> → файл из текущей папки программы (адрес один и тот же, поэтому данные программы не теряются при обновлении)
    protocol.registerFileProtocol('ekran', (req, cb) => {
      const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '') || 'index.html';
      const file = path.normalize(path.join(webDir(), rel));
      if (!file.startsWith(webDir())) return cb({ error: -10 });
      cb({ path: file });
    });
    buildMenu(); createWindow();
    // проверка запуска в сборке GitHub: загрузиться, сообщить версию и выйти
    // проверка самообновления в сборке GitHub: скачать указанную версию оболочки, поставить поверх и выйти
    if (process.env.EKRAN_UPDTEST) {
      installShell(process.env.EKRAN_UPDTEST).then(() => { console.log('UPDTEST: OK'); setTimeout(() => app.exit(0), 600); })
        .catch(e => { console.log('UPDTEST: FAIL ' + (e && e.message || e)); app.exit(4); });
      return;
    }
    if (process.env.EKRAN_SMOKE) {
      console.log('SMOKE: окно создано, Electron ' + process.versions.electron + ', ' + process.platform + '/' + process.arch);
      setTimeout(() => { console.log('SMOKE: FAIL — страница не загрузилась за 90 с'); app.exit(3); }, 90000);
      win.webContents.on('did-finish-load', () => setTimeout(async () => {
        try { const r = await win.webContents.executeJavaScript("APP_NAME + ' ' + APP_VERSION + ' | экранов: ' + doc.led.screens.length + ' | кабинетов: ' + LED.scr().cabs.length + ' | LED.on: ' + LED.on"); console.log('SMOKE: OK ' + r); app.exit(0); }
        catch (e) { console.log('SMOKE: FAIL ' + e); app.exit(2); }
      }, 6000));
    }
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
  app.on('window-all-closed', () => app.quit());
}
