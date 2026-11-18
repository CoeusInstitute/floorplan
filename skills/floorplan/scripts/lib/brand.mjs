// The Coeus Institute appearance on every map: the colours and shape in assets/brand/coeus.css, Geist in
// place of the bundled fonts, and a logo in the top bar. The logo is the mapped project's own when
// architecture.json names one (project.logo, a PNG in the codebase; project.logoLight for the light theme),
// and the Coeus mark otherwise. Everything is inlined, so the map stays one self-contained, offline file.
// The viewer and its styles are left as they are: this adds a sheet to the page head that outranks them.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BRAND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'brand');
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_LOGO_BYTES = 512 * 1024; // it is inlined into every copy of the map
const FLOOR_PX = 12; // the house type scale has nothing smaller
// the same subsets and ranges the build uses for its own fonts
const FONT_RANGES = {
  latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  'latin-ext': 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
};
const BASE64 = 'base64'; // encoding only, the way the build inlines its own logo and fonts
const png = (buf) => `url("data:image/png;base64,${buf.toString(BASE64)}")`;
const asset = (name) => fs.readFileSync(path.join(BRAND, name));

/**
 * A logo named in architecture.json, read from the codebase. It has to be a PNG that sits inside the
 * codebase and is small enough to inline; anything else is left out with the reason, never guessed at.
 */
export function projectLogo(root, rel) {
  if (typeof rel !== 'string' || !rel.trim()) return { why: 'not a file path' };
  let base, file;
  try { base = fs.realpathSync(root); file = fs.realpathSync(path.resolve(base, rel)); } catch { return { why: 'no such file' }; }
  // realpath first, so a link that points out of the codebase counts as outside it
  const inside = path.relative(base, file);
  if (!inside || inside.startsWith('..') || path.isAbsolute(inside)) return { why: 'outside the codebase' };
  let buf;
  try { if (!fs.statSync(file).isFile()) return { why: 'not a file' }; buf = fs.readFileSync(file); } catch { return { why: 'could not be read' }; }
  if (!buf.subarray(0, 8).equals(PNG_SIGNATURE)) return { why: 'not a PNG image' };
  if (buf.length > MAX_LOGO_BYTES) return { why: `larger than ${MAX_LOGO_BYTES / 1024} KB` };
  return { buf };
}

/**
 * The house type and shape rules, applied to the viewer's own styles: no text under 12px, no weight over
 * 600, and the house corner scale in place of pills and large radii. The rules to override are found in
 * the viewer's styles at build time, so one added upstream is covered without a list to keep here.
 * A rule that fixes both width and height is a dot, a switch or a round button, and keeps its shape.
 */
export function houseRules(sources) {
  const byDecl = new Map(); // declaration -> the selectors that get it
  for (const src of sources) {
    const css = src.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const [, head, body] of css.matchAll(/([^{};`]+)\{([^{}]*)\}/g)) {
      const decls = [];
      const size = /(?:^|[;\s])font-size:\s*(\d+(?:\.\d+)?)px/.exec(body);
      if (size && +size[1] < FLOOR_PX) decls.push(`font-size: ${FLOOR_PX}px`);
      if (/(?:^|[;\s])font-weight:\s*(?:[7-9]00|bold)/.test(body)) decls.push('font-weight: 600');
      const radius = /(?:^|[;\s])border-radius:\s*(\d+(?:\.\d+)?)px\s*(?:;|$)/.exec(body);
      const fixedSize = /(?:^|[;\s])width:/.test(body) && /(?:^|[;\s])height:/.test(body);
      if (radius && !fixedSize && +radius[1] > 8) decls.push(`border-radius: var(${+radius[1] > 900 ? '--r-ctl' : +radius[1] >= 18 ? '--r-panel' : '--r-card'})`);
      if (!decls.length) continue;
      for (const part of head.split(',').map((s) => s.trim()).filter(Boolean)) {
        // skip what is not a selector (an at-rule, or script around a style block)
        if (/^@|[=$()<'"]|^\d/.test(part.replace(/:(?:not|is|where|has|nth-[\w-]+)\([^)]*\)|\[[^\]]*\]/g, ''))) continue;
        const selector = /^(:root|html)\b/.test(part) ? part.replace(/^(:root|html)/, '$1:root') : `:root ${part}`;
        for (const d of decls) byDecl.set(d, (byDecl.get(d) || new Set()).add(selector));
      }
    }
  }
  return [...byDecl].map(([decl, selectors]) => `${[...selectors].join(', ')} { ${decl}; }`).join('\n');
}

/** The sheet for the page head, and the line the build reports. `viewerStyles`: the viewer page and its add-ons. */
export function brand(root, project = {}, viewerStyles = []) {
  const fonts = [['Geist Variable', 'geist'], ['Geist Mono Variable', 'geist-mono']].flatMap(([family, file]) => Object.entries(FONT_RANGES).map(([subset, range]) =>
    `@font-face{font-family:"${family}";font-style:normal;font-display:swap;font-weight:100 900;unicode-range:${range};src:url(data:font/woff2;base64,${asset(`fonts/${file}-${subset}-wght-normal.woff2`).toString(BASE64)}) format("woff2")}`)).join('\n');

  let dark = asset('logo-dark.png'), light = asset('logo-light.png'), lightFilter = 'none';
  let report = 'BRAND  Coeus Institute appearance · Coeus mark in the top bar (name the project\'s own logo with project.logo in architecture.json)';
  if (project?.logo !== undefined) {
    const own = projectLogo(root, project.logo);
    if (own.buf) {
      dark = own.buf;
      const ownLight = project.logoLight !== undefined ? projectLogo(root, project.logoLight) : null;
      // one logo for both themes is taken to be light artwork on transparency, as the house marks are, and is
      // inverted on the light theme; a logo given for the light theme is shown as it is
      light = ownLight?.buf || own.buf;
      lightFilter = ownLight?.buf ? 'none' : 'invert(1)';
      report = `BRAND  Coeus Institute appearance · logo ${project.logo}`
        + (ownLight?.buf ? `, ${project.logoLight} on the light theme` : ', inverted on the light theme (name a dark version with project.logoLight)')
        + (ownLight?.why ? `\n! project.logoLight "${project.logoLight}" was left out: ${ownLight.why}` : '');
    } else {
      report = `BRAND  Coeus Institute appearance · Coeus mark in the top bar\n! project.logo "${project.logo}" was left out: ${own.why}`;
    }
  }
  const logos = `:root:root { --brand-logo: ${png(dark)}; --brand-logo-light: ${png(light)}; --brand-logo-light-filter: ${lightFilter}; --brand-favicon: ${png(asset('favicon.png'))}; }`;
  return { css: ['', fonts, asset('coeus.css').toString('utf8'), logos, houseRules(viewerStyles)].join('\n'), report };
}
