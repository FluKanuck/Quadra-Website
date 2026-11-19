// Static site build. No dependencies. Run: node build.mjs
// Reads src/, copies public/, writes dist/.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = dirname(fileURLToPath(import.meta.url));
const src = (...p) => join(root, 'src', ...p);
const read = (...p) => readFileSync(src(...p), 'utf8');
const site = JSON.parse(read('site.json'));
const images = JSON.parse(read('images.json'));
const services = JSON.parse(read('services.json'));
const dist = join(root, 'dist');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const attrs = (str) => Object.fromEntries([...str.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map((m) => [m[1], m[2] ?? true]));

// ---- images -------------------------------------------------------------
// <x-img name="gpr" sizes="100vw" class="..." eager decorative alt="override">
// Emits <picture> with AVIF then WebP, width/height, and lazy loading unless `eager`.
function picture(a) {
  const im = images[a.name];
  if (!im) throw new Error('Unknown image: ' + a.name);
  const alt = a.alt !== undefined && a.alt !== true ? a.alt : (a.decorative || a.alt === true ? '' : im.alt || '');
  const cls = a.class ? ` class="${a.class}"` : '';
  const load = a.eager ? ' fetchpriority="high"' : ' loading="lazy"';
  const sizes = a.sizes || '100vw';
  const set = (ext) => im.widths.map((w) => `/img/${a.name}-${w}.${ext} ${w}w`).join(', ');
  const fallbackW = im.widths.includes(800) ? 800 : im.widths[im.widths.length - 1];
  const hasAvif = existsSync(join(root, 'public/img', `${a.name}-${im.widths[0]}.avif`));
  const img = `<img src="/img/${a.name}-${fallbackW}.webp" srcset="${set('webp')}" sizes="${sizes}" width="${im.w}" height="${im.h}" alt="${esc(alt)}"${load}${cls}>`;
  return `<picture>${hasAvif ? `<source type="image/avif" srcset="${set('avif')}" sizes="${sizes}">` : ''}${img}</picture>`;
}

// ---- generated blocks ---------------------------------------------------
const blocks = {
  'service-cards': () => services.map((s, i) => `
<li><article class="card">
  ${picture({ name: s.image, sizes: '(min-width: 70em) 19rem, (min-width: 36em) 46vw, 94vw', decorative: true })}
  <h3><span class="num" aria-hidden="true">${String(i + 1).padStart(2, '0')} </span><a class="card-link" href="/services/${s.slug}">${s.name}</a></h3>
  <p>${s.short}</p>
</article></li>`).join(''),
  'service-links': () => services.map((s) => `<li><a href="/services/${s.slug}">${s.name}</a></li>`).join(''),
  'service-options': () => services.map((s) => `<option>${s.name}</option>`).join('') + '<option>Something else</option>',
};

// ---- templating ---------------------------------------------------------
function render(html, vars, depth = 0) {
  if (depth > 6) throw new Error('Include depth');
  const all = { ...vars, site };
  html = html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, k) => {
    const v = k.split('.').reduce((o, p) => (o == null ? o : o[p]), all);
    return v == null ? '' : v;
  });
  html = html.replace(/<x-include\s+([^>]*?)\s*\/?>/g, (_, a) => {
    const at = attrs(a);
    return render(read('partials', at.src + '.html'), { ...vars, ...at }, depth + 1);
  });
  html = html.replace(/<x-block\s+name="([\w-]+)"\s*\/?>/g, (_, n) => blocks[n](vars));
  html = html.replace(/<x-img\s+([^>]*?)\s*\/?>/g, (_, a) => picture(attrs(a)));
  return html;
}

function parsePage(text) {
  const m = text.match(/^<!--meta\s*([\s\S]*?)-->\s*/);
  if (!m) throw new Error('Page is missing <!--meta {...} --> block');
  return { meta: JSON.parse(m[1]), body: text.slice(m[0].length) };
}

// ---- assets with content hash (safe to cache for a year) -------------------
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(join(root, 'public'), dist, { recursive: true });
const hashed = {};
for (const f of ['css/site.css', 'js/site.js']) {
  const buf = readFileSync(src(f));
  const h = createHash('sha256').update(buf).digest('hex').slice(0, 10);
  const out = f.replace(/\.(\w+)$/, `.${h}.$1`);
  mkdirSync(join(dist, dirname(out)), { recursive: true });
  writeFileSync(join(dist, out), buf);
  hashed[f] = '/' + out;
}

