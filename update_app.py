import re
content = open('src/App.tsx').read()

# Update gaps and padding for more scroll area
content = content.replace(
    '<main className="grid grid-cols-1 xl:grid-cols-[320px_1fr] p-4 lg:p-8 gap-8 min-h-0">',
    '<main className="grid grid-cols-1 xl:grid-cols-[320px_1fr] p-8 lg:p-12 gap-10 lg:gap-8 min-h-0">'
)
content = content.replace(
    '<section className="flex flex-col gap-6">',
    '<section className="flex flex-col gap-10 lg:gap-6">'
)
content = content.replace(
    '<section className="flex flex-col gap-8">',
    '<section className="flex flex-col gap-12 lg:gap-8">'
)
content = content.replace(
    '<div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-8">',
    '<div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-10 lg:gap-8">'
)

# Update params state to use localStorage
params_init = """const [params, setParams] = useState<OrchidParams>(() => {
    const saved = localStorage.getItem('orchid-params');
    if (saved) {
      try {
        return { ...defaultParams, ...JSON.parse(saved) };
      } catch (e) {
        return defaultParams;
      }
    }
    return defaultParams;
  });

  useEffect(() => {
    localStorage.setItem('orchid-params', JSON.stringify(params));
  }, [params]);"""

content = content.replace('const [params, setParams] = useState<OrchidParams>(defaultParams);', params_init)

open('src/App.tsx', 'w').write(content)
