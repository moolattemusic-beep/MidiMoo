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

**SCALE does not use RNDM's parent scales.** They answer a different question —
which notes a chord can *tolerate* — and are deliberately permissive: minor gets
ten notes, dominant eleven of twelve, and several of the exotic types fall
through to a plain major scale. Running a pad over that is a chromatic run, the
same trap colour fell into. `CHORD_SCALES` is an ordinary chord-scale table
keyed by the quality `qualityOf` already reads off the chord. The chord's own
notes are always kept whatever the scale says: a diminished seventh states a
note Locrian does not have.

**A stated alteration silences its natural.** A scale is the safe reading of a
chord; an alteration in the symbol is the player being specific, and the
specific reading wins — C7(b9) offers the flat ninth and not the natural one
beside it. Each pair in `ALTERED_DEGREES` is guarded, because the same interval
means different things in different chords: a minor third is not a sharp ninth,
a flat fifth is not a sharp eleventh, an augmented fifth is not a flat
thirteenth.

**An audition is not a performance.** `startAudition` emits the given pitches
directly rather than going through `handleMidi`, because that is the instrument:
it would apply the register, the inversion, the voicing disk and the played
voicing library on the way through. Every one of those is right when a chord is
played and wrong when it is being examined — the point is to hear the notes that
were chosen, not the instrument's reading of them. RANGE still applies, since
nothing may leave outside it whatever the reason.

**The builder auditions before it commits.** Right click on a ring option plays
what is built so far with that option added; left click takes it. Every option
therefore has to name a chord — a spelling that did not parse would simply be
silent, which is worse than being wrong — so the suite checks the audition
spelling of every option at every stage as well as the ones that get committed.

**The chord builder cannot write a symbol the parser rejects.** That is a
property of its tables rather than a hope about them: `builder_test` assembles
every root against every shape against every tension and every pair of them —
some thousands of symbols — and parses each one. Adding a shape to the tables
without a spelling the parser takes fails the suite rather than the player.

**The symbol reference writes itself.** `chordSymbolReference()` and
`alterationReference()` are built from the parser's own tables and spelled out
on C, so the help beside the text field cannot come to describe something the
parser no longer accepts. A test parses everything the reference offers and
checks it produces what it claims.

**The pad has no root of its own.** It works in pitch classes, and an inverted
voicing does not begin on its root, so `lastArpRoot` is recorded where the chord
is built. Free mode never has one — there the keys are the notes — so SCALE
leaves it on what is actually held rather than inventing a key.

**A stacked walk is the same walk a few tones up.** Not a fixed interval: each
voice sits its own number of *chord tones* above the first, so one can be in
thirds and the next in fifths, and they lead as the chord does rather than
running parallel to it. LOOSENESS puts the upper ones late and softer by a
wandering amount, far enough at the top of the slider to be a roll.

**Bending is a method on the engine, not an event a caller builds.** The strip
used to construct the `onOutputNote` event itself, which worked on the desktop
and did nothing at all from the phone — `onOutputNote` there belongs to the
remote's own mirror and never leaves the device. `sendPitchBend` is a command,
and commands travel.

**OUTPUT VELOCITY is the last word.** Applied in `emitNoteOn` after everything
else has shaped the velocity, so it trims chords, the strum pad, patterns and
auditions alike. It rests at full, and the strip hands it back to full whenever
it is given another job — a trim left somewhere quiet would hold the whole
instrument down with nothing on screen saying so.
SYNC repeats the last move on a clock rather than waiting to be asked, and turns
round at either end of the ladder instead of sitting on the top rung.

**WALK is played on the white keys, and C is the root.** Distances are counted
in white keys rather than in the chord's own tones, because a key that is not a
chord tone would otherwise be worth nothing — on a triad, a second above the
anchor would move nowhere. Counted this way the same stepwise fingering gives an
arpeggio on a triad and a scale with SCALE on, and the hand does not have to
know which. C standing for the root rather than for the note C is what lets a
shape be fingered the same in every key: the chord moves, the fingering does
not. WALK is CLASSIC for everything below the split — `chordMappingMode` keeps
the chord builder from having to know the mapping exists.

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

