import re
content = open('src/lib/OrchidEngine.ts').read()

old_key_update = """    if (isOn && velocity > 0 && !isUpdate && !isControlKey) {
       this.lastPerformanceKey = pitch;
    }"""
new_key_update = """    if (isOn && velocity > 0 && !isUpdate && !isControlKey) {
       this.lastPerformanceKey = pitch;
       if (this.params.inversionRepeat > 0) {
         if (pitch === this.lastTriggeredChordKey) {
           this.consecutiveChordCount++;
         } else {
           this.lastTriggeredChordKey = pitch;
           this.consecutiveChordCount = 0;
         }
       } else {
         this.lastTriggeredChordKey = pitch;
         this.consecutiveChordCount = 0;
       }
       if (this.params.strumAlternate) {
         this.alternateStrumState = this.alternateStrumState === 0 ? 1 : 0;
       }
    }"""
content = content.replace(old_key_update, new_key_update)

open('src/lib/OrchidEngine.ts', 'w').write(content)
