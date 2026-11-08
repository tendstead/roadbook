import { shellLanguages } from './shell-i18n.ts';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
export default defineConfig({
  plugins: [
    shellLanguages(),
    sveltekit({ adapter: adapter({ fallback: 'index.html' }) })
  ],
  server: { proxy: { '/api': 'http://127.0.0.1:8082' } }
});
