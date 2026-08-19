import re
content = open('src/types.ts').read()

old_event = """  isExpression?: boolean;
  expressionValue?: number; // 0 to 127
}"""

new_event = """  isExpression?: boolean;
  expressionValue?: number; // 0 to 127
  isCC?: boolean;
  ccNumber?: number;
  ccValue?: number;
}"""

if old_event in content:
    content = content.replace(old_event, new_event)
    open('src/types.ts', 'w').write(content)
    print("Patched types")
else:
    print("Failed to patch types")
