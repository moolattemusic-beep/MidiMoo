import re

app_content = open('src/App.tsx').read()
app_content = app_content.replace(
    """onChange={(e: any) => updateParam('chordRegisterStart', parseInt(e.target.value))}""",
    """onChange={(val) => updateParam('chordRegisterStart', val)}"""
)
app_content = app_content.replace(
    """onChange={(e: any) => updateParam('chordInversion', parseInt(e.target.value))}""",
    """onChange={(val) => updateParam('chordInversion', val)}"""
)
open('src/App.tsx', 'w').write(app_content)

mobile_content = open('src/components/MobileView.tsx').read()
mobile_content = mobile_content.replace(
    """onChange={(e: any) => updateParam('chordRegisterStart', parseInt(e.target.value))}""",
    """onChange={(val) => updateParam('chordRegisterStart', val)}"""
)
mobile_content = mobile_content.replace(
    """onChange={(e: any) => updateParam('chordInversion', parseInt(e.target.value))}""",
    """onChange={(val) => updateParam('chordInversion', val)}"""
)
open('src/components/MobileView.tsx', 'w').write(mobile_content)

