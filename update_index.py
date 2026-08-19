import re

content = open('index.html').read()

# Update title
content = re.sub(r'<title>.*?</title>', '<title>MidiMOO</title>', content)
content = re.sub(r'<meta property="og:title" content=".*?" />', '<meta property="og:title" content="MidiMOO" />', content)

# Add manifest link
manifest_tag = '    <link rel="manifest" href="/manifest.json" />\n    <link rel="icon" type="image/svg+xml" href="/icon.svg" />'
if 'manifest.json' not in content:
    content = content.replace('  </head>', manifest_tag + '\n  </head>')

# Add SW registration
sw_script = """    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/sw.js').catch(err => {
            console.log('SW registration failed: ', err);
          });
        });
      }
    </script>"""
if 'sw.js' not in content:
    content = content.replace('  </body>', sw_script + '\n  </body>')

open('index.html', 'w').write(content)
print("index.html updated")
