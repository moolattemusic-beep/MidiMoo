# MidiMOO

Desktop MIDI/chord instrument (Electron + React + Vite + TypeScript). Originally built in Google AI Studio as a web app, now wrapped in Electron for standalone macOS use with real Web MIDI hardware access.

## Scope discipline — the most important rule here

**Fix only what was asked. Do not touch unrelated features.**

When fixing a bug or adding a feature, change only the code required for that specific task. Do not "improve" adjacent code, refactor nearby functions, rename things, reorganize imports, or clean up code you happen to be reading — even if it looks wrong.

If a fix seems to *require* touching another feature, **stop and ask first**. Explain what needs to change, why it's needed for the current task, and wait for approval before proceeding.

**Why:** this app's features are densely interconnected (the engine, MIDI layer, and UI share a lot of state), and it was built through many AI-generated iterations. Unrequested changes risk silently breaking working functionality that is hard to notice until it is used live. Working code stays untouched unless the user asks.

**How to apply:**
- Before editing, ask: "is this file/function actually part of what was requested?" If no, leave it alone.
- Noticed a real problem outside the current scope? Mention it in your response, don't fix it.
- Prefer the smallest change that solves the problem over the "correct" larger refactor.
- Never bundle cleanup with a bug fix.

## Behavioral parity

The Electron version must remain a 1:1 functional copy of the original web app. Do not change app behavior, layout, or feature set as a side effect of desktop packaging work.

## Dev commands

```bash
npm run electron:dev     # Vite + Electron with hot reload and detached DevTools
npm run electron:build   # Package unsigned .app/.dmg into release/
npm run lint             # tsc --noEmit
```

## Layout

- `src/lib/OrchidEngine.ts` — core chord/voicing/arp engine (largest file, most interconnected)
- `src/lib/MidiDeviceManager.ts` — Web MIDI I/O
- `src/lib/SimpleSynth.ts` — internal Web Audio synth
- `src/components/` — UI panels and pads
- `electron/main.cjs` — Electron main process; grants MIDI permission, which Electron denies by default

Root-level `fix_*.py` / `patch_*.py` / `update_*.py` files are leftover one-off scripts from the AI Studio era. They are not part of the app — do not run or modify them.
