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

**A note-off belongs to the last chord holding the note.** Two chords sharing a
tone each sound it, and with MPE off they share a channel — so releasing the
first used to send a note-off that took the note out of the second, which is
what made the memory pads feel monophonic. `releaseNote` asks whether any other
key still sounding holds that same note on that same channel, and leaves the
note-off to whichever lets go last. Counting note-ons instead does not work: the
engine re-states a chord's notes on every retrigger (dragging the register
slider does it dozens of times), so a count runs away and the note never stops.

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

**The remote is a view, not a second instrument.** The engine and Web MIDI live
in the renderer, which is sandboxed and cannot listen on a socket, so main hosts
the server and relays. Nothing about the instrument moved into it: a phone sends
commands and draws the state it is sent. `RemoteEngine` wears the same shape as
`OrchidEngine` so `MobileView` renders unchanged on both.

**A phone that vanishes is owed note-offs.** Wi-Fi dropping does not close a
socket, so silence is what counts as gone — a heartbeat every two seconds, five
seconds of it means the phone is away. `HeldGestures` records what each phone
pressed and says the opposite when it goes. Without that a phone going out of
range mid-chord leaves it sounding for good.

**The socket only reaches a listed command.** `electron/remote-commands.json` is
required by main and imported by the renderer, so the boundary cannot drift. It
is on the local network: anything not on that list is somebody else's idea.

**There is no USB path for a web page.** Safari speaks IP and nothing else, so
the cable is reached the only way it can be: a tethered iPhone with Personal
Hotspot on raises an interface of its own, and the phone talks to the Mac across
it. `remote-addresses.cjs` works out which interface is which from
`networksetup -listallhardwareports` — a USB Ethernet dongle is not a phone,
whatever the word USB suggests — and falls back to Apple's hotspot /28, which
only ever comes from the phone itself.

**The version is on both surfaces on purpose.** A running app keeps its own copy
of the bundle open, so replacing the file on disk changes nothing until it is
restarted — and a phone will happily go on talking to a rebuilt instrument with
a page from the previous run. Both ends carry the build number and the remote
says so when they differ, because nothing else about that failure looks wrong.

**A remote surface must answer to the finger.** Pads used to light from the
snapshot, so a press waited on the round trip and read as lag however fast the
note was. They light locally now and the instrument corrects them a frame or two
later; the guess is dropped once the two agree, or after 700ms if the message
never landed.

**RNDM chooses chords that can hold a note, not chords that state it.** The
generator is ported from moodsoundcollection.com/pages/rndm. A chord qualifies
when the common notes belong to the scale it implies *and* land on a degree the
player allows — which is looser than containing them: D is the eleventh of A9
and simply is not in the chord. About a third of the time the note is not
stated, so ADD COMMON NOTES puts the missing ones an octave above the root, the
way the original does when it writes MIDI. Without that the whole idea is
inaudible.

**The generated chords arrive as symbols.** `smartRename` writes what the common
notes are doing — `Cmin7(b9)`, `CminMaj7` — and `ChordSymbol.ts` reads them, so
a generated pad follows register, inversion and the voicing disk like any pasted
chord rather than being frozen. Three spellings had to be added for it:
`minMaj7`, `alt7`, and chained bare alterations like `min7b5b13`.

**Panic used to eat the MPE channel pool.** It cleared every record of what was
sounding but never told `mpeChannelsAllocated`, so the channels of whatever was
held at the time were stranded. A few panics and all fourteen were gone, every
note fell back to one channel, and expression stayed dead until the app was
restarted — which made panic, the thing you press when a note is stuck, the
thing that broke MPE. Guarded by `mpepool_test`, which walks every route that
takes a channel and asks for the pool back.

**A chord with more notes than the last has a voice with nothing to glide
from.** It happens on about four changes in ten with played voicings, and it is
always exactly one voice — the highest unmatched pitch, since the pairing sorts
both chords and the leftover falls off the end. NEW VOICE decides how it
arrives: ATTACK strikes it, UNISON enters it on the nearest note already
sounding and glides it out so the attack is masked, DROP leaves it out. DROP is
the one to be careful with: the voice is never held, so the next chord has fewer
to glide from and the count cannot climb back until everything is released.

**A glide is a bend on a note RANGE has already folded.** Aiming it at the raw
target bends straight out of the window: the note number went out folded, so
adding the untouched interval carries it past the edge and lands it an octave
from where the same chord sounds when played fresh. Always the same voice, since
the boundary decides which one — which is what made it look like one note
refusing to glide. `emitMpePitchBend` works in sounding pitch now: the note that
actually went out, and the folded target.

**A note-off sends what the note-on sent.** RANGE folds a note on its way out
and the fold answers to a range the player can move, so folding a second time at
note-off could name a pitch nothing is playing: a chord held while the range
moved never stopped. The emitted pitch is remembered instead.

## Still open

- The strum pad's INVERSION control had no audible effect on voicings long
  before any of this work; never chased down.
- The app is unsigned; notarising needs a paid Apple Developer account.
- `vite`, `@vitejs/plugin-react` and `@tailwindcss/vite` sit in `dependencies`
  rather than `devDependencies`, so the build tooling ships inside the app and
  takes it to about 133MB.
- Two memory pads built on the *same root* are still monophonic against each
  other: the engine keys a held chord by its performance key, which for a pad is
  its root pitch, so the second press takes the first one's slot. Pads on
  different roots overlap correctly. Fixing it means giving a held chord an
  identity separate from its root.
- iOS gives a web page one haptic and only on the tap completing, so the remote
  can tick on release but never on press. A native app is the only way to feel
  the moment a pad goes down.
- The remote is served over plain HTTP, so `navigator.wakeLock` is unavailable
  and the screen is held awake with a silent looping video instead. HTTPS with a
  self-signed certificate would fix it properly.
- The phone loads the three typefaces from Google Fonts, so it wants internet
  even though nothing else does.
- `voicingRange` no longer has a control. It still sets the window the chord
  builder folds into, so it is a constant rather than dead — but nothing can
  change it.