**The strip is two instruments.** As PITCH it is magnetic — it bends while held
and springs back to centre, because that is what a bend is. As CC1 it is an
ordinary slider that stays where it is put, because that is what expression is.
They rest in different places, so switching moves the strip to the new rest
rather than leaving it somewhere that now means something else.

**A remote surface must answer to the finger.** Pads used to light from the
snapshot, so a press waited on the round trip and read as lag however fast the
note was. They light locally now and the instrument corrects them a frame or two
later; the guess is dropped once the two agree, or after 700ms if the message
never landed.

**A chord is not the notes that start together.** A strummed one is spread over
a moment, so grouping a MIDI file by onset would turn it into six chords of one
note each. `groupIntoChords` starts a new chord where there is a *gap*: notes go
on joining the one being built for as long as each arrives within the window of
the last. The window is on screen at import, because where a chord ends is the
one part of reading a file that involves judgement.

**A name is only offered if it can be read back.** `nameChordFromPitches` tries
every pitch class as the root and looks the intervals up in the same table the
parser reads, then parses its own answer before returning it — a name nothing
can read would land on a pad as an empty chord. Where two roots both fit, the
bass wins.

**A preset is read as itself.** Presets carry a chord symbol as well as their
notes, and reading the symbol would credit them with tensions nobody played —
`getImpliedJazzTones` is deliberately generous, which is what makes RNDM's
selection work and what makes it wrong here. `sharedNotes` reads a pad's voicing
when it has one and falls back to the symbol only when there is nothing else.
Loading a preset or pasting a progression also clears RNDM's required notes:
they describe a set that is no longer on the pads.

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

**Global bypass gates `outputBus()`, not each send method.** Every message the
class emits — notes, CC, MPE expression, pitch bend, panic itself — already
funnelled through that one private method, so a single flag there is a true
bypass rather than a switch each call site has to remember to check. Engaging
it calls `panic()` first and only *then* sets the flag: a note already
sounding downstream needs its note-off, and that has to go out before the gate
closes or it never will. Disengaging resends the MPE bend-range RPN, since the
panic that engaged bypass also sent Reset All Controllers and wiped it — same
reasoning as the existing PANIC button's tail call.

**A fresh callback in a dependency array is an unmount.** The hex board
released every held note about a second into playing it, and the cause was its
own tidy-up: `useEffect(() => () => releaseAll(), [onNote])`, with the remote
passing a new arrow function on every render. Each state push from the
instrument therefore looked like the board being taken away. Cleanups that mean
"on unmount" must have an empty dependency list and reach the current callback
through a ref; the caller was given a stable `useCallback` as well, but the ref
is what makes the component safe whoever passes to it. Measured rather than
guessed, by patching `WebSocket.send` in the page and recording what a held
press actually emitted.

**Timers in a hidden tab are clamped to about a second.** Which looks exactly
like a note-length bug. When measuring anything timed in the browser pane,
check `document.hidden` first — a 250ms `setTimeout` measured 917ms — and prove
timing by recording the delay a component *asks* for rather than the delay it
gets.

**A hex layout is two numbers.** How many semitones you move going one hex
east, and how many going one hex down-left; every other key follows. That is
what isomorphic means in practice — an interval is a direction, so a chord is
the same shape wherever it is played. Coordinates are doubled-width (col
advances by two along a row, odd rows offset by one), which makes the six
neighbours E/W and the four diagonals, and the hexagons pointy-top. The halving
in `hexSteps` is always exact because a hex's row and column share a parity.

**The hex board is an input, not an output.** It calls `handleMidi`, the same
entry point a plugged-in keyboard reaches, which was already in the remote's
command whitelist — so CLASSIC turns a hex into a chord, FREE plays the note,
and WALK, patterns, MPE, RANGE and EXTERNAL SYNTH all apply without knowing it
exists. Nothing about it needed a new command or a new parameter.

**Its settings live on the phone, not in the instrument.** Zoom exists because a
phone and an iPad want different hex sizes, which makes these properties of the
device rather than of the sound — so they are in the remote's own
`localStorage` and deliberately not in a SETUP.

**Touch pointers capture themselves.** A finger landing on an SVG hex gets
implicit pointer capture, so no other hex would ever see it enter and a slide
across the board would sound one note. `releasePointerCapture` on pointerdown is
what makes a glissando work; `touch-action: none` is what stops iOS deciding a
two-finger chord was a pinch and cancelling both notes.

