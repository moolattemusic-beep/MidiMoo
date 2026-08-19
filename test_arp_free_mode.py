import re
content = open('src/lib/OrchidEngine.ts').read()
# Wait! In free mode, the user also said:
# "When I press the memory pad which is a Custom chord I've inputed, I want this exact set of notes to be considered when I'm using the arpeggio strum pad."
# This is true in ALL modes!
# We just covered that in getArpeggioPitches!
