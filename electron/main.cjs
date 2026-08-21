const { app, BrowserWindow, session, powerSaveBlocker } = require('electron');
const path = require('node:path');

const isDev = !app.isPackaged;
const DEV_SERVER_URL = 'http://localhost:3000';
// nativeImage (used by BrowserWindow icon / app.dock.setIcon) can't load .icns;
// that format is only used by electron-builder for the packaged app bundle.
const ICON_PATH = path.join(__dirname, '..', 'build', 'icon.png');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'MidiMOO',
    backgroundColor: '#1a1a1a',
    icon: ICON_PATH,
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

if (process.platform === 'darwin' && app.dock) {
  app.dock.setIcon(ICON_PATH);
}

// macOS App Nap will suspend a background app regardless of how the renderer is
// configured, which would stall the same timers. Keep the process awake.
let powerSaveBlockerId = null;

app.whenReady().then(() => {
  powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension');

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
