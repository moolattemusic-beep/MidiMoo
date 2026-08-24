/**
 * The bridge between the renderer, which owns the engine, and the main process,
 * which owns the socket. The renderer is sandboxed and cannot listen on a port;
 * main has no idea what a chord is. Neither needs to change: this passes
 * commands one way and state the other.
 */
const { contextBridge, ipcRenderer } = require('electron');

const subscribe = (channel, callback) => {
  const handler = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

contextBridge.exposeInMainWorld('midimooRemote', {
  /** A phone pressed something. */
  onCommand: (callback) => subscribe('remote:command', callback),
  /** A phone went away, and is owed note-offs for whatever it was holding. */
  onClientGone: (callback) => subscribe('remote:client-gone', callback),
  /** The server started, stopped, or gained or lost a phone. */
  onStatus: (callback) => subscribe('remote:status', callback),
  /** Send state down to every connected phone. */
  publish: (message) => ipcRenderer.send('remote:publish', message),
  /** A phone connected and needs the whole picture. */
  onWantsSnapshot: (callback) => subscribe('remote:wants-snapshot', callback),

  start: () => ipcRenderer.invoke('remote:start'),
  stop: () => ipcRenderer.invoke('remote:stop'),
  status: () => ipcRenderer.invoke('remote:status'),
});
