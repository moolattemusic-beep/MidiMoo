/**
 * The two parts of the remote server that must not be got wrong, kept apart
 * from it so they can be tested without standing up a server: what a phone is
 * owed when it disappears, and what a request is allowed to read.
 */
const path = require('node:path');

/**
 * Which of a phone's gestures are still down.
 *
 * Commands are recorded as they pass through rather than interpreted, so this
 * knows nothing about the engine — only how to say the opposite of what it saw.
 * It exists because a phone that goes out of range mid-chord never sends its
 * note-offs, and something has to.
 */
class HeldGestures {
  constructor() {
    this.notes = new Map();      // performance key -> the args that started it
    this.baseTypes = new Set();
    this.extensions = new Set();
  }

  record(fn, args) {
    if (fn === 'handleMidi') {
      const [pitch, , isOn] = args;
      if (isOn) this.notes.set(pitch, args);
      else this.notes.delete(pitch);
    } else if (fn === 'setBaseType') {
      this.baseTypes.add(args[0]);
    } else if (fn === 'releaseBaseType') {
      this.baseTypes.delete(args[0]);
    } else if (fn === 'toggleExtension') {
      this.extensions.add(args[0]);
    } else if (fn === 'releaseExtension') {
      this.extensions.delete(args[0]);
    } else if (fn === 'panic') {
      this.notes.clear();
      this.baseTypes.clear();
      this.extensions.clear();
    }
  }

  /** The commands that undo everything still down. */
  releases() {
    const out = [];
    for (const args of this.notes.values()) {
      const released = [...args];
      released[1] = 0;      // velocity
      released[2] = false;  // isOn
      out.push({ fn: 'handleMidi', args: released });
    }
    for (const type of this.baseTypes) out.push({ fn: 'releaseBaseType', args: [type] });
    for (const ext of this.extensions) out.push({ fn: 'releaseExtension', args: [ext] });
    return out;
  }
}

/**
 * Where a request lands on disk, or null if it tried to leave the bundle.
 *
 * Anything without a file extension is the app itself, so a reload deep in the
 * interface comes back to the interface rather than a 404.
 */
function resolveFile(distDir, pathname) {
  const relative = pathname === '/' || !path.extname(pathname) ? '/index.html' : pathname;
  const root = path.resolve(distDir);
  const file = path.resolve(root, '.' + path.posix.normalize(relative));
  // path.resolve already collapses '..', so this catches anything that climbed
  // out — including a path that only looks contained until it is normalised.
  if (file !== root && !file.startsWith(root + path.sep)) return null;
  return file;
}

module.exports = { HeldGestures, resolveFile };
