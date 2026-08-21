const { app, BrowserWindow, session, powerSaveBlocker } = require('electron');
const path = require('node:path');

const isDev = !app.isPackaged;
const DEV_SERVER_URL = 'http://localhost:3000';
// Only used when running unpackaged, where the process is generic Electron and
// would otherwise wear the Electron icon. The packaged bundle already carries
// its own icon.icns through CFBundleIconFile, and build/ is deliberately not
// shipped inside the asar — so this path only exists in a working tree.
const DEV_ICON_PATH = path.join(__dirname, '..', 'build', 'icon.png');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'MidiMOO',
    backgroundColor: '#1a1a1a',
    ...(isDev ? { icon: DEV_ICON_PATH } : {}),
    webPreferences: {
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

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  if (powerSaveBlockerId !== null && powerSaveBlocker.isStarted(powerSaveBlockerId)) {
    powerSaveBlocker.stop(powerSaveBlockerId);
  }
});
