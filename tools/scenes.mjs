import { C, BODY, TYPEB, KANNADA, HINDI, rng } from './lib.mjs';

/**
 * One small looping scene per featured project, drawn in the dark panel at the top of its card. Each loop runs the
 * project's own idea: a conversation that remembers, a claim traced to its record, memory filling up, a document
 * turning into another language.
 */
const bar = (x, y, w, fill, op = 0.9) => `<rect x="${x}" y="${y}" width="${w}" height="5" rx="2.5" fill="${fill}" opacity="${op}"/>`;
const T = 11;

/** Keyframes that hide an element until `at` percent of the loop, show it until 90, then drop it for the restart. */
const appear = (name, at, from = 'translateY(8px)') => `.${name}{animation:${name} ${T}s infinite}@keyframes ${name}{0%,${at}%{opacity:0;transform:${from}}${at + 4}%,90%{opacity:1;transform:none}96%,100%{opacity:0}}`;

export function scene(d, id, x, y, w, h) {
  const g = [];
  let css = '';
  g.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${C.void}"/>`);
  const clip = d.id('sc');
  d.defs.push(`<clipPath id="${clip}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/></clipPath>`);

  if (id === 'nova-ai') {
    /* a conversation: four messages, then a thread pulled from the first to the last, the one that remembers */
    const rows = [[0, 'l', 150], [1, 'r', 170], [2, 'l', 120], [3, 'r', 150]];
    rows.forEach(([i, side, bw]) => {
      const bx = side === 'l' ? x + 22 : x + w - 22 - bw;
      const by = y + 14 + i * 34;
      const mine = side === 'r';
      css += appear(`m${i}`, 4 + i * 14, side === 'l' ? 'translateX(-14px)' : 'translateX(14px)');
      g.push(`<g class="m${i}"><rect x="${bx}" y="${by}" width="${bw}" height="26" rx="13" fill="${mine ? C.blood : 'none'}" stroke="${mine ? 'none' : C.bone3}" stroke-width="1.6"/>${bar(bx + 14, by + 8, bw - 52, mine ? C.bone : C.bone2)}${bar(bx + 14, by + 8 + 0, 0, C.bone)}</g>`);
    });
    const a = { x: x + 22 + 150, y: y + 27 }, b = { x: x + w - 22 - 150, y: y + 14 + 3 * 34 + 13 };
    css += `.thread{stroke-dasharray:260;animation:thread ${T}s infinite}@keyframes thread{0%,60%{stroke-dashoffset:260;opacity:1}72%,90%{stroke-dashoffset:0;opacity:1}96%,100%{opacity:0;stroke-dashoffset:0}}
.recall{animation:recall ${T}s infinite}@keyframes recall{0%,58%{opacity:0;transform:scale(.4)}64%{opacity:1;transform:scale(1.3)}72%,90%{opacity:1;transform:scale(1)}96%,100%{opacity:0}}.recall{transform-box:fill-box;transform-origin:center}`;
    g.push(`<path class="thread" d="M${a.x + 4} ${a.y} C ${a.x + 70} ${a.y} ${b.x - 70} ${b.y} ${b.x - 4} ${b.y}" fill="none" stroke="${C.luminol}" stroke-width="2.2" stroke-linecap="round"/>`);
    g.push(`<circle class="recall" cx="${a.x + 4}" cy="${a.y}" r="5" fill="${C.luminol}"/><circle class="recall" cx="${b.x - 4}" cy="${b.y}" r="5" fill="${C.luminol}"/>`);
  }

  if (id === 'phire') {
    /* three claims on the left, each traced by a line to the line in a record on the right */
    [0, 1, 2].forEach((i) => {
      const cy = y + 26 + i * 44;
      const at = 6 + i * 22;
      css += appear(`c${i}`, at, 'translateX(-12px)');
      css += `.t${i}{stroke-dasharray:240;animation:t${i} ${T}s infinite}@keyframes t${i}{0%,${at + 6}%{stroke-dashoffset:240;opacity:1}${at + 16}%,90%{stroke-dashoffset:0;opacity:1}96%,100%{opacity:0;stroke-dashoffset:0}}`;
      css += `.h${i}{animation:h${i} ${T}s infinite}@keyframes h${i}{0%,${at + 14}%{stroke-opacity:.0}${at + 18}%,90%{stroke-opacity:1}96%,100%{stroke-opacity:0}}`;
      g.push(`<g class="c${i}"><rect x="${x + 20}" y="${cy - 14}" width="130" height="28" rx="14" fill="none" stroke="${C.bone3}" stroke-width="1.6"/>${bar(x + 34, cy - 7, 82, C.bone2)}${bar(x + 34, cy + 3, 58, C.bone3, 0.7)}</g>`);
      const rx = x + w - 20 - 120, ry = cy - 18;
      g.push(`<rect x="${rx}" y="${ry}" width="120" height="36" rx="3" fill="${C.paper}" opacity=".95"/>${bar(rx + 10, ry + 8, 70, C.ink, 0.5)}${bar(rx + 10, ry + 21, 94, C.ink, 0.5)}<rect class="h${i}" x="${rx - 3}" y="${ry - 3}" width="126" height="42" rx="5" fill="none" stroke="${C.blood}" stroke-width="2.6" stroke-opacity="0"/>`);
      g.push(`<path class="t${i}" d="M${x + 150} ${cy} C ${x + 200} ${cy} ${x + 200} ${cy} ${rx - 6} ${cy}" fill="none" stroke="${C.luminol}" stroke-width="2.2" stroke-linecap="round"/>`);
    });
  }

  if (id === 'nexakernel') {
    /* memory: a wave of allocation moving through a grid, each block taking its turn */
    const cols = 15, rows = 5, cw = 22, gap = 5;
    const ox = x + (w - cols * (cw + gap) + gap) / 2, oy = y + 16;
    const rand = rng(77);
    css += `.blk{animation:blk 7s infinite}@keyframes blk{0%{fill:#241216}8%,48%{fill:var(--on)}60%,100%{fill:#241216}}`;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const on = r % 3 === 0 ? C.blood : r % 3 === 1 ? C.bone2 : C.luminol;
      g.push(`<rect class="blk" x="${ox + c * (cw + gap)}" y="${oy + r * (cw + gap)}" width="${cw}" height="${cw}" rx="3" style="--on:${on};animation-delay:${((c * 0.34 + r * 0.9 + rand() * 0.4) % 7).toFixed(2)}s"/>`);
    }
    css += `.cur{animation:cur 1s steps(1) infinite}@keyframes cur{50%{opacity:0}}`;
    g.push(d.text(TYPEB, 'x86', x + w - 18, y + h - 10, 13, { fill: C.bone3, anchor: 'end' }));
    g.push(`<rect class="cur" x="${x + 20}" y="${y + h - 22}" width="9" height="14" fill="${C.hot}"/>`);
  }

  if (id === 'nyayasetu') {
    /* a document with one risky clause flagged, and the same document read back in three languages */
    const px = x + 24, py = y + 14;
    g.push(`<rect x="${px}" y="${py}" width="150" height="${h - 28}" rx="3" fill="${C.paper}"/>`);
    [0, 1, 2, 3, 4, 5, 6].forEach((i) => g.push(bar(px + 14, py + 14 + i * 15, i % 3 === 2 ? 70 : 120, C.ink, 0.45)));
    css += `.flag{animation:flag ${T}s infinite}@keyframes flag{0%,18%{opacity:0}24%,90%{opacity:1}96%,100%{opacity:0}}
.law{animation:law ${T}s infinite}@keyframes law{0%,40%{opacity:0;transform:translateY(6px)}46%,90%{opacity:1;transform:none}96%,100%{opacity:0}}
.lang0{animation:l0 ${T}s infinite}@keyframes l0{0%,2%{opacity:0}6%,28%{opacity:1}34%,100%{opacity:0}}
.lang1{animation:l1 ${T}s infinite}@keyframes l1{0%,32%{opacity:0}38%,60%{opacity:1}66%,100%{opacity:0}}
.lang2{animation:l2 ${T}s infinite}@keyframes l2{0%,64%{opacity:0}70%,92%{opacity:1}97%,100%{opacity:0}}`;
    g.push(`<rect class="flag" x="${px + 8}" y="${py + 14 + 2 * 15 - 5}" width="134" height="16" rx="3" fill="${C.blood}" fill-opacity=".38"/><rect class="flag" x="${px + 8}" y="${py + 14 + 2 * 15 - 5}" width="134" height="16" rx="3" fill="none" stroke="${C.blood}" stroke-width="2"/>`);
    g.push(`<g class="law">${d.text(BODY(780), 'Section cited', px + 20, py + h - 28 - 10, 12, { fill: C.deep })}</g>`);
    const cx = x + w - 24 - 100, cy = y + h / 2;
    g.push(`<path d="M${px + 160} ${cy} H${cx - 30} m-8 -8 l8 8 l-8 8" fill="none" stroke="${C.bone3}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`);
    g.push(`<rect x="${cx - 16}" y="${cy - 34}" width="132" height="68" rx="10" fill="none" stroke="${C.bone3}" stroke-width="1.8"/>`);
    g.push(`<g class="lang0">${d.text(BODY(760), 'English', cx + 50, cy + 8, 26, { fill: C.bone, anchor: 'middle' })}</g>`);
    g.push(`<g class="lang1">${d.text(KANNADA, 'ಕನ್ನಡ', cx + 50, cy + 10, 30, { fill: C.bone, anchor: 'middle' })}</g>`);
    g.push(`<g class="lang2">${d.text(HINDI, 'हिन्दी', cx + 50, cy + 10, 30, { fill: C.bone, anchor: 'middle' })}</g>`);
  }

  d.css += css;
  return `<g clip-path="url(#${clip})">${g.join('')}</g><rect x="${x + 0.75}" y="${y + 0.75}" width="${w - 1.5}" height="${h - 1.5}" rx="5.5" fill="none" stroke="${C.ink}" stroke-opacity=".6" stroke-width="1.5"/>`;
}
