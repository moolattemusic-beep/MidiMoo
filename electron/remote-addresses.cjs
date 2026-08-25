/**
 * Where a phone can reach this Mac, and over what.
 *
 * There is no direct USB path for a web page — Safari speaks IP and nothing
 * else. What the cable gives you instead is a network of its own: with the
 * iPhone plugged in and Personal Hotspot switched on, macOS raises an "iPhone
 * USB" interface and the two ends talk over the wire rather than the air. That
 * is the one worth offering first, so this works out which address is which
 * rather than guessing.
 */
const os = require('node:os');
const { execFile } = require('node:child_process');

/** Apple hands out this /28 on Personal Hotspot, over the cable and over Wi-Fi alike. */
const HOTSPOT_PREFIX = '172.20.10.';

/**
 * Which BSD device belongs to which hardware port, as macOS names them —
 * "iPhone USB", "Wi-Fi", "USB 10/100/1000 LAN". Without this an interface is
 * just `en6`, which says nothing about what it is plugged into.
 */
function hardwarePorts() {
  return new Promise((resolve) => {
    execFile('networksetup', ['-listallhardwareports'], { timeout: 2000 }, (error, stdout) => {
      if (error || !stdout) { resolve({}); return; }
      const ports = {};
      let port = null;
      for (const line of stdout.split('\n')) {
        const named = line.match(/^Hardware Port:\s*(.+?)\s*$/);
        if (named) { port = named[1]; continue; }
        const device = line.match(/^Device:\s*(\S+)\s*$/);
        if (device && port) { ports[device[1]] = port; port = null; }
      }
      resolve(ports);
    });
  });
}

function classify(device, port, address) {
  const name = (port ?? '').toLowerCase();
  // A tethered iPhone is the cable, whether macOS labels the port or not: the
  // hotspot subnet is only ever handed out by the phone itself.
  if (/iphone|ipad/.test(name) || address.startsWith(HOTSPOT_PREFIX)) return 'usb';
  if (/wi-?fi|airport|wireless/.test(name)) return 'wifi';
  return 'other';
}

/** Rank: the cable first, then Wi-Fi, then whatever else answers. */
const RANK = { usb: 0, wifi: 1, other: 2 };

/**
 * Every address a phone could use, best first.
 * @returns {Promise<Array<{host: string, kind: 'usb'|'wifi'|'other', label: string}>>}
 */
async function listAddresses() {
  const ports = await hardwarePorts();
  const found = [];
  for (const [device, addresses] of Object.entries(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family !== 'IPv4' || address.internal) continue;
      // Link-local means nothing configured this interface; nothing routes to it.
      if (address.address.startsWith('169.254.')) continue;
      const port = ports[device];
      const kind = classify(device, port, address.address);
      found.push({ host: address.address, kind, label: port ?? device });
    }
  }
  found.sort((a, b) => RANK[a.kind] - RANK[b.kind] || a.host.localeCompare(b.host));
  return found;
}

/** The single best address, for anything that only wants one. */
async function bestAddress() {
  const found = await listAddresses();
  return found[0]?.host ?? '127.0.0.1';
}

module.exports = { listAddresses, bestAddress, classify, HOTSPOT_PREFIX };
