/**
 * Test runner.
 *
 * The suites import the engine's TypeScript directly, so each is bundled
 * through Vite before it runs — that way a test exercises the same source the
 * app does, with no separate build step to fall out of step with it.
 *
 *   npm test            run every suite
 *   npm test glide moo  run named suites
 *
 * A suite prints its own PASS/FAIL lines and finishes with a count; this
 * collects those counts and fails the run if any suite fails or goes missing.
 */
import { build } from 'vite';
import { pathToFileURL } from 'node:url';
import { fork } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT = path.join(HERE, '.build');

const named = process.argv.slice(2);
const suites = (named.length
  ? named
  : fs.readdirSync(HERE)
      .filter(f => f.endsWith('_test.ts'))
      .map(f => f.replace(/_test\.ts$/, ''))
      .sort());

async function bundle(name) {
  await build({
    root: ROOT,
    logLevel: 'error',
    build: {
      ssr: true,
      outDir: OUT,
      emptyOutDir: false,
      rollupOptions: {
        input: path.join(HERE, `${name}_test.ts`),
        output: { entryFileNames: `${name}.mjs` },
      },
    },
  });
  return path.join(OUT, `${name}.mjs`);
}

// Each suite runs in its own process: they drive timers and MIDI-ish state, and
// one leaving an interval behind must not hold up or perturb the next.
function runOne(file) {
  return new Promise(resolve => {
    const child = fork(file, [], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    let out = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { out += d; });
    child.on('exit', () => resolve(out));
  });
}

let totalPass = 0, totalFail = 0;
const broken = [];

for (const name of suites) {
  let output;
  try {
    output = await runOne(await bundle(name));
  } catch (err) {
    console.log(`\n### ${name}\n  could not be built: ${err.message}`);
    broken.push(name);
    continue;
  }
  const line = output.split('\n').reverse().find(l => /^\d+ passed/.test(l.trim()));
  if (!line) {
    console.log(`\n### ${name}\n${output.trim()}`);
    console.log(`  no result — the suite did not finish`);
    broken.push(name);
    continue;
  }
  const [, passed, failed] = line.trim().match(/^(\d+) passed, (\d+) failed/) ?? [];
  totalPass += Number(passed);
  totalFail += Number(failed);
  if (Number(failed) > 0) {
    console.log(`\n### ${name}  ${line.trim()}`);
    for (const l of output.split('\n')) if (l.includes('FAIL')) console.log(l);
    broken.push(name);
  } else {
    console.log(`${name.padEnd(12)} ${line.trim()}`);
  }
}

fs.rmSync(OUT, { recursive: true, force: true });

console.log('\n' + '='.repeat(46));
console.log(`TOTAL: ${totalPass} passed, ${totalFail} failed`);
if (broken.length) {
  console.log('SUITES NEEDING ATTENTION: ' + broken.join(' '));
  process.exit(1);
}
console.log('all green');
