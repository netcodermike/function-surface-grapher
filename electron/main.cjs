const { app, BrowserWindow, protocol, session, shell } = require('electron');
const { readFile } = require('node:fs/promises');
const path = require('node:path');

const appRoot = path.join(__dirname, '..');
const entry = 'grapher://app/index.html';
const sourcePage = 'https://github.com/netcodermike/function-surface-grapher';
const files = new Map([
  ['/index.html', 'text/html'],
  ['/style.css', 'text/css'],
  ['/app.mjs', 'text/javascript'],
  ['/coordinates.mjs', 'text/javascript'],
  ['/intersections.mjs', 'text/javascript'],
  ['/sampling.mjs', 'text/javascript'],
  ['/surface-view.mjs', 'text/javascript'],
]);
const contentPolicy = "default-src 'none'; script-src 'self'; style-src 'self'; base-uri 'none'; form-action 'none'";

protocol.registerSchemesAsPrivileged([{
  scheme: 'grapher',
  privileges: { standard: true, secure: true, supportFetchAPI: true },
}]);

async function serveApp(request) {
  const url = new URL(request.url);
  const type = files.get(url.pathname);
  if (url.host !== 'app' || !type || request.method !== 'GET') {
    return new Response(null, { status: 404 });
  }
  const file = await readFile(path.join(appRoot, url.pathname.slice(1)));
  return new Response(file, {
    headers: {
      'Content-Type': type + '; charset=utf-8',
      'Content-Security-Policy': contentPolicy,
    },
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 540,
    minHeight: 480,
    backgroundColor: '#18161f',
    autoHideMenuBar: true,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => {
    event.preventDefault();
    if (event.url === sourcePage) {
      shell.openExternal(sourcePage).catch(error => console.error(error));
    }
  });
  return win.loadURL(entry);
}

function launchFailed(error) {
  console.error(error);
  app.exit(1);
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, reply) => reply(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  protocol.handle('grapher', serveApp);
  app.on('activate', () => {
    if (!BrowserWindow.getAllWindows().length) createWindow().catch(launchFailed);
  });
  return createWindow();
}).catch(launchFailed);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
