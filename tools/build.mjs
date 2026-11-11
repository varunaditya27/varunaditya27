import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fontkit from 'fontkit';
import wawoff2 from 'wawoff2';
import * as icons from 'simple-icons';
import * as kit from './kit/iso-kit.mjs';
import { labFigure, labCss } from './lab.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets');
mkdirSync(OUT, { recursive: true });

const DATA = JSON.parse(readFileSync(join(ROOT, 'data/projects.json'), 'utf8'));
const portrait = readFileSync(join(ROOT, 'assets/portrait.jpg')).toString('base64');

/* Paper, ink and blood. The night scene swaps paper for black and blood for what luminol finds. */
const C = {
  paper: '#eadfc6', manila: '#ffdba9', ink: '#1b0409', ink2: '#4a2a2e',
  blood: '#e4062a', deep: '#b3001b', arterial: '#7a0b16', hot: '#ff3b57', void: '#07090a', cabinet: '#120709', bone: '#fff1ea',
  bone2: '#ead3ca', bone3: '#b99d95', luminol: '#a9e6ff', sun: '#ffc524',
};

/* Same seed, same splash, so a rebuild never changes the art. */
const rng = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const seedOf = (str) => [...str].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;

/** Blood spatter: one heavy impact, then droplets thrown outward, the far ones stretched into streaks. */
function spatter(cx, cy, seed, { n = 90, reach = 340, angle = 0, cone = 2.4, big = 15, fill = C.deep } = {}) {
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
const load = async (name) => fontkit.create(Buffer.from(await wawoff2.decompress(readFileSync(join(ROOT, 'tools/fonts', name)))));
const fonts = {
  title: await load('climate-crisis-latin-full-normal.woff2'),
  body: await load('atkinson-hyperlegible-next-latin-wght-normal.woff2'),
  type: await load('courier-prime-latin-400-normal.woff2'),
  typeBold: await load('courier-prime-latin-700-normal.woff2'),
};
/** A face is a font plus an optional variable-axis setting: Climate Crisis melts with the year, Atkinson has weight. */
const face = (font, vary = null) => ({ font, vary, vf: vary ? font.getVariation(vary) : null, key: font.postscriptName + (vary ? JSON.stringify(vary) : '') });
const TITLE = (year = 1979) => face(fonts.title, { YEAR: year });
const BODY = (wght = 400) => face(fonts.body, { wght });
const TYPE = face(fonts.type);
const TYPEB = face(fonts.typeBold);

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Text as vector outlines, because an SVG shown through <img> cannot load web fonts. Each glyph is stored once in <defs>
 * and reused, which keeps a page of text to a few kilobytes.
 */
class Doc {
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
  write(name) { const s = this.svg(); writeFileSync(join(OUT, name), s); console.log(name.padEnd(26), (s.length / 1024).toFixed(1) + ' KB'); }
}

/* Motion stops under reduced motion and the final frame shows. */
const still = (sel) => `@media (prefers-reduced-motion: reduce){${sel}{animation:none !important}}`;

/** Torn paper edge, ink roughness and paper grain, shared by every sheet. */
const paperDefs = (d) => {
  d.defs.push(`<filter id="torn" x="-2%" y="-4%" width="104%" height="108%"><feTurbulence type="fractalNoise" baseFrequency=".03" numOctaves="3" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="7"/></filter>
<filter id="ink" x="-2%" y="-2%" width="104%" height="104%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="2" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.7"/></filter>
<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3" seed="11"/><feColorMatrix values="0 0 0 0 .35  0 0 0 0 .22  0 0 0 0 .1  0 0 0 .22 0"/></filter>
<filter id="soft"><feGaussianBlur stdDeviation="1.4"/></filter>`);
};
const grain = (w, h) => `<rect width="${w}" height="${h}" filter="url(#grain)" opacity=".55"/>`;

const dripCss = `.dr{transform-box:fill-box;transform-origin:50% 0;animation:fall 6s cubic-bezier(.6,0,.4,1) infinite}@keyframes fall{0%{transform:scaleY(0)}35%{transform:scaleY(1)}70%{transform:scaleY(1)}100%{transform:scaleY(0)}}`;
const dripEl = (x, y0, h, delay, dur, fill = C.blood, w = 8) =>
  `<g class="dr" style="animation-delay:${delay}s;animation-duration:${dur}s"><rect x="${x - w / 2}" y="${y0}" width="${w}" height="${h}" fill="${fill}"/><circle cx="${x}" cy="${y0 + h}" r="${w * 1.06}" fill="${fill}"/><ellipse cx="${x - w * 0.3}" cy="${y0 + h - 2}" rx="${w * 0.25}" ry="${w * 0.42}" fill="#fff" opacity=".45"/></g>`;

/* ------------------------------------------------------------------ hero */
function hero() {
  const W = 1000, H = 730;
  const d = new Doc(W, H, 'Varun Aditya, AI engineer and software developer in Bengaluru. A forensic lab bench: a box of blood slides, a microscope, a laptop running code, a lamp. The lights go out and the blood glows.');
  paperDefs(d);
  d.css = `
.night{animation:lights 18s linear infinite}
@keyframes lights{0%,34%{opacity:0}35%{opacity:.4}36%{opacity:0}37%{opacity:.85}38%{opacity:.15}40%,90%{opacity:1}91%{opacity:.3}92%{opacity:1}94%{opacity:.5}96%,100%{opacity:0}}
${dripCss}
.bar{animation:slide 24s linear infinite}@keyframes slide{from{transform:translateX(0)}to{transform:translateX(-420px)}}
.pulse{animation:pulse 3.4s ease-in-out infinite}@keyframes pulse{0%,100%{opacity:.75}50%{opacity:1}}
${still('.night,.dr,.bar,.pulse')}@media (prefers-reduced-motion: reduce){.night{opacity:1}.dr{transform:scaleY(1)}}
${kit.ISO_CSS}${labCss()}`;
  d.defs.push(`<g id="lab">${labFigure().body}</g>`);
  d.defs.push(`<clipPath id="frame"><rect width="${W}" height="${H}" rx="14"/></clipPath>`);

  const S = 0.88;
  const LX = 346, LY = 138;
  const nameSize = (() => { let s = 110; while (d.measure(TITLE(1979), 'VARUN ADITYA', s) > W - 90 && s > 40) s -= 2; return s; })();
  const baseY = 64 + nameSize * 0.78;
  const nameW = d.measure(TITLE(1979), 'VARUN ADITYA', nameSize);

  const scene = (night) => {
    const g = [];
    const ink = night ? C.bone : C.ink;
    const sub = night ? C.bone2 : C.ink2;
    const red = night ? C.luminol : C.deep;
    g.push(`<rect width="${W}" height="${H}" fill="${night ? C.void : C.paper}"/>`);
    if (!night) g.push(grain(W, H));
    /* the splash on the wall behind the bench; at night the same splash is what luminol finds */
    g.push(`<g opacity=".92" ${night ? '' : 'filter="url(#ink)"'}>${spatter(930, 215, 1117, { n: 190, reach: 640, angle: Math.PI * 0.84, cone: 2.1, big: 24, fill: night ? C.luminol : C.arterial })}</g>`);
    if (night) g.push(`<g opacity=".5" filter="url(#soft)">${spatter(930, 215, 1117, { n: 190, reach: 640, angle: Math.PI * 0.84, cone: 2.1, big: 24, fill: C.luminol })}</g>`);
    g.push(`<g transform="translate(${LX} ${LY}) scale(${S})"><g class="iso lab-${night ? 'night' : 'day'}"><use href="#lab"/></g></g>`);
    const f = TITLE(night ? 2034 : 1979);
    g.push(d.text(f, 'VARUN ADITYA', 46, baseY, nameSize, { fill: ink }));
    [[0.06, 52, 0.4, 6.2], [0.2, 86, 2.2, 5.4], [0.34, 44, 1.1, 6.8], [0.47, 70, 3.4, 5.9], [0.61, 38, 0.2, 6.5], [0.78, 64, 4.1, 6], [0.9, 46, 1.9, 7]]
      .forEach(([fr, h, dl, du]) => g.push(dripEl(46 + fr * nameW, baseY + 4, h, dl, du, night ? C.luminol : C.blood, 7)));
    const x0 = 52;
    g.push(d.text(BODY(760), 'AI engineer and software developer', x0, 268, 21, { fill: red }));
    d.wrap(BODY(430), 'I build software for health, law and power grids, and the odd operating system.', 31, 330).forEach((ln, i) => g.push(d.text(BODY(430), ln, x0, 318 + i * 38, 31, { fill: ink })));
    d.wrap(BODY(420), 'Information Science at RV College of Engineering, Bengaluru. Graduating in 2028.', 18, 320).forEach((ln, i) => g.push(d.text(BODY(420), ln, x0, 500 + i * 26, 18, { fill: sub })));
    return g.join('');
  };
  d.add(`<g clip-path="url(#frame)">${scene(false)}<g class="night">${scene(true)}</g>`);
  d.add(`<g transform="translate(180 622) rotate(-7)" filter="url(#ink)" class="pulse"><rect x="-96" y="-27" width="192" height="54" rx="6" fill="none" stroke="${C.deep}" stroke-width="4"/>${d.text(BODY(800), 'Open file', 0, 11, 32, { fill: C.deep, anchor: 'middle', track: 1 })}</g>`);
  d.add(`<g transform="rotate(-1.2 500 700)"><rect x="-20" y="676" width="1040" height="40" fill="${C.sun}"/><rect x="-20" y="676" width="1040" height="4" fill="${C.ink}"/><rect x="-20" y="712" width="1040" height="4" fill="${C.ink}"/><g class="bar">${d.text(TYPEB, 'CRIME SCENE  DO NOT CROSS  '.repeat(12), 0, 702, 17, { fill: C.ink, track: 2 })}</g></g></g>`);
  d.add(`<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="13" fill="none" stroke="${C.ink}" stroke-opacity=".55" stroke-width="2"/>`);
  d.write('hero.svg');
}

/* ------------------------------------------------------------------ divider */
function divider() {
  const d = new Doc(1000, 56, 'Crime scene tape');
  d.css = `.t{animation:tape 26s linear infinite}@keyframes tape{from{transform:translateX(0)}to{transform:translateX(-560px)}}${still('.t')}`;
  d.defs.push(`<clipPath id="c"><rect width="1000" height="56"/></clipPath>`);
  d.add(`<g clip-path="url(#c)"><g transform="rotate(-1.4 500 28)"><rect x="-20" y="10" width="1040" height="36" fill="${C.sun}"/><rect x="-20" y="10" width="1040" height="4" fill="${C.ink}"/><rect x="-20" y="42" width="1040" height="4" fill="${C.ink}"/><g class="t">${d.text(TYPEB, 'CRIME SCENE  DO NOT CROSS  '.repeat(9), 0, 34, 17, { fill: C.ink, track: 2.2 })}</g></g></g>`);
  d.write('divider.svg');
}

/* ------------------------------------------------------------------ section plates: torn paper labels */
function plate(file, num, label, sub, seed) {
  const W = 1000, H = 160;
  const d = new Doc(W, H, `${label}. ${sub}`);
  paperDefs(d);
  d.css = `${dripCss}.st{transform-box:fill-box;transform-origin:center;animation:thump 6s ease-out infinite}@keyframes thump{0%,86%{transform:scale(1)}90%{transform:scale(1.14)}100%{transform:scale(1)}}${still('.dr,.st')}`;
  d.defs.push(`<clipPath id="c"><rect width="${W}" height="${H}" rx="10"/></clipPath>`);
  d.add(`<rect width="${W}" height="${H}" fill="${C.cabinet}"/><g clip-path="url(#c)">`);
  d.add(`<g filter="url(#torn)"><rect x="22" y="22" width="${W - 44}" height="104" fill="${C.paper}"/></g>`);
  d.add(`<g transform="translate(22 22)">${grain(W - 44, 104)}</g>`);
  d.add(`<g opacity=".8" filter="url(#ink)">${spatter(W - 80, 34, seed, { n: 34, reach: 190, angle: Math.PI * 0.9, cone: 1.2, big: 7, fill: C.arterial })}</g>`);
  let size = 66;
  while (d.measure(TITLE(1996), label, size) > 600 && size > 30) size -= 2;
  d.add(d.text(TITLE(1996), label, 112, 88, size, { fill: C.ink }));
  d.add(d.text(BODY(520), sub, 114, 114, 17, { fill: C.ink2 }));
  d.add(`<g class="st" filter="url(#ink)"><circle cx="64" cy="74" r="28" fill="none" stroke="${C.deep}" stroke-width="3.6"/>${d.text(BODY(800), num, 64, 85, 30, { fill: C.deep, anchor: 'middle' })}</g>`);
  const tx = 112 + d.measure(TITLE(1996), label, size) * 0.88;
  d.add(dripEl(Math.min(tx, 880), 124, 24, 0.4, 5.2, C.blood, 6));
  d.add(`</g>`);
  d.write(file);
}

/* ------------------------------------------------------------------ the folder */
function subject() {
  const W = 1000, H = 520;
  const d = new Doc(W, H, 'Subject file. Varun Aditya, living in Bengaluru, studying Information Science and Engineering at RV College of Engineering, Vice President of Coding Club RVCE. At the moment learning event-driven systems and Kubernetes, and preparing for Google Summer of Code 2027.');
  paperDefs(d);
  d.css = `.row{opacity:0;animation:typed .7s ease-out forwards}@keyframes typed{from{opacity:0;transform:translateX(-14px)}to{opacity:1;transform:none}}
.stamp{opacity:0;transform-box:fill-box;transform-origin:center;animation:stamp .5s cubic-bezier(.2,1.6,.4,1) 2.6s forwards}@keyframes stamp{from{opacity:0;transform:scale(2.2) rotate(-18deg)}to{opacity:1;transform:scale(1) rotate(-10deg)}}
.cur{animation:blink 1s steps(1) infinite}@keyframes blink{50%{opacity:0}}
.sway{transform-box:fill-box;transform-origin:50% 0;animation:sway 6s ease-in-out infinite}@keyframes sway{0%,100%{transform:rotate(-.8deg)}50%{transform:rotate(.8deg)}}
${still('.row,.stamp,.cur,.sway')}@media (prefers-reduced-motion: reduce){.row,.stamp{opacity:1}.stamp{transform:rotate(-10deg)}}`;
  d.defs.push(`<clipPath id="c"><rect width="${W}" height="${H}" rx="14"/></clipPath><clipPath id="ph"><rect x="-84" y="-84" width="168" height="168" rx="3"/></clipPath>
<filter id="sh" x="-10%" y="-10%" width="130%" height="130%"><feDropShadow dx="0" dy="9" stdDeviation="10" flood-color="#000" flood-opacity=".55"/></filter>`);
  d.add(`<g clip-path="url(#c)"><rect width="${W}" height="${H}" fill="${C.cabinet}"/>`);
  d.add(`<g filter="url(#sh)"><path d="M36 54 h160 l18 -22 h-178 z" fill="${C.manila}"/><g filter="url(#torn)"><rect x="36" y="54" width="640" height="372" rx="3" fill="${C.manila}"/></g></g>`);
  d.add(`<g transform="translate(36 54)">${grain(640, 372)}</g>`);
  d.add(d.text(BODY(760), 'Subject file', 58, 47, 17, { fill: C.ink2 }));
  const rows = [
    ['Name', 'Varun Aditya'],
    ['Lives in', 'Bengaluru'],
    ['Studying', 'Information Science and Engineering at RV College of Engineering'],
    ['Also', 'Vice President of Coding Club RVCE'],
    ['At the moment', 'Learning event-driven systems and Kubernetes from first principles, and preparing for Google Summer of Code 2027.'],
  ];
  let y = 104, i = 0;
  for (const [k, v] of rows) {
    const lines = d.wrap(BODY(420), v, 19, 420);
    let g = d.text(BODY(780), k, 60, y, 15.5, { fill: C.deep });
    lines.forEach((ln, j) => { g += d.text(BODY(430), ln, 196, y + j * 25, 19, { fill: C.ink }); });
    d.add(`<g class="row" style="animation-delay:${0.3 + i * 0.45}s">${g}<rect x="60" y="${y + (lines.length - 1) * 25 + 13}" width="590" height="1.4" fill="${C.ink}" opacity=".16"/></g>`);
    y += lines.length * 25 + 28; i++;
  }
  d.add(`<g transform="translate(596 108)"><g class="stamp" filter="url(#ink)"><rect x="-86" y="-26" width="172" height="52" rx="5" fill="none" stroke="${C.deep}" stroke-width="4"/>${d.text(BODY(800), 'Case open', 0, 10, 29, { fill: C.deep, anchor: 'middle', track: 1 })}</g></g>`);
  d.add(`<g transform="translate(838 230) rotate(4)" filter="url(#sh)"><g class="sway"><rect x="-100" y="-114" width="200" height="236" fill="${C.paper}"/><g transform="translate(0 -12)"><g clip-path="url(#ph)"><image href="data:image/jpeg;base64,${portrait}" x="-84" y="-84" width="168" height="168" preserveAspectRatio="xMidYMid slice"/></g></g>${d.text(BODY(700), 'Varun', 0, 104, 22, { fill: C.ink, anchor: 'middle' })}<rect x="-36" y="-126" width="72" height="26" fill="${C.sun}" opacity=".92" transform="rotate(-3)"/></g></g>`);
  d.add(`<rect x="36" y="446" width="928" height="50" rx="4" fill="${C.void}"/>`);
  const quote = 'Build systems that reason. Not tools that respond.';
  d.add(d.text(TYPEB, 'Narration', 56, 476, 14, { fill: C.hot }));
  d.add(d.text(TYPE, quote, 170, 478, 21, { fill: C.bone }));
  d.add(`<rect class="cur" x="${170 + d.measure(TYPE, quote, 21) + 6}" y="461" width="11" height="21" fill="${C.hot}"/></g>`);
  d.write('subject.svg');
}

/* ------------------------------------------------------------------ case cards */
const HOOK = {
  'nova-ai': 'A companion that keeps one long conversation going, remembers what matters about you, and runs entirely on your own machine.',
  phire: 'A health assistant that lives on your own machine and traces every claim it makes back to the record behind it.',
  nexakernel: 'An operating system kernel for x86, written from scratch, with a different data structure behind each core subsystem.',
  nyayasetu: 'Photograph a legal document and get it back in plain English, Kannada or Hindi, with risky clauses flagged and the statute cited.',
};
function card(p, index) {
  const W = 480, H = 360;
  const chapter = DATA.chapters[p.chapter] ?? p.chapter;
  const d = new Doc(W, H, `Case file ${index + 1}: ${p.name}. ${HOOK[p.id]}`);
  paperDefs(d);
  d.css = `${dripCss}.pu{animation:pu 3s ease-in-out infinite}@keyframes pu{0%,100%{opacity:.65}50%{opacity:1}}${still('.dr,.pu')}`;
  d.defs.push(`<clipPath id="c"><rect width="${W}" height="${H}" rx="12"/></clipPath>`);
  d.add(`<rect width="${W}" height="${H}" fill="${C.cabinet}"/><g clip-path="url(#c)">`);
  d.add(`<g filter="url(#torn)"><rect x="14" y="14" width="${W - 28}" height="${H - 28}" fill="${C.paper}"/></g>`);
  d.add(`<g transform="translate(14 14)">${grain(W - 28, H - 28)}</g>`);
  d.add(`<g opacity=".92" filter="url(#ink)">${spatter(W - 40, 26, seedOf(p.id), { n: 56, reach: 160, angle: Math.PI * (0.66 + index * 0.04), cone: 1.1, big: 10, fill: C.arterial })}</g>`);
  d.add(d.text(BODY(760), `Case ${String(index + 1).padStart(2, '0')}`, 34, 52, 16, { fill: C.deep }));
  d.add(d.text(BODY(480), `${chapter}, ${p.year}`, 34, 74, 15, { fill: C.ink2 }));
  let size = 52;
  while (d.measure(TITLE(1990), p.name, size) > W - 68 - 40 && size > 22) size -= 2;
  d.add(d.text(TITLE(1990), p.name, 32, 138, size, { fill: C.ink }));
  d.add(d.text(BODY(720), p.kind, 34, 170, 16.5, { fill: C.deep }));
  d.wrap(BODY(440), HOOK[p.id], 17.5, W - 76).forEach((ln, i) => d.add(d.text(BODY(440), ln, 34, 202 + i * 25, 17.5, { fill: C.ink })));
  let x = 34;
  for (const s of p.stack.slice(0, 4)) {
    const w = d.measure(BODY(560), s, 13.5) + 22;
    if (x + w > W - 34) break;
    d.add(`<rect x="${x}" y="${H - 74}" width="${r1(w)}" height="26" rx="2" fill="${C.manila}" stroke="${C.ink}" stroke-opacity=".35" transform="rotate(${index % 2 ? -1 : 1} ${x} ${H - 74})"/>${d.text(BODY(560), s, x + 11, H - 56, 13.5, { fill: C.ink })}`);
    x += w + 8;
  }
  d.add(`<g class="pu">${d.text(BODY(780), 'Open the case file', 34, H - 30, 16, { fill: C.deep })}<path d="M${34 + d.measure(BODY(780), 'Open the case file', 16) + 10} ${H - 36} h20 m-6 -6 l6 6 l-6 6" fill="none" stroke="${C.deep}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></g>`);
  d.add(`</g>`);
  d.write(`case-${p.id}.svg`);
}

/* ------------------------------------------------------------------ the kit: evidence tags on a rail */
const STACKS = [
  ['Languages', [['Python', 'Python'], ['TypeScript', 'Typescript'], ['C', 'C'], ['C++', 'Cplusplus'], ['Kotlin', 'Kotlin'], ['Solidity', 'Solidity'], ['Arduino', 'Arduino']]],
  ['Frameworks', [['Next.js', 'Nextdotjs'], ['React', 'React'], ['Three.js', 'Threedotjs'], ['Tailwind', 'Tailwindcss'], ['FastAPI', 'Fastapi'], ['Flask', 'Flask'], ['NestJS', 'Nestjs'], ['Flutter', 'Flutter']]],
  ['AI and models', [['PyTorch', 'Pytorch'], ['TensorFlow', 'Tensorflow'], ['scikit-learn', 'Scikitlearn'], ['LangChain', 'Langchain'], ['Ollama', 'Ollama'], ['Gemini', 'Googlegemini'], ['Llama', 'Meta'], ['ElevenLabs', 'Elevenlabs']]],
  ['Data and services', [['PostgreSQL', 'Postgresql'], ['SQLite', 'Sqlite'], ['Neo4j', 'Neo4j'], ['Supabase', 'Supabase'], ['Firebase', 'Firebase'], ['Docker', 'Docker'], ['Vercel', 'Vercel'], ['Grafana', 'Grafana']]],
  ['Systems and chains', [['ESP32', 'Espressif'], ['QEMU', 'Qemu'], ['MQTT', 'Mqtt'], ['IPFS', 'Ipfs'], ['Ethereum', 'Ethereum'], ['Cardano', 'Cardano'], ['Telegram', 'Telegram']]],
];
function stack() {
  const T = 104, GAP = 10, ROW = 154, LEFT = 40, TOP = 20;
  const W = 1000, H = TOP + STACKS.length * ROW + 6;
  const d = new Doc(W, H, `Tools used across the projects. ${STACKS.map(([g, items]) => `${g}: ${items.map((i) => i[0]).join(', ')}`).join('. ')}.`);
  paperDefs(d);
  d.css = `.tg{transform-box:fill-box;transform-origin:50% 0;animation:sw 5s ease-in-out infinite}@keyframes sw{0%,100%{transform:rotate(-1.8deg)}50%{transform:rotate(1.8deg)}}${still('.tg')}`;
  d.defs.push(`<clipPath id="c"><rect width="${W}" height="${H}" rx="14"/></clipPath>`);
  d.add(`<g clip-path="url(#c)"><rect width="${W}" height="${H}" fill="${C.cabinet}"/>`);
  STACKS.forEach(([group, items], row) => {
    const y = TOP + row * ROW;
    d.add(d.text(TITLE(1996), group, LEFT, y + 34, 25, { fill: C.bone }));
    d.add(`<rect x="${LEFT}" y="${y + 50}" width="${W - LEFT * 2}" height="5" rx="2.5" fill="${C.bone3}" opacity=".8"/>`);
    items.forEach(([name, key], col) => {
      const icon = icons[`si${key}`];
      if (!icon) throw new Error(`simple-icons has no si${key}`);
      const x = LEFT + 6 + col * (T + GAP);
      const cx = x + T / 2;
      const sc = 36 / 24;
      d.add(`<g class="tg" style="animation-delay:${-((row * 3 + col * 7) % 11) * 0.45}s"><path d="M${cx} ${y + 52} V${y + 62}" stroke="${C.bone3}" stroke-width="1.6"/><g filter="url(#torn)"><path d="M${x + 14} ${y + 62} H${x + T - 14} L${x + T} ${y + 78} V${y + 142} H${x} V${y + 78} Z" fill="${C.manila}"/></g><circle cx="${cx}" cy="${y + 72}" r="3.4" fill="${C.cabinet}"/><path transform="translate(${cx - 18} ${y + 82}) scale(${r2(sc)})" d="${icon.path}" fill="${C.ink}"/>${d.text(BODY(600), name, cx, y + 133, 14, { fill: C.ink, anchor: 'middle' })}</g>`);
    });
  });
  d.add(`</g>`);
  d.write('stack.svg');
}

/* ------------------------------------------------------------------ record */
const RECORD = [
  ['Sep 2024', 'B.E. Information Science and Engineering', 'RV College of Engineering, Bengaluru. CGPA 9.6. Graduating August 2028.'],
  ['Dec 2024', 'Selected into Coding Club RVCE', 'Junior Core Team in 2025.'],
  ['Oct 2025', 'Rewind & Recode 2025', '1st in Karnataka with LearnMate AI, then 3rd in the national finals with EduSynth. D3 Tech Fest, IIIT Bhubaneswar.'],
  ['Apr 2026', 'VISISONICS AI’26', '2nd place with INDRA in a 20-hour build judged by Hitachi India R&D engineers.'],
  ['2026', 'IEEE YESIST12', '6th place in the India preliminary round with NyayaSetu.'],
  ['2026', 'NQComp-2026', 'Presented the AllerSafe paper, IEEE and Scopus indexed. Manipal Institute of Technology, Bengaluru.'],
  ['Aug 2026', '1st India Computer Vision Hackathon', '1st in track and 5th overall. RV College of Engineering.'],
  ['2026–27', 'Vice President, Coding Club RVCE', 'The club’s tenth year.'],
];
function record() {
  const STEP = 88, TOP = 56, LX = 188;
  const W = 1000, H = TOP * 2 + (RECORD.length - 1) * STEP;
  const d = new Doc(W, H, `The record, in date order. ${RECORD.map(([w, t, x]) => `${w}: ${t}. ${x}`).join(' ')}`);
  paperDefs(d);
  const total = (RECORD.length - 1) * STEP;
  d.css = `.line{stroke-dasharray:${total};stroke-dashoffset:${total};animation:draw 3.4s ease-out .2s forwards}@keyframes draw{to{stroke-dashoffset:0}}
.n{opacity:0;animation:on .5s ease-out forwards}@keyframes on{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:none}}
.ping{transform-box:fill-box;transform-origin:center;animation:ping 3s ease-out infinite}@keyframes ping{0%{transform:scale(1);opacity:.7}100%{transform:scale(3);opacity:0}}
${still('.line,.n,.ping')}@media (prefers-reduced-motion: reduce){.line{stroke-dashoffset:0}.n{opacity:1}}`;
  d.defs.push(`<clipPath id="c"><rect width="${W}" height="${H}" rx="14"/></clipPath>`);
  d.add(`<rect width="${W}" height="${H}" fill="${C.cabinet}"/><g clip-path="url(#c)"><g filter="url(#torn)"><rect x="20" y="20" width="${W - 40}" height="${H - 40}" fill="${C.paper}"/></g><g transform="translate(20 20)">${grain(W - 40, H - 40)}</g>`);
  d.add(`<path class="line" d="M${LX} ${TOP} V${TOP + total}" stroke="${C.deep}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`);
  RECORD.forEach(([when, head, body], i) => {
    const y = TOP + i * STEP;
    const hot = i === 2 || i === 3 || i === 6;
    const lines = d.wrap(BODY(430), body, 16.5, 620).slice(0, 2);
    let g = d.text(BODY(760), when, LX - 26, y + 6, 17, { fill: C.deep, anchor: 'end' });
    g += `<circle cx="${LX}" cy="${y}" r="9" fill="${C.paper}" stroke="${C.deep}" stroke-width="3.4"/><circle cx="${LX}" cy="${y}" r="4" fill="${hot ? C.blood : C.deep}"/>`;
    if (hot) g += `<circle class="ping" cx="${LX}" cy="${y}" r="9" fill="none" stroke="${C.blood}" stroke-width="2" style="animation-delay:${i * 0.4}s"/>`;
    g += d.text(BODY(760), head, LX + 30, y + 6, 22, { fill: C.ink });
    lines.forEach((ln, j) => { g += d.text(BODY(430), ln, LX + 30, y + 31 + j * 22, 16.5, { fill: C.ink2 }); });
    d.add(`<g class="n" style="animation-delay:${0.4 + i * 0.4}s">${g}</g>`);
  });
  d.add(`</g>`);
  d.write('record.svg');
}

/* ------------------------------------------------------------------ footer */
function footer() {
  const W = 1000, H = 230;
  const d = new Doc(W, H, 'That is the file. Varun Aditya, Bengaluru.');
  d.css = `${dripCss}.pool{animation:slosh 7s ease-in-out infinite}@keyframes slosh{0%,100%{transform:translateX(0)}50%{transform:translateX(-100px)}}${still('.dr,.pool')}`;
  d.defs.push(`<clipPath id="c"><rect width="${W}" height="${H}" rx="14"/></clipPath>`);
  d.add(`<g clip-path="url(#c)"><rect width="${W}" height="${H}" fill="${C.void}"/>`);
  [[70, 58, 0], [150, 40, 1.8], [850, 62, 0.8], [930, 44, 2.6]].forEach(([x, h, dl]) => d.add(dripEl(x, 0, h, dl, 5.5, C.blood, 8)));
  d.add(d.text(TITLE(2030), 'THAT IS THE FILE', 500, 126, 46, { fill: C.bone, anchor: 'middle' }));
  d.add(d.text(BODY(440), 'Varun Aditya, Bengaluru. Write to me.', 500, 160, 19, { fill: C.bone2, anchor: 'middle' }));
  const wave = (y, step, rise, n) => `M-100 ${y} q ${step / 2} ${-rise} ${step} 0${` t ${step} 0`.repeat(n - 1)} V230 H-100Z`;
  d.add(`<g class="pool"><path d="${wave(196, 100, 22, 13)}" fill="${C.arterial}"/></g><g class="pool" style="animation-direction:reverse;animation-duration:5s"><path d="${wave(208, 80, 16, 16)}" fill="${C.blood}"/></g></g>`);
  d.write('footer.svg');
}

hero();
divider();
plate('plate-subject.svg', '01', 'PERSON OF INTEREST', 'Who is asking, and what is on the table right now', 311);
plate('plate-cases.svg', '02', 'OPEN CASES', `${DATA.projects.length} projects. Four are on the board.`, 421);
plate('plate-record.svg', '03', 'THE PRIORS', 'Results and roles, in date order', 533);
plate('plate-tools.svg', '04', 'THE KIT', 'What the projects are built with', 647);
plate('plate-activity.svg', '05', 'THE HUNT', 'A year of commits, eaten by a snake', 759);
plate('plate-contact.svg', '06', 'LEAVE A MESSAGE', 'One note is enough', 863);
subject();
DATA.selected.forEach((id, i) => card(DATA.projects.find((p) => p.id === id), i));
stack();
record();
footer();
