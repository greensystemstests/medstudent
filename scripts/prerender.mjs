// Pre-renders every page to its own HTML file after `vite build`, so search engines and AI crawlers
// (most of which don't run JavaScript) get the full text, headings, links and meta tags of each page.
// The browser app then takes over as usual. Also writes sitemap.xml.
import { build } from 'esbuild';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(repo, 'dist');
const temporary = mkdtempSync(join(tmpdir(), 'studybg-prerender-'));
const bundle = join(temporary, 'prerender.cjs');

try {
  await build({
    stdin: {
      contents: `
        import React from 'react';
        import { renderToString } from 'react-dom/server';
        import App from './src/App';
        export { headTags, PAGE_META, canonicalUrl } from './src/data/seo';
        export { VIEW_PATH } from './src/lib/routes';
        const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
        export function render(pathname) {
          globalThis.localStorage = storage;
          globalThis.sessionStorage = storage;
          globalThis.window = {
            location: { pathname, hash: '', search: '', href: 'https://studybg.ac' + pathname, origin: 'https://studybg.ac' },
            matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
            addEventListener() {}, removeEventListener() {},
          };
          return renderToString(React.createElement(App));
        }
      `,
      resolveDir: repo,
      loader: 'tsx',
    },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    define: { 'import.meta.env': '{}' },
    outfile: bundle,
    logLevel: 'warning',
  });
  const ssr = createRequire(import.meta.url)(bundle);

  const template = readFileSync(join(dist, 'index.html'), 'utf8');
  if (!template.includes('<!--seo:start-->') || !template.includes('<div id="root"></div>'))
    throw new Error('dist/index.html is missing the <!--seo:start--> block or the empty #root');

  const page = (view, pathname) => {
    const body = ssr.render(pathname);
    if (!body.includes('id="main-content"')) throw new Error(`Pre-render of ${pathname} has no main content`);
    return template
      .replace(/<!--seo:start-->[\s\S]*?<!--seo:end-->/, ssr.headTags(view))
      .replace('<div id="root"></div>', `<div id="root">${body}</div>`);
  };

  const written = [];
  for (const [view, pathname] of Object.entries(ssr.VIEW_PATH)) {
    const file = pathname === '/' ? join(dist, 'index.html') : join(dist, pathname, 'index.html');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, page(view, pathname));
    written.push(pathname);
  }
  // GitHub Pages serves 404.html (with a 404 status) for any unknown address.
  writeFileSync(join(dist, '404.html'), page('not-found', '/404/'));

  const today = new Date().toISOString().slice(0, 10);
  const urls = Object.keys(ssr.VIEW_PATH)
    .filter((view) => ssr.PAGE_META[view].index)
    .map((view) => `  <url><loc>${ssr.canonicalUrl(view)}</loc><lastmod>${today}</lastmod></url>`);
  writeFileSync(
    join(dist, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
  );
  console.log(`Pre-rendered ${written.length} pages + 404.html; sitemap.xml lists ${urls.length} URLs.`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
