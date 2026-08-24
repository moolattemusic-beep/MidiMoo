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

**A slider's Tailwind width does not win by itself.** `index.css` styles
`input[type="range"]` with `width: 100%`, and that selector outranks a `w-16`
utility — so a sized slider is only ever as narrow as its row squeezes it. In a
row with space to spare it stretches and pushes everything after it onto a line
of its own. Widths on sliders are marked important (`!w-16`) for this reason.

**The bass meets a pattern one of two ways.** In OWN — the default, and what the
instrument has always done — it sounds by itself at the top of each cycle with
the figure above it. In IN FIGURE it joins the figure as its lowest voice, so a
pattern that never names voice 1 has no bass at all. That is the point of the
setting, not a fault.

**Played voicings are on.** `voicingPlayed` defaults to true: chords are voiced
from the Ripchord library rather than built. A pasted chord is voiced from the
library too, but only by a shape stating exactly the tones it names — otherwise
a pasted `Dbmaj7` arrives as a `Dbmaj9`. A chord the library cannot state falls
back to being built.

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
- The app is unsigned; notarising needs a paid Apple Developer account.
- `vite`, `@vitejs/plugin-react` and `@tailwindcss/vite` sit in `dependencies`
  rather than `devDependencies`, so the build tooling ships inside the app and
  takes it to about 133MB.
- `voicingRange` no longer has a control. It still sets the window the chord
  builder folds into, so it is a constant rather than dead — but nothing can
  change it.