// ---- pages --------------------------------------------------------------
const layout = read('layout.html');
const pages = [];
function heroPreload(name) {
  const im = images[name];
  const set = im.widths.map((w) => `/img/${name}-${w}.avif ${w}w`).join(', ');
  return `<link rel="preload" as="image" type="image/avif" imagesrcset="${set}" imagesizes="100vw" fetchpriority="high">`;
}
function emit(path, meta, body) {
  const canonical = site.url + path;
  const crumbs = (meta.crumbs || []).concat([[meta.nav || meta.h1 || meta.title, path]]);
  const ld = [];
  if (path !== '/' && !meta.noindex) {
    ld.push({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [['Home', '/'], ...crumbs].map(([name, p], i) => ({ '@type': 'ListItem', position: i + 1, name, item: site.url + p })) });
  }
  if (meta.ld) ld.push(...[].concat(meta.ld));
  const demo = !site.formEndpoint;
  const vars = {
    ...meta, path, canonical,
    fullTitle: esc(meta.fullTitle || `${meta.title} | ${site.name}`),
    description: esc(meta.description || ''),
    css: hashed['css/site.css'], js: hashed['js/site.js'],
    htmlAttrs: ` data-ga4="${site.ga4}" data-ads="${site.ads}"${meta.noTags ? ' data-no-tags' : ''}`,
    formAction: demo ? '#' : site.formEndpoint,
    formDemo: demo ? ' data-demo' : '',
    robots: meta.noindex ? '<meta name="robots" content="noindex">' : '',
    jsonld: ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n'),
    preloadHero: meta.hero && images[meta.hero] ? heroPreload(meta.hero) : '',
    breadcrumb: path === '/' || meta.nocrumb ? '' : `<nav class="breadcrumb wrap" aria-label="Breadcrumbs"><ol><li><a href="/">Home</a></li>${crumbs.map(([n, p], i) => `<li><a href="${p}"${i === crumbs.length - 1 ? ' aria-current="page"' : ''}>${n}</a></li>`).join('')}</ol></nav>`,
    shareImage: site.url + '/img/share.jpg',
  };
  vars.content = render(body, vars);
  let html = render(layout, vars);
  // mark the current page in the primary navigation
  const top = '/' + path.split('/')[1];
  html = html.replace(`<a href="${top}" data-nav>`, `<a href="${top}" aria-current="page">`).replaceAll(' data-nav>', '>');
  const file = join(dist, path === '/' ? 'index.html' : path.slice(1) + '.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
  if (!meta.noindex) pages.push(path);
}

for (const f of readdirSync(src('pages')).filter((f) => f.endsWith('.html'))) {
  const { meta, body } = parsePage(read('pages', f));
  emit(meta.path, meta, body);
}

// one page per service, from services.json + templates/service.html
const svcTpl = read('templates', 'service.html');
services.forEach((s, i) => {
  const next = services[(i + 1) % services.length];
  const meta = {
    title: s.title, description: s.description, h1: s.name, nav: s.name, hero: s.hero || s.image, lead: s.lead, kicker: 'Services',
    crumbs: [['Services', '/services']],
    ld: { '@context': 'https://schema.org', '@type': 'Service', name: s.name, description: s.description, areaServed: { '@type': 'AdministrativeArea', name: 'British Columbia' }, provider: { '@id': site.url + '/#org' } },
    bodyHtml: s.body.map((p) => `<p>${p}</p>`).join('\n'),
    usesHtml: s.uses ? `<h2>Common jobs</h2><ul class="ticks">${s.uses.map((u) => `<li>${u}</li>`).join('')}</ul>` : '',
    equipmentHtml: s.equipment ? `<h2>Equipment we use</h2><ul class="ticks">${s.equipment.map((u) => `<li>${u}</li>`).join('')}</ul><p><a href="/equipment">See our equipment</a></p>` : '',
    noteHtml: s.note ? `<p class="note">${s.note}</p>` : '',
    nextName: next.name, nextSlug: next.slug,
  };
  emit(`/services/${s.slug}`, meta, svcTpl);
});

// ---- sitemap, robots ------------------------------------------------------
writeFileSync(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.sort().map((p) => `  <url><loc>${site.url}${p === '/' ? '/' : p}</loc></url>`).join('\n')}\n</urlset>\n`);
writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`);
console.log(`Built ${pages.length} indexable pages into dist/` + (site.formEndpoint ? '' : '  (forms are in demo mode: set formEndpoint in src/site.json)'));
