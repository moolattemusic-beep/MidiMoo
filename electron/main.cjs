const { app, BrowserWindow, ipcMain, session, powerSaveBlocker } = require('electron');
const path = require('node:path');
const { createRemoteServer, lanAddress } = require('./remote-server.cjs');
const ALLOWED_COMMANDS = require('./remote-commands.json');

const isDev = !app.isPackaged;
const DEV_SERVER_URL = 'http://localhost:3000';
// Only used when running unpackaged, where the process is generic Electron and
// would otherwise wear the Electron icon. The packaged bundle already carries
// its own icon.icns through CFBundleIconFile, and build/ is deliberately not
// shipped inside the asar — so this path only exists in a working tree.
const DEV_ICON_PATH = path.join(__dirname, '..', 'build', 'icon.png');

// The layout is designed against these numbers and scales as a whole rather
// than re-flowing, so the window is locked to that shape. A control tuned at
// one size then behaves the same at every other, and the only thing resizing
// changes is how large it all appears.
//
// 4:3 to match the iPad this is played from, which offers 1112x834 to a Sidecar
// display. The design is deliberately wider than the tablet rather than set to
// it: at the iPad's own width the columns fall below the layout's 1280
// breakpoint and stack, and the chord pads drop to two-across once their column
// gets under 300px. This is the narrowest round width that clears both, so the
// arrangement holds and the zoom stays as close to 1 as it can.
// The phone remote. Off until asked for: the instrument should not be listening
// on the network every time it is opened.
const REMOTE_PORT = 7331;
let remote = null;
let remoteStatus = { running: false, url: null, devUrl: null, clients: 0 };

const DESIGN_WIDTH = 1400;
const DESIGN_HEIGHT = 1050;
const ASPECT_RATIO = DESIGN_WIDTH / DESIGN_HEIGHT;

/** Send to the instrument window, which is the only one there is. */
function toRenderer(channel, payload) {
  const win = BrowserWindow.getAllWindows()[0];
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

async function startRemote() {
  if (remote) return remoteStatus;
  remote = createRemoteServer({
    port: REMOTE_PORT,
    // The same built bundle the desktop window loads. Inside the packaged app
    // it lives in the asar, which reads like any other directory.
    distDir: path.join(__dirname, '..', 'dist'),
    // In development the phone loads from Vite instead, so a change shows up
    // on the phone without rebuilding. The socket is on this port either way.
    devUrl: isDev ? `http://${lanAddress()}:3000/?remote=1` : null,
    isAllowed: (fn) => ALLOWED_COMMANDS.includes(fn),
    onCommand: (fn, args) => toRenderer('remote:command', { fn, args }),
    onClientGone: (releases) => toRenderer('remote:client-gone', releases),
    onWantsSnapshot: () => toRenderer('remote:wants-snapshot', null),
    onStatus: (status) => { remoteStatus = status; toRenderer('remote:status', status); },
  });
  try {
    remoteStatus = await remote.start();
  } catch (error) {
    remote = null;
    remoteStatus = {
      running: false, url: null, devUrl: null, clients: 0,
      error: error && error.code === 'EADDRINUSE'
        ? `Port ${REMOTE_PORT} is already in use`
        : String((error && error.message) || error),
    };
  }
  return remoteStatus;
}

function registerRemoteHandlers() {
  ipcMain.handle('remote:start', () => startRemote());

  ipcMain.handle('remote:stop', async () => {
    if (remote) { await remote.stop(); remote = null; }
    remoteStatus = { running: false, url: null, devUrl: null, clients: 0 };
    return remoteStatus;
  });

  ipcMain.handle('remote:status', () => remoteStatus);

  ipcMain.on('remote:publish', (_event, message) => {
    if (remote) remote.broadcast(message);
  });
}

function createWindow() {
  const win = new BrowserWindow({
    // Sizes refer to the page itself, so the layout gets the full design width
    // rather than losing the title bar out of its height.
    useContentSize: true,
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    // Kept on the same ratio: a minimum off the diagonal would fight the lock.
    minWidth: Math.round(600 * ASPECT_RATIO),
    minHeight: 600,
    title: 'MidiMOO',
    backgroundColor: '#1a1a1a',
    ...(isDev ? { icon: DEV_ICON_PATH } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Chromium throttles timers to about once a second in a window that is
      // backgrounded or covered up. The engine drives glide steps, strummed
      // note-ons and note releases from timers, so with the DAW in front they
      // would stall: chords arrive late, glides stop part way, notes hang.
      // This is an instrument — it has to keep exact time out of focus.
      backgroundThrottling: false,
    },
  });

  win.webContents.setBackgroundThrottling(false);
  win.setMenuBarVisibility(false);
  // Constrains dragging any edge or corner, and the green zoom button, so the
  // window can only ever be a scaled copy of the design size. The ratio is
  // measured against the page, not the frame — Electron accounts for the title
  // bar itself, so declaring it again as extra size would double-count it.
  win.setAspectRatio(ASPECT_RATIO);

  // Zoom is what keeps the interface proportional, and it has to be the browser
  // zoom rather than a CSS transform: media queries answer to the real viewport,
  // so a merely transformed layout still crosses breakpoints as the window
  // shrinks and the sections rearrange. Zooming instead divides the viewport by
  // the same factor, holding it at the design size, so every query, grid and
  // font keeps the value it was designed with and only the picture changes size.
  const applyZoom = () => {
    if (win.isDestroyed()) return;
    const [contentWidth, contentHeight] = win.getContentSize();
    if (!contentWidth || !contentHeight) return;
    win.webContents.setZoomFactor(
      Math.min(contentWidth / DESIGN_WIDTH, contentHeight / DESIGN_HEIGHT)
    );
  };
  win.on('resize', applyZoom);
  win.webContents.on('did-finish-load', applyZoom);

  if (isDev) {
    win.loadURL(DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

// macOS App Nap will suspend a background app regardless of how the renderer is
// configured, which would stall the same timers. Keep the process awake.
let powerSaveBlockerId = null;

app.whenReady().then(() => {
  powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension');

  // Dev only, and never fatal: setIcon throws if the file is missing, and a
  // cosmetic icon has no business taking down the instrument at startup.
  if (isDev && process.platform === 'darwin' && app.dock) {
    try {
      app.dock.setIcon(DEV_ICON_PATH);
    } catch (err) {
      console.warn('Could not set dev dock icon:', err.message);
    }
  }

  // Electron denies all permission requests by default; MIDI needs an
  // explicit grant so navigator.requestMIDIAccess() resolves like it does
  // in a real browser.
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    // MIDI for the instrument itself; clipboard read so chord progressions can
    // be pasted into the memory pads. Everything else stays denied.
    if (permission === 'midi' || permission === 'midiSysex' || permission === 'clipboard-read') {
      callback(true);
      return;
    }
    callback(false);
  });

  registerRemoteHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  // Close the port rather than leaving it held by a process on its way out.
  if (remote) { remote.stop(); remote = null; }
  if (powerSaveBlockerId !== null && powerSaveBlocker.isStarted(powerSaveBlockerId)) {
    powerSaveBlocker.stop(powerSaveBlockerId);
  }
});
