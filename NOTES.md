# Working notes

Things about this codebase that are not obvious from reading it, and that cost
something to find out. Kept here because the commit that fixed a thing explains
that thing, but nobody reads 30 commits to find out why the arpeggio behaves as
it does.

## Running it

- `npm run electron:dev` — Vite plus Electron, hot reload.
- `npm run electron:build` — unsigned `.app`/`.dmg` into `release/`. macOS only,
  no Apple Developer signing, so a copy moved to another Mac needs
  right-click → Open once, or `xattr -cr` after install.
- `npm test` — every suite. `npm test glide moo` — named suites.

## Traps that have already been fallen into

**Timers are the instrument.** Glide steps, strum delays, note releases and the
pattern transport all run on timers, and Chromium throttles timers to about once
a second in a backgrounded window. `backgroundThrottling: false` plus a
`powerSaveBlocker` in `electron/main.cjs` are what stop chords arriving late and
notes hanging while a DAW has focus. Do not remove them.

**A scheduled MIDI message cannot be recalled.** Anything handed to the port
with a future timestamp will fire, whatever happens next. Glide was rewritten
onto cancellable `setTimeout` steps for exactly this reason, and the pattern
transport schedules only ~60ms ahead so a chord change is never more than a tick
of committed notes behind.

**Fold pitches with a pure function.** `foldToRange` is applied to the note on
its way in *and* its way out. If those two ever disagreed the note-off would
address a different pitch than the note-on and the note would hang for good.

**The window must not re-flow.** The layout is designed at 1400x1050 and the
window is locked to that ratio, but locking the shape is not enough on its own:
media queries answer to the real viewport, so a CSS transform still crosses
breakpoints as the window shrinks. The zoom factor is driven from the window
size instead, which divides the viewport and holds it at the design size.

**Verifying the UI from a shell.** `screencapture` returns wallpaper with the
windows stripped out unless Screen Recording is granted. Electron's own
`win.capturePage()` has no such restriction — add a temporary block in
`electron/main.cjs`, measure with `win.webContents.executeJavaScript()`, then
strip the instrumentation before committing.

## Decisions worth knowing

**Colour is separate from the arpeggio.** The strum pad plays the notes the
chord is holding, so turning colour up used to make it run a scale — a major
chord at full colour is seven of the twelve notes. Colour tones are excluded
from the pad; extensions asked for by hand are not.

**Inversion happens after folding, on every path.** Applied to intervals it was
undone immediately by the folding that follows, and it lived in the chord
builder alone, so it did nothing to memory pads or to library voicings. One
helper, called from every route.

**The sustain lift stands aside for glide.** Lifting the pedal on a chord change
stops chords sounding through each other, but with MPE glide the previous chord
*is* what bends into the next one, so releasing it leaves the glide nothing to
move from. Guarded by a test.

**Played voicings are opt-in.** `voicingPlayed` is off by default. Turning it on
changes how every chord in the instrument is voiced, which is the player's call.
A pasted chord is never re-voiced, and a chord the library cannot fully state
falls back to being built.

## Where things came from

- `src/lib/Voicings.ts` — 127 shapes, from 233 Ripchord presets (~6,700 chords,
  97% identified). Real voicings span about two octaves; the built ones span
  seven to fourteen semitones. That gap is the whole point of the file.
- `src/lib/ChordPresets.ts` — 221 progressions, kept as written notes rather
  than chord names, because the voicing is what they are for.
- `src/lib/ChordPatterns.ts` — 44 patterns. The harp ones follow how a harp is
  played: figures in threes and fours (four fingers, no fifth), notes left
  ringing, and no two notes ever struck at the same instant.

## Still open

- The strum pad's INVERSION control had no audible effect on voicings long
  before any of this work; never chased down.
- `chordDensity` and `registerMode` are still in `types.ts` but nothing reads
  them.
- The app is unsigned; notarising needs a paid Apple Developer account.
- `index.html` registers a service worker that cannot work under `file://` and
  logs a caught error on every launch. Harmless, and a leftover from the web
  version.