**A setup carries the sound, not the rig.** SETUPS stores every parameter and
all eight pads, and deliberately not the MIDI port selection or which socket
the outboard synth is on. Those describe the room the instrument is standing
in; recalling a setup should never silently repoint your outputs, least of all
on a machine where the ports are different ones. Everything about the external
synth *except* the socket travels, since channel, voice mode and the arp
settings are part of the sound.

**Recall panics first.** Every parameter moves at once — register, range,
voicing — and a chord held across that would be voiced by one setup and
released by another, which is exactly how notes get stranded. With nothing
held, assigning `engine.params` wholesale is the complete update:
`updateRegister` and `updateInversion` only set their parameter and re-voice
what is held, so there is no engine-side state they own separately.

**A setup has to outlive the build that saved it.** `restoreSnapshot` merges
over `defaultParams`, so a setup saved before a parameter existed comes back
holding that parameter's default rather than `undefined`. Without it every
feature added after a setup was saved would quietly break that setup — the
same class of failure as the renamed section that emptied the settings column.

**A muted instrument looks exactly like a working one.** You play, the pads
light, the meters move, and nothing comes out — so BYPASS greys the whole
instrument and frames the window in accent, with a tag saying why. The filter
goes on `.ui-scale-content`, which already carries a `transform` and is
therefore already the containing block for the fixed-position popups inside it;
putting the filter on `<main>` instead would re-anchor every one of them to
main's box. The frame lives outside the filtered element, since a filter cannot
be undone by a descendant, and takes no pointer events so it neither blocks a
control nor disturbs the locked layout. Greyscale keeps luminance, so the
engaged BYPASS button still reads as filled against PANIC's dark.

**Renaming a settings section can empty the whole column.** The top-level list
drills in — the open section hides its siblings — and which one is open is
remembered in `localStorage`. Rename it and the stored title matches nothing,
so every section hides, and the BACK button that would recover it lives inside
the section that never renders. Shipping MODEL D → EXTERNAL SYNTH did exactly
this to anyone who had the section open. Sections now report their own titles
as they mount and `pruneOpenSections` drops a remembered one that nobody
answers to, so the list is self-healing rather than depending on nobody ever
renaming anything.

**EXTERNAL SYNTH has two voice modes and one destination.** MONO runs the
Model D engine — one voice of the chord, cleanly retriggered, optionally
arpeggiated. POLY sends the notes as they are, for a synth with voices of its
own. The mode is read inside the output tap, so its effect has to be in that
effect's dependency list or the closure keeps sending the old way; and changing
it panics the port, because whatever the previous mode was holding has nothing
left able to release it.

**A preset finds its port by name, never by id.** The driver assigns an id per
session, so a stored one finds nothing next time — the same reason the main port
selection has always been saved by name. When the device is absent the preset's
settings still apply and the panel says which port it wanted, because silently
applying half of it looks like it worked.

**MODEL D is a second destination, not a stage in the chain.** It taps the
output stream where the DAW gets it — after RANGE, voicing and velocity — and
sends its one voice to a port of its own, held outside `selectedOutputIds` so
the two never mix. Picking the same port for both is the one way to break it,
which is why the panel says so when it happens.

**Its sustain layer was dropped on purpose.** The Scripter original eats
note-offs while the pedal is down, because in Logic it sits in front of the
keyboard and nothing else is holding those notes. Here the engine has already
applied sustain by the time MODEL D sees anything, so the same logic a second
time would have nothing to eat — the note-offs it is watching for never arrive.
CC 64 is still forwarded, so the synth can do what it likes with the pedal.

**A repeated note used to choke itself.** `killCurrentNote` sent its note-off
twice — once now, once at `gapMs + 2` — as insurance against a mono synth
missing one and staying gated open. The second one lands after the *next*
note-on, which is harmless while the pitch keeps changing and fatal when it
does not: the note plays for two milliseconds. Only the lowest-note bias can
pick the same pitch twice running, which is why it sounded like an occasional
stutter rather than a broken feature. `kill()` now takes the pitch about to
start and skips the trailing off when they match.

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
