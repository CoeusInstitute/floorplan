// The Coeus Institute appearance: every map carries the house colours, Geist and the corner and type rules,
// and shows the mapped project's own logo when architecture.json names one. A logo is only ever a PNG from
// inside the codebase; anything else is left out and said so, and the Coeus mark is shown instead.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SKILL, shopApp, run, readJson, writeJson, cleanup, lib } from './helpers.mjs';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const logo = (tag) => Buffer.concat([PNG, Buffer.from(`logo-${tag}`)]);
const b64 = (buf) => buf.toString('base64');
const coeusMark = () => b64(fs.readFileSync(path.join(SKILL, 'assets', 'brand', 'logo-dark.png')));

let root, archFile;
const build = (project) => {
  const arch = readJson(archFile);
  for (const k of ['logo', 'logoLight']) delete arch.project[k];
  writeJson(archFile, { ...arch, project: { ...arch.project, ...project } });
  const out = run('build.mjs', root, '--agent', 'none');
  return { out, html: fs.readFileSync(path.join(root, 'floorplan', 'index.html'), 'utf8') };
};
before(() => { root = shopApp(); run('scan.mjs', root); archFile = path.join(root, 'floorplan', 'architecture.json'); });
after(() => cleanup(root));

test('every map carries the house sheet, ahead of the viewer\'s own styles and written to outrank them', () => {
  const { out, html } = build({});
  const sheet = html.indexOf(':root:root {'), viewer = html.indexOf('\n:root {');
  assert.ok(sheet > 0 && sheet < viewer, 'the house sheet comes first');
  assert.match(html, /:root:root \{[^}]*--bg: oklch\(0\.232 0\.004 70\);/, 'graphite page');
  assert.match(html, /:root:root \{[^}]*--on: oklch\(0\.790 0\.105 78\);/, 'brass accent');
  assert.match(html, /:root\[data-theme="light"\]:root \{[^}]*--bg: oklch\(0\.955 0\.006 80\);/, 'and a light appearance');
  assert.match(html, /@font-face\{font-family:"Geist Variable"/);
  assert.match(html, /@font-face\{font-family:"Geist Mono Variable"/);
  assert.match(html, /:root \{[^}]*--bg: #0f0f0f;/, 'the viewer\'s own colours are left in place');
  assert.match(out, /BRAND {2}Coeus Institute appearance/);
});

test('the house sheet gives every colour variable the viewer defines a value in both appearances', () => {
  const { html } = build({});
  const vars = (block) => new Set([...block.matchAll(/(--[\w-]+):/g)].map((m) => m[1]));
  const viewerDark = vars(html.match(/\n:root \{([\s\S]*?)\n\}/)[1]);
  const dark = vars(html.match(/:root:root \{([\s\S]*?)\n\}/)[1]);
  const light = vars(html.match(/:root\[data-theme="light"\]:root \{([\s\S]*?)\n\}/)[1]);
  // sizes and timing the house leaves as they are, and the two tints that follow --ink on their own
  const kept = new Set(['--ease-io', '--panel-w', '--pw', '--gutter', '--hair', '--hair-2']);
  for (const v of viewerDark) assert.ok(dark.has(v) || kept.has(v), `${v} has no house value: add it to assets/brand/coeus.css`);
  const sameInBoth = new Set(['--sans', '--mono', '--r-card', '--r-panel', '--r-ctl', '--ease']);
  for (const v of dark) assert.ok(light.has(v) || sameInBoth.has(v), `${v} has no light house value`);
});

test('without a logo named, the top bar shows the Coeus mark; the export credit keeps Floorplan\'s', () => {
  const { html } = build({});
  assert.ok(html.includes(`--brand-logo: url("data:image/png;base64,${coeusMark()}")`));
  assert.match(html, /\.brand > \.mark\.mark \{ content: var\(--brand-logo\); \}/);
  assert.match(html, /<img class="mark" src="data:image\/png;base64,/, 'Floorplan\'s own logo is still the image the credit copies');
});

test('a logo named in architecture.json is taken from the codebase and inlined', () => {
  fs.writeFileSync(path.join(root, 'shop-web', 'logo.png'), logo('dark'));
  fs.writeFileSync(path.join(root, 'shop-web', 'logo-light.png'), logo('light'));

  const one = build({ logo: 'shop-web/logo.png' });
  assert.ok(one.html.includes(`--brand-logo: url("data:image/png;base64,${b64(logo('dark'))}")`));
  assert.match(one.html, /--brand-logo-light-filter: invert\(1\)/, 'one logo is taken to be light artwork and inverted on light');
  assert.match(one.out, /BRAND .*logo shop-web\/logo\.png, inverted on the light theme/);

  const two = build({ logo: 'shop-web/logo.png', logoLight: 'shop-web/logo-light.png' });
  assert.ok(two.html.includes(`--brand-logo-light: url("data:image/png;base64,${b64(logo('light'))}")`));
  assert.match(two.html, /--brand-logo-light-filter: none/, 'a logo given for light is shown as it is');
  assert.ok(!two.html.includes(coeusMark()));
});

test('a logo from outside the codebase, or one that is not a small PNG, is left out and said so', () => {
  const outside = path.join(path.dirname(root), `outside-${path.basename(root)}.png`);
  fs.writeFileSync(outside, logo('outside'));
  fs.writeFileSync(path.join(root, 'shop-web', 'notes.png'), 'not an image');
  fs.writeFileSync(path.join(root, 'shop-web', 'huge.png'), Buffer.concat([PNG, Buffer.alloc(600 * 1024)]));
  try {
    for (const [file, why] of [[`../${path.basename(outside)}`, 'outside the codebase'], [outside, 'outside the codebase'], ['shop-web/notes.png', 'not a PNG image'], ['shop-web/huge.png', 'larger than 512 KB'], ['shop-web/missing.png', 'no such file'], [42, 'not a file path']]) {
      const { out, html } = build({ logo: file });
      assert.ok(out.includes(`was left out: ${why}`), `${file}: ${why}\n${out}`);
      assert.ok(html.includes(`--brand-logo: url("data:image/png;base64,${coeusMark()}")`), `${file}: the Coeus mark is shown instead`);
      assert.ok(!html.includes(b64(logo('outside'))));
    }
  } finally { fs.rmSync(outside, { force: true }); }
});

test('house type and shape rules are worked out from the viewer\'s own styles', async () => {
  const { houseRules } = await lib('brand.mjs');
  const css = houseRules([`
    /* a comment { font-size: 9px } */
    .small, #a .b { font-size: 10.5px; color: red; }
    .fine { font-size: 12px; }
    .heavy { font-weight: 700; }
    .pill { border-radius: 999px; padding: 2px 8px; }
    .dot { width: 8px; height: 8px; border-radius: 999px; }
    .sheet { border-radius: 28px; }
    .card { border-radius: 14px; }
    .tight { border-radius: 6px; }
    .tab { border-radius: 12px 12px 0 0; }
    :root[data-theme="light"] .lt { font-size: 11px; }
    @media (max-width: 700px) { .phone { font-size: 11px; } }`,
  'const x = `<i style="font-size:9px">`; if (a) { b = "font-size: 9px"; }']);
  const has = (selector, decl) => assert.ok(css.split('\n').some((rule) => rule.endsWith(`{ ${decl}; }`) && rule.slice(0, rule.lastIndexOf(' {')).split(', ').includes(selector)), `${selector} { ${decl} }\n${css}`);
  has(':root .small', 'font-size: 12px'); has(':root #a .b', 'font-size: 12px'); has(':root .phone', 'font-size: 12px');
  has(':root:root[data-theme="light"] .lt', 'font-size: 12px');
  has(':root .heavy', 'font-weight: 600');
  has(':root .pill', 'border-radius: var(--r-ctl)');
  has(':root .sheet', 'border-radius: var(--r-panel)');
  has(':root .card', 'border-radius: var(--r-card)');
  for (const left of ['.fine', '.dot', '.tight', '.tab', 'style=', 'if (a)', 'comment']) assert.ok(!css.includes(left), `${left} is left alone\n${css}`);
});

test('nothing on the built page is left under 12px or pill-shaped that is not a fixed-size dot or switch', () => {
  const { html } = build({});
  const sheet = html.slice(html.indexOf(':root:root {'), html.indexOf('\n:root {'));
  const styles = html.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [, head, body] of styles.matchAll(/([^{};`]+)\{([^{}]*)\}/g)) {
    const size = /(?:^|[;\s])font-size:\s*(\d+(?:\.\d+)?)px/.exec(body);
    const pill = /(?:^|[;\s])border-radius:\s*999px/.test(body) && !(/(?:^|[;\s])width:/.test(body) && /(?:^|[;\s])height:/.test(body));
    if (!(size && +size[1] < 12) && !pill) continue;
    for (const part of head.split(',').map((s) => s.trim()).filter((s) => s && !/^@|[=$()<'"]|^\d/.test(s.replace(/:(?:not|is|where|has|nth-[\w-]+)\([^)]*\)|\[[^\]]*\]/g, '')))) {
      assert.ok(sheet.includes(`:root ${part}`) || sheet.includes(part.replace(/^(:root|html)/, '$1:root')), `no house override for "${part}"`);
    }
  }
});

test('text holds 4.5:1 on what it sits on, in both appearances', () => {
  const css = fs.readFileSync(path.join(SKILL, 'assets', 'brand', 'coeus.css'), 'utf8');
  // relative luminance of an oklch() colour, by way of linear sRGB
  const lum = (L, C, h) => {
    const a = C * Math.cos(h * Math.PI / 180), b = C * Math.sin(h * Math.PI / 180);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
    const [r, g, bl] = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s].map((v) => Math.min(1, Math.max(0, v)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const blocks = { dark: /:root:root \{([\s\S]*?)\n\}/.exec(css)[1], light: /:root\[data-theme="light"\]:root \{([\s\S]*?)\n\}/.exec(css)[1] };
  for (const [name, block] of Object.entries(blocks)) {
    const v = Object.fromEntries([...block.matchAll(/(--[\w-]+): oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/g)].map((m) => [m[1], lum(+m[2], +m[3], +m[4])]));
    for (const [fg, bg] of [['--text', '--surface'], ['--text-2', '--surface'], ['--text-3', '--surface'], ['--text-3', '--raise'], ['--text-3', '--bg'], ['--text-4', '--surface'],
      ['--on-text', '--on'], ['--on-text', '--on-hover'], ['--on-sev-text', '--sev-high'], ['--on-sev-text', '--sev-medium'], ['--on-recent-text', '--recent']]) {
      const [hi, lo] = [v[fg], v[bg]].sort((x, y) => y - x);
      assert.ok((hi + 0.05) / (lo + 0.05) >= 4.5, `${name}: ${fg} on ${bg} is ${((hi + 0.05) / (lo + 0.05)).toFixed(2)}:1`);
    }
  }
});

test('every colour the viewer writes outside its variables has a house replacement', () => {
  const css = fs.readFileSync(path.join(SKILL, 'assets', 'brand', 'coeus.css'), 'utf8');
  const viewer = [fs.readFileSync(path.join(SKILL, 'assets', 'viewer.html'), 'utf8').replace(/\n:root(\[data-theme="light"\])? \{[\s\S]*?\n\}/g, ''),
    ...fs.readdirSync(path.join(SKILL, 'assets', 'ui')).filter((n) => n !== '07-brand.js').map((n) => fs.readFileSync(path.join(SKILL, 'assets', 'ui', n), 'utf8'))].join('\n');
  const fixed = new Set((viewer.match(/#[0-9a-f]{6}\b/gi) || []).map((c) => c.toLowerCase()));
  for (const colour of fixed) assert.ok(css.includes(`[style*="${colour}"]`), `${colour} is written into the viewer and has no house replacement in assets/brand/coeus.css`);
});

test('the tab icon and the logo\'s name are set by the page add-on', () => {
  const { html } = build({});
  assert.match(html, /--brand-favicon: url\("data:image\/png;base64,/);
  assert.match(html, /\/\* ui\/07-brand\.js \*\//);
});
