import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fontkit from 'fontkit';
import wawoff2 from 'wawoff2';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = join(ROOT, 'assets');
mkdirSync(OUT, { recursive: true });

export const DATA = JSON.parse(readFileSync(join(ROOT, 'data/projects.json'), 'utf8'));
export const portrait = readFileSync(join(ROOT, 'assets/portrait.jpg')).toString('base64');

/* Paper, ink and blood. The night scene swaps paper for black and blood for what luminol finds. */
export const C = {
  paper: '#eadfc6', manila: '#ffdba9', ink: '#1b0409', ink2: '#4a2a2e',
  blood: '#e4062a', deep: '#b3001b', arterial: '#7a0b16', hot: '#ff3b57', void: '#07090a', cabinet: '#120709', bone: '#fff1ea',
  bone2: '#ead3ca', bone3: '#b99d95', luminol: '#a9e6ff', sun: '#ffc524',
};

/* Same seed, same splash, so a rebuild never changes the art. */
export const rng = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
export const seedOf = (str) => [...str].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
export const r1 = (n) => Math.round(n * 10) / 10;
export const r2 = (n) => Math.round(n * 100) / 100;

/** Blood spatter: one heavy impact, then droplets thrown outward, the far ones stretched into streaks. */
export function spatter(cx, cy, seed, { n = 90, reach = 340, angle = 0, cone = 2.4, big = 15, fill = C.deep } = {}) {
  const rand = rng(seed);
  const out = [];
  const blob = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2, rr = big * (0.78 + rand() * 0.5);
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
  });
  out.push(`<path d="M${blob.map(([x, y]) => `${r1(x)} ${r1(y)}`).join(' L')}Z" fill="${fill}" stroke="${fill}" stroke-width="4" stroke-linejoin="round"/>`);
  for (let i = 0; i < n; i++) {
    const dist = reach * Math.pow(rand(), 1.5) + big;
    const a = angle + (rand() - 0.5) * cone;
    const x = cx + Math.cos(a) * dist, y = cy + Math.sin(a) * dist;
    const size = Math.max(0.9, (1 - dist / (reach + big)) * 8 * (0.4 + rand()));
    if (dist > reach * 0.35 && rand() > 0.35) {
      out.push(`<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(size * (2 + rand() * 2.4))}" ry="${r1(size * 0.75)}" transform="rotate(${r1((a * 180) / Math.PI)} ${r1(x)} ${r1(y)})" fill="${fill}"/>`);
    } else out.push(`<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(size)}" fill="${fill}"/>`);
  }
  return out.join('');
}

/* fontkit cannot build a variable instance from a WOFF2 wrapper, so each font is unpacked to plain TrueType first. */
export const load = async (name) => fontkit.create(Buffer.from(await wawoff2.decompress(readFileSync(join(ROOT, 'tools/fonts', name)))));
export const fonts = {
  title: await load('climate-crisis-latin-full-normal.woff2'),
  body: await load('atkinson-hyperlegible-next-latin-wght-normal.woff2'),
  type: await load('courier-prime-latin-400-normal.woff2'),
  typeBold: await load('courier-prime-latin-700-normal.woff2'),
  kannada: await load('noto-sans-kannada-kannada-700-normal.woff2'),
  devanagari: await load('noto-sans-devanagari-devanagari-700-normal.woff2'),
};
/** A face is a font plus an optional variable-axis setting: Climate Crisis melts with the year, Atkinson has weight. */
export const face = (font, vary = null) => ({ font, vary, vf: vary ? font.getVariation(vary) : null, key: font.postscriptName + (vary ? JSON.stringify(vary) : '') });
export const TITLE = (year = 1979) => face(fonts.title, { YEAR: year });
export const BODY = (wght = 400) => face(fonts.body, { wght });
export const TYPE = face(fonts.type);
export const TYPEB = face(fonts.typeBold);
export const KANNADA = face(fonts.kannada);
export const HINDI = face(fonts.devanagari);

export const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Text as vector outlines, because an SVG shown through <img> cannot load web fonts. Each glyph is stored once in <defs>
 * and reused, which keeps a page of text to a few kilobytes.
 */
