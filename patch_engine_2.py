import re
content = open('src/lib/OrchidEngine.ts').read()

# Update handleMidi control key logic reason
old_control = """      if (changed) {
        this.notifyState();
        this.retriggerHeldKeys(true);
      }
      return;"""

new_control = """      if (changed) {
        this.lastUpdateReason = 'chord';
        this.notifyState();
        this.retriggerHeldKeys(true);
      }
      return;"""

content = content.replace(old_control, new_control)
open('src/lib/OrchidEngine.ts', 'w').write(content)
