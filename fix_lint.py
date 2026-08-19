import re
content = open('src/App.tsx').read()

# Fix physicallyHeldNotes order
old_ref = """  const physicallyHeldNotesRef = useRef(physicallyHeldNotes);
  physicallyHeldNotesRef.current = physicallyHeldNotes;"""

content = content.replace(old_ref, "")

new_ref = """  const [physicallyHeldNotes, setPhysicallyHeldNotes] = useState<number[]>([]);
  const physicallyHeldNotesRef = useRef(physicallyHeldNotes);
  physicallyHeldNotesRef.current = physicallyHeldNotes;"""

content = content.replace("  const [physicallyHeldNotes, setPhysicallyHeldNotes] = useState<number[]>([]);", new_ref)

open('src/App.tsx', 'w').write(content)