export class Doc {
  constructor(w, h, label) {
    this.w = w; this.h = h; this.label = label;
    this.glyphs = new Map(); this.defs = []; this.body = []; this.css = ''; this.n = 0;
  }
  id(p = 'x') { return `${p}${++this.n}`; }
  adv(f, glyph, pos) { return f.vf ? f.vf.getGlyph(glyph.id).advanceWidth : pos.xAdvance; }
  measure(f, str, size, track = 0) {
    const run = f.font.layout(str);
    const s = size / f.font.unitsPerEm;
    return run.glyphs.reduce((w, g, i) => w + this.adv(f, g, run.positions[i]) * s, 0) + track * Math.max(0, run.glyphs.length - 1);
  }
  text(f, str, x, y, size, { fill = C.ink, anchor = 'start', track = 0, extra = '' } = {}) {
    const run = f.font.layout(str);
    const s = size / f.font.unitsPerEm;
    const width = this.measure(f, str, size, track);
    let cx = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
    const uses = [];
    run.glyphs.forEach((glyph, i) => {
      const pos = run.positions[i];
      const shape = f.vf ? f.vf.getGlyph(glyph.id).path : glyph.path;
      if (shape.commands.length) {
        const key = `${f.key}|${glyph.id}`;
        let gid = this.glyphs.get(key);
        if (!gid) {
          gid = this.id('g');
          this.glyphs.set(key, gid);
          this.defs.push(`<path id="${gid}" d="${shape.transform(1, 0, 0, -1, 0, 0).toSVG()}"/>`);
        }
        uses.push(`<use href="#${gid}" x="${r2((cx + pos.xOffset * s) / s)}" y="${r2((y - pos.yOffset * s) / s)}"/>`);
      }
      cx += this.adv(f, glyph, pos) * s + track;
    });
    return `<g fill="${fill}" transform="scale(${Math.round(s * 1e5) / 1e5})" ${extra}>${uses.join('')}</g>`;
  }
  wrap(f, str, size, maxW) {
    const lines = [];
    let line = '';
    for (const w of str.split(' ')) {
      const next = line ? `${line} ${w}` : w;
      if (this.measure(f, next, size) > maxW && line) { lines.push(line); line = w; } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  }
  add(s) { this.body.push(s); }
  svg() {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.w} ${this.h}" width="${this.w}" height="${this.h}" role="img" aria-label="${esc(this.label)}">
<title>${esc(this.label)}</title>
<defs>${this.defs.join('')}</defs>
<style>${this.css}</style>
${this.body.join('\n')}
</svg>
`;
  }
  write(name, dir = OUT) { const s = this.svg(); mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, name), s); console.log(name.padEnd(26), (s.length / 1024).toFixed(1) + ' KB'); }
}

/* Motion stops under reduced motion and the final frame shows. */
export const still = (sel) => `@media (prefers-reduced-motion: reduce){${sel}{animation:none !important}}`;

/** Torn paper edge, ink roughness and paper grain, shared by every sheet. */
export const paperDefs = (d) => {
  d.defs.push(`<filter id="torn" x="-2%" y="-4%" width="104%" height="108%"><feTurbulence type="fractalNoise" baseFrequency=".03" numOctaves="3" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="7"/></filter>
<filter id="ink" x="-2%" y="-2%" width="104%" height="104%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="2" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.7"/></filter>
<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3" seed="11"/><feColorMatrix values="0 0 0 0 .35  0 0 0 0 .22  0 0 0 0 .1  0 0 0 .22 0"/></filter>
<filter id="soft"><feGaussianBlur stdDeviation="1.4"/></filter>`);
};
export const grain = (w, h) => `<rect width="${w}" height="${h}" filter="url(#grain)" opacity=".55"/>`;

export const dripCss = `.dr{transform-box:fill-box;transform-origin:50% 0;animation:fall 6s cubic-bezier(.6,0,.4,1) infinite}@keyframes fall{0%{transform:scaleY(0)}35%{transform:scaleY(1)}70%{transform:scaleY(1)}100%{transform:scaleY(0)}}`;
export const dripEl = (x, y0, h, delay, dur, fill = C.blood, w = 8) =>
  `<g class="dr" style="animation-delay:${delay}s;animation-duration:${dur}s"><rect x="${x - w / 2}" y="${y0}" width="${w}" height="${h}" fill="${fill}"/><circle cx="${x}" cy="${y0 + h}" r="${w * 1.06}" fill="${fill}"/><ellipse cx="${x - w * 0.3}" cy="${y0 + h - 2}" rx="${w * 0.25}" ry="${w * 0.42}" fill="#fff" opacity=".45"/></g>`;

