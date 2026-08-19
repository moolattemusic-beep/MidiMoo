import re
content = open('src/lib/OrchidEngine.ts').read()

# Add lastUpdateReason
content = content.replace(
    'public onStateChange?: (state: any) => void;',
    "public onStateChange?: (state: any) => void;\n  public lastUpdateReason: 'inversion' | 'chord' | 'none' = 'none';"
)

# Update Inversion reason
content = content.replace(
    """  public updateInversion(newInv: number) {
    this.params.chordInversion = newInv;
    this.retriggerHeldKeys(true);
  }""",
    """  public updateInversion(newInv: number) {
    this.params.chordInversion = newInv;
    this.lastUpdateReason = 'inversion';
    this.retriggerHeldKeys(true);
  }"""
)

# Update chord reasons in toggleExtension, clearExtensions, updateRegister, manualBaseType
content = re.sub(
    r'(public updateRegister\(newStart: number\) \{\s+this\.params\.chordRegisterStart = newStart;\s+)(this\.retriggerHeldKeys\(true\);\s+\})',
    r"\1this.lastUpdateReason = 'chord';\n    \2",
    content
)

content = re.sub(
    r'(public toggleExtension\(ext: \'m7\' \| \'M7\' \| \'6\' \| \'9\'\) \{\s+this\[\`ext_\$\{ext\}\`\] \= \!this\[\`ext_\$\{ext\}\`\];\s+)(this\.notifyState\(\);\s+\})',
    r"\1this.lastUpdateReason = 'chord';\n    \2",
    content
)

content = re.sub(
    r'(public clearExtensions\(\) \{[\s\S]*?this\.ext_9 = false;\s+)(this\.notifyState\(\);\s+\})',
    r"\1this.lastUpdateReason = 'chord';\n    \2",
    content
)

# emitMpeExpression
new_emit = """  private emitMpeExpression(channel: number, value: number, delayMs: number = 0) {
    if (this.onOutputNote) this.onOutputNote({ pitch: 0, velocity: 0, isOn: false, isExpression: true, expressionValue: value, mpeChannel: channel, delayMs });
  }

  private calculateFinalVelocity(baseVelocity: number, pitch: number, reason: 'inversion' | 'chord' | 'none'): number {
    let vel = baseVelocity;
    
    // Humanize
    if (this.params.velHumanize > 0) {
      vel -= Math.random() * this.params.velHumanize;
    }
    
    // High Register Pad
    if (this.params.velHighRegisterPad > 0) {
      // Map pitch 36 to 96 (C1 to C6) to 0.0 - 1.0 factor
      const factor = Math.max(0, Math.min(1, (pitch - 36) / 60));
      vel -= factor * this.params.velHighRegisterPad;
    }

    // Glide/Chord offsets
    if (reason === 'inversion' && this.params.velGlideInversion > 0) {
      vel -= this.params.velGlideInversion;
    } else if (reason === 'chord' && this.params.velGlideChord > 0) {
      vel -= this.params.velGlideChord;
    }

    return Math.max(1, Math.min(127, Math.round(vel)));
  }

  private emitNoteOn"""

content = content.replace("  private emitNoteOn", new_emit)

open('src/lib/OrchidEngine.ts', 'w').write(content)
