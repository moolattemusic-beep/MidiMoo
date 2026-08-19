import re
content = open('src/App.tsx').read()

old_overlay = '<div className="fixed bottom-12 right-4 w-72 h-48 bg-[#12120f]/90 backdrop-blur-md border border-white/10 rounded-md overflow-hidden flex flex-col pointer-events-none shadow-2xl z-50">'
new_overlay = '<div className="fixed bottom-16 right-4 w-80 h-56 bg-[#12120f]/90 backdrop-blur-md border border-[var(--accent)] rounded-md overflow-hidden flex flex-col pointer-events-none shadow-2xl z-[9999]">'

if old_overlay in content:
    content = content.replace(old_overlay, new_overlay)
    open('src/App.tsx', 'w').write(content)
    print("Patched z-index and border for monitor")
else:
    print("Failed to patch z-index")
