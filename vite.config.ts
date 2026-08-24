import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {createRequire} from 'module';

const {version} = createRequire(import.meta.url)('./package.json');

export default defineConfig(() => {
  return {
    // The version is shown in the footer and stamped on the built app; reading
    // both from package.json keeps them from disagreeing.
    define: {__APP_VERSION__: JSON.stringify(version)},
    // The packaged app loads index.html over file://, where a root-absolute
    // "/assets/…" resolves against the filesystem root rather than the asar,
    // leaving the window blank. Relative paths resolve against the html itself,
    // which works both inside the bundle and on the dev server.
    base: './',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
