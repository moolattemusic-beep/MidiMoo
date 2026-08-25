# Playing MidiMOO from your phone

MidiMOO serves its own phone interface. Your Mac is the host — there is no
account, no cloud, nothing to install on the phone and nothing to pay for. The
phone opens a web page that your Mac hands it, and that page plays the
instrument.

## Connecting, once

1. **Open MidiMOO** (v1.0.4 or later). If an older copy is still running, quit
   it first — only one can hold the port.
2. **Click REMOTE** in the top-right of the header, next to the phone icon, and
   switch it on. It is off every time the app starts: the instrument should not
   be listening on the network unless you have asked for it.
3. **Copy the address** it shows — something like `http://192.168.1.42:7331`.
   Click it to copy.
4. **On the iPhone**, on the same Wi-Fi, open Safari and go to that address.
5. **Share → Add to Home Screen.** Launch it from the icon after that and it
   opens full-screen with no browser chrome, like an app.

A green dot next to LINK in the phone's header means it is connected. Amber
means it is still finding the instrument; red means it lost it and is trying
again.

## Making the address stop changing

The address is your Mac's own, and your router may hand it a different one after
a reboot. To pin it, set a **DHCP reservation** for the Mac in your router's
admin page — that keeps the same address without configuring anything on the Mac
itself, which is the part that survives a router restart. Once it is fixed, the
home-screen icon keeps working indefinitely.

## The layout

Hold the phone sideways. It is a control surface, not a copy of the app:

- **PADS / CHORDS** switch one bank of eight for another in the same space —
  your memory pads, or the four base types and four extensions. **ALT** appears
  beside the tabs on the chords bank and swaps the extensions for alterations.
- **The strum pad** runs down the right-hand side, with the pitch bend strip
  beside it.
- **REG** along the bottom is the register slider, with **−** and **+** for
  inversion next to it.
- **MORE** holds everything that is not played: PANIC, the three controller
  sweeps for teaching a plugin CC1, CC74 or CC80, and the phone's own settings.

Whatever you change on the phone changes on the Mac, and the other way round —
pads light in both places, and a chord type set on the Mac shows on the phone.

## Haptics

Tap the **LINK** button on the phone to reach the remote's own settings. What
you actually get depends on the phone, and it is worth knowing which you have:

| Phone | What you feel |
| --- | --- |
| Android | A real, controllable buzz. The browser exposes the vibration motor. |
| iPhone | One system haptic, and only where a control is a native switch or a label pointing at one. Every pad is such a label. |
| Neither | Nothing, unless you turn on **SPEAKER CLICK**. |

On iOS this cannot be fired from code: a switch toggled from script stays
silent, which is why the pads are labels aimed at a hidden switch — the tick
comes from the touch itself. It follows that the strum pad, which is a surface
rather than a control, has no haptic on an iPhone.

**SPEAKER CLICK** is a short low tone instead of a buzz. On an iPhone the
speaker has nothing down at the frequencies you would feel, so it is audible
rather than tactile. It is off unless you ask for it, because it makes a noise.

The two switches in that panel are deliberately the iOS native kind — so those
two, at least, feel like hardware.

## Keeping the screen on

**STAY AWAKE** in the same panel. It uses the browser's wake lock where that
exists, and a silent looping video everywhere else. Over plain `http://` the
real wake lock is not available at all — browsers only offer it over `https` —
so the video is what will be doing the work here. It is re-established whenever
you come back to the app, because iOS drops it every time the app goes to the
background.

## If something is wrong

**The phone says WAITING FOR THE INSTRUMENT.** MidiMOO is closed, or REMOTE is
switched off. The remote only exists while the app is open.

**The page will not load at all.** Three usual causes: the phone is on a
different Wi-Fi network (a guest network counts as different, and many isolate
devices from each other); macOS is blocking incoming connections — System
Settings → Network → Firewall → Options, and allow MidiMOO; or you typed the
address without `:7331`.

**"Port 7331 is already in use."** Another copy of MidiMOO is still running.
Quit it and switch REMOTE on again.

**The interface looks wrong — wrong typefaces.** The phone needs internet for
the fonts, which are still loaded from Google. On a network with no way out it
falls back to system faces. Everything works; it just looks off.

**A note hangs.** It should not: if the phone drops off the network, the Mac
releases whatever it was holding, and there is a heartbeat that notices a
silent phone within five seconds. PANIC is in the phone's header if it ever
does.

## Not built yet

- **A QR code** for the address. You type it once and add it to the home screen,
  so it has not been worth it — but it is easy to add.
- **HTTPS**, which is what the proper wake lock needs. It means generating a
  certificate and trusting it on the phone once.
- **Self-hosted fonts**, so the phone needs no internet at all.
