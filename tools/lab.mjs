import * as k from './kit/iso-kit.mjs';

/**
 * The lab bench: the room behind the portfolio. A walnut desk with a slide box, a microscope, a laptop running code,
 * a lamp, a loupe, a dropper bottle and a mug. Built from the anatomy kit's solids and shaded by facing; each material
 * reads its tones from CSS variables so one drawing serves both the day and the lights-out scene.
 */

export const LAB_W = 760;
export const LAB_H = 600;

const WORLD = {
  desk: { x: -200, y: -110, w: 400, d: 220, r: 8 },
};
const DESK_Z = 0;
const DESK_T = 14;

const P = k.fitProjection(
  [...k.boxCorners(WORLD.desk, -78, 0), [-60, -90, 200], [150, -80, 190], [-170, -60, 170]],
  LAB_W,
  LAB_H,
  { pad: 12, azimuth: 40, elevation: 30 },
);

const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const at = (x, y, z) => k.iso([x, y, z], P);
const depth = (x, y, z = 0) => k.depthOf([x, y, z], P);

/** Material groups: each sets the kit's tone variables from the theme's palette. */
const mat = (name, svg, extra = '') =>
  `<g style="--anatomy-shade-0:var(--${name}-0);--anatomy-shade-1:var(--${name}-1);--anatomy-shade-2:var(--${name}-2);--anatomy-shade-3:var(--${name}-3);--anatomy-top:var(--${name}-t);--anatomy-paper:var(--${name}-p);${extra}">${svg}</g>`;

/** An ellipse lying in a vertical plane, for drops and discs on faces. axis 'x': plane x = c; axis 'y': plane y = c. */
function faceDisc(axis, c, u, z, ru, rz, steps = 22) {
  const pts = Array.from({ length: steps }, (_, i) => {
    const a = (i / steps) * Math.PI * 2;
    const du = Math.cos(a) * ru, dz = Math.sin(a) * rz;
    return axis === 'x' ? at(c, u + du, z + dz) : at(u + du, c, z + dz);
  });
  return `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L')}Z`;
}
const faceLine = (axis, c, u0, z0, u1, z1) => (axis === 'x' ? k.segment([c, u0, z0], [c, u1, z1], P) : k.segment([u0, c, z0], [u1, c, z1], P));

/* ---------------------------------------------------------------- desk */
function desk() {
  const out = [`<path class="iso-halo" d="${k.haloOf(WORLD.desk, -78, 78, P)}" style="filter:blur(14px)"/>`];
  const D0 = WORLD.desk;
  /* legs */
  const legs = [[D0.x + 14, D0.y + 14], [D0.x + D0.w - 30, D0.y + 14], [D0.x + 14, D0.y + D0.d - 30], [D0.x + D0.w - 30, D0.y + D0.d - 30]];
  [...legs].sort((a, b) => depth(a[0], a[1]) - depth(b[0], b[1])).forEach(([x, y]) => {
    out.push(S(k.slabOf({ x, y, w: 16, d: 16, r: 2 }, -78, 78 - DESK_T, P, 3, 0.6), { tone: 'mid' }));
  });
  /* apron rail with two drawers on the front long side */
  out.push(S(k.slabOf({ x: D0.x + 8, y: D0.y + 8, w: D0.w - 16, d: D0.d - 16, r: 4 }, -DESK_T - 26, 26, P, 4, 0.6), { tone: 'lo', crease: 'faint' }));
  /* top */
  out.push(S(k.slabOf(D0, -DESK_T, DESK_T, P, 8, 1.4), { tone: 'hi', crease: 'faint' }));
  out.push(L(k.planOutline(k.insetPlan(D0, 6), 0, P), { tone: 'faint' }));
  /* ruler strip with ticks along the front edge, engraved into the top */
  const front = { x: D0.x + 20, y: D0.y + D0.d - 17, w: 220, d: 8, r: 1 };
  out.push(S(k.slabOf(front, 0, 0.7, P, 3), { tone: 'lo', crease: 'none' }));
  const ticks = k.topTicks(front.x + 4, front.x + front.w - 4, 4, 5, front.y + 0.8, 0.7, [2.2, 4], P);
  out.push(L(ticks.minor, { tone: 'lo' }), L(ticks.major, { tone: 'mid' }));
  const screws = k.corners(D0, 11);
  out.push(D(screws.map(([x, y]) => at(x, y, 0)), { size: 0.7, tone: 'mid' }));
  return mat('wood', out.join(''));
}

/* ---------------------------------------------------------------- slide box (left, back) */
const BOX = { x: 2, y: -94, w: 194, d: 50, r: 4 };
const BOX_H = 34;
const SLIDE = { t: 2.2, w: 30, h: 66 };
const SLOTS = 12;
const PITCH = 14.4;
const SLOT0 = BOX.x + 14;
const SLIDE_Y = BOX.y + (BOX.d - SLIDE.w) / 2;
const LIFTED = 6; // the slide drawn lifted out of its slot
const BLOODY = new Set([1, 3, 6, 9]); // the four case slides

function slideBox() {
  const parts = { back: [], slides: [], front: [], lid: [], lifted: [] };
  const wall = 4;
  /* lid standing open behind, its felt lining toward the viewer */
  parts.lid.push(S(k.slabOf({ x: BOX.x, y: BOX.y - 8, w: BOX.w, d: 7, r: 2 }, 0, BOX_H + 62, P, 3, 0.7), { tone: 'mid' }));
  parts.lid.push(S(k.slabOf({ x: BOX.x + 6, y: BOX.y - 1, w: BOX.w - 12, d: 0.8, r: 1 }, 6, BOX_H + 50, P, 3), { tone: 'lo', crease: 'none' }));
  const label = { x: BOX.x + BOX.w / 2 - 40, y: BOX.y - 0.4, w: 80, d: 0.6, r: 1 };
  parts.lid.push(S(k.slabOf(label, BOX_H + 22, 26, P, 3), { tone: 'lo', crease: 'none' }));
  [14, 20, 26, 32].forEach((dz, i) => parts.lid.push(L(faceLine('y', BOX.y - 0.1, label.x + 6, BOX_H + 22 + dz - 6, label.x + label.w - (i === 3 ? 30 : 8), BOX_H + 22 + dz - 6), { tone: 'lo' })));
  /* hinges */
  [BOX.x + 30, BOX.x + BOX.w - 30].forEach((x) => parts.lid.push(S(k.slabOf({ x: x - 7, y: BOX.y - 9, w: 14, d: 4, r: 1 }, BOX_H - 4, 10, P, 2, 0.4), { tone: 'mid' })));
  /* floor and walls */
  parts.back.push(S(k.slabOf(BOX, 0, 6, P, 4, 0.8), { tone: 'mid' }));
  parts.back.push(S(k.slabOf({ x: BOX.x, y: BOX.y, w: BOX.w, d: wall, r: 1 }, 0, BOX_H, P, 2, 0.6), { tone: 'mid' }));
  parts.back.push(S(k.slabOf({ x: BOX.x, y: BOX.y, w: wall, d: BOX.d, r: 1 }, 0, BOX_H, P, 2, 0.6), { tone: 'mid' }));
  parts.front.push(S(k.slabOf({ x: BOX.x + BOX.w - wall, y: BOX.y, w: wall, d: BOX.d, r: 1 }, 0, BOX_H, P, 2, 0.6), { tone: 'mid' }));
  const fr = { x: BOX.x, y: BOX.y + BOX.d - wall, w: BOX.w, d: wall, r: 1 };
  parts.front.push(S(k.slabOf(fr, 0, BOX_H, P, 2, 0.6), { tone: 'mid' }));
  /* brass corner caps and a latch, and numbered slots engraved on the front rail */
  [BOX.x + 6, BOX.x + BOX.w - 6].forEach((x) => parts.front.push(S(k.slabOf({ x: x - 5, y: BOX.y + BOX.d - 3, w: 10, d: 4, r: 1 }, 4, BOX_H - 8, P, 2, 0.4), { tone: 'mid' })));
  const ticks = k.topTicks(SLOT0, SLOT0 + (SLOTS - 1) * PITCH + 4, PITCH, 1, BOX.y + BOX.d - wall + 0.4, BOX_H, [2.4, 2.4], P);
  parts.front.push(L(ticks.major, { tone: 'lo' }));
  /* the slides */
  for (let i = 0; i < SLOTS; i++) {
    const x = SLOT0 + i * PITCH;
    const lifted = i === LIFTED;
    const g = [];
    g.push(S(k.slabOf({ x, y: SLIDE_Y, w: SLIDE.t, d: SLIDE.w, r: 0.6 }, 6, SLIDE.h, P, 2, 0.3), { tone: 'hi', crease: 'none', lit: false }));
    /* frosted label end */
    g.push(S(k.slabOf({ x: x + SLIDE.t, y: SLIDE_Y + 0.4, w: 0.5, d: SLIDE.w - 0.8, r: 0.3 }, 6 + SLIDE.h - 17, 16.4, P, 2), { tone: 'lo', crease: 'none', flat: true }));
    const zc = 6 + SLIDE.h * 0.4;
    const face = x + SLIDE.t + 0.2;
    if (BLOODY.has(i)) g.push(`<path class="blood" d="${faceDisc('x', face, SLIDE_Y + SLIDE.w / 2, zc, 7.4, 8.2)}"/><path class="gloss" d="${faceDisc('x', face + 0.1, SLIDE_Y + SLIDE.w / 2 - 2.3, zc + 2.4, 1.6, 2.6)}"/>`);
    else if (i % 2 === 0) g.push(`<path class="blood faded" d="${faceDisc('x', face, SLIDE_Y + SLIDE.w / 2 + (i % 3) * 2 - 2, zc - 3, 3.2, 3.6)}"/>`);
    (lifted ? parts.lifted : parts.slides).push(`<g${lifted ? ' class="lift"' : ''}>${g.join('')}</g>`);
  }
  return { back: parts.lid.join('') + parts.back.join(''), slides: parts.slides.join(''), lifted: parts.lifted.join(''), front: parts.front.join('') };
}

/* ---------------------------------------------------------------- microscope (right, back) */
function microscope() {
  const cx = -66, cy = -62;
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf({ x: cx - 40, y: cy - 36, w: 80, d: 72, r: 6 }, 0, 4, P)}"/>`);
  out.push(S(k.slabOf({ x: cx - 42, y: cy - 36, w: 84, d: 72, r: 8 }, 0, 9, P, 6, 1.2), { tone: 'hi' }));
  out.push(L(k.planOutline(k.insetPlan({ x: cx - 42, y: cy - 36, w: 84, d: 72, r: 8 }, 5), 9, P), { tone: 'faint' }));
  out.push(D([[cx - 34, cy - 28], [cx + 34, cy - 28], [cx - 34, cy + 28], [cx + 34, cy + 28]].map(([x, y]) => at(x, y, 9)), { size: 0.7, tone: 'mid' }));
  /* column and arm */
  out.push(S(k.cylinder(cx - 24, cy - 6, 8.4, 9, 118, P, 28, 1), { tone: 'hi', crease: 'none' }));
  out.push(L([30, 60, 90].map((z) => k.sideArc(cx - 24, cy - 6, 8.4, z, P, 16)).join(''), { tone: 'faint' }));
  /* stage with a slide clipped on it */
  out.push(S(k.slabOf({ x: cx - 10, y: cy - 28, w: 56, d: 48, r: 4 }, 40, 5, P, 4, 0.6), { tone: 'hi' }));
  out.push(S(k.slabOf({ x: cx + 3, y: cy - 16, w: 30, d: 12, r: 1 }, 45, 1.6, P, 2, 0.3), { tone: 'lo', crease: 'none' }));
  out.push(`<path class="blood" d="${k.onTop(Array.from({ length: 16 }, (_, i) => [cx + 18 + Math.cos((i / 16) * 6.283) * 4.2, cy - 10 + Math.sin((i / 16) * 6.283) * 3.2]), 46.7, P, true)}"/>`);
  /* head: arm out from the column, body tube, turret, three objectives, eyepiece */
  out.push(S(k.slabOf({ x: cx - 30, y: cy - 14, w: 42, d: 16, r: 4 }, 100, 20, P, 4, 0.8), { tone: 'hi' }));
  out.push(S(k.cylinder(cx + 4, cy - 6, 11, 92, 30, P, 30, 1), { tone: 'hi', crease: 'none' }));
  out.push(S(k.cylinder(cx + 4, cy - 6, 13, 82, 10, P, 30, 1), { tone: 'mid' }));
  [[cx - 6, cy + 4], [cx + 14, cy + 4], [cx + 4, cy - 14]].forEach(([x, y], i) => {
    out.push(S(k.cylinder(x, y, 3.6 + i * 0.5, 62 + i * 3, 20 - i * 3, P, 16, 0.4), { tone: 'mid', crease: 'none' }));
    out.push(S(k.cylinder(x, y, 2.4 + i * 0.4, 56 + i * 3, 6, P, 14), { tone: 'hi', crease: 'none' }));
  });
  out.push(S(k.cylinder(cx + 4, cy - 6, 6.4, 120, 38, P, 24, 0.8), { tone: 'hi', crease: 'none' }));
  out.push(L([128, 140].map((z) => k.sideArc(cx + 4, cy - 6, 6.4, z, P, 14)).join(''), { tone: 'lo' }));
  out.push(S(k.cylinder(cx + 4, cy - 6, 8, 158, 6, P, 26, 1), { tone: 'mid' }));
  /* focus knob on the column, mirror below the stage */
  out.push(S(k.cylinder(cx - 24, cy - 6, 11, 70, 8, P, 28, 1), { tone: 'mid' }));
  out.push(L(k.knurl(cx - 24, cy - 6, 11, 70, 78, 40, P), { tone: 'lo' }));
  out.push(S(k.cylinder(cx + 18, cy - 4, 7, 14, 6, P, 24), { tone: 'mid' }));
  return mat('steel', out.join(''));
}

/* ---------------------------------------------------------------- laptop (centre, front) */
function laptop() {
  const o = { x: -132, y: 14, w: 134, d: 92, r: 6 };
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(o, 0, 4, P)}" style="filter:blur(8px)"/>`);
  out.push(S(k.slabOf(o, 0, 5.4, P, 6, 1), { tone: 'hi' }));
  /* keyboard keys */
  const keys = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 12; c++) keys.push(at(o.x + 14 + c * 9.2, o.y + 10 + r * 8.4, 5.4));
  out.push(D(keys, { size: 1.5, tone: 'lo' }));
  out.push(D(keys, { size: 0.5, tone: 'hi' }));
  out.push(S(k.slabOf({ x: o.x + 44, y: o.y + 56, w: 46, d: 26, r: 3 }, 5.4, 0.6, P, 3), { tone: 'faint', crease: 'none' }));
  /* screen, open to 90 degrees at the back edge */
  const sc = { x: o.x + 4, y: o.y + 2, w: o.w - 8, d: 5, r: 1.6 };
  out.push(S(k.slabOf(sc, 5.4, 86, P, 3, 1), { tone: 'hi' }));
  const fy = sc.y + sc.d + 0.2;
  out.push(`<path class="screen" d="M${[[sc.x + 6, 10], [sc.x + sc.w - 6, 10], [sc.x + sc.w - 6, 84], [sc.x + 6, 84]].map(([x, z]) => at(x, fy, z).map((n) => n.toFixed(1)).join(' ')).join(' L')}Z"/>`);
  /* code on the screen: short and long lines, indented like real code */
  const code = [[0, 40], [10, 62], [10, 48], [20, 70], [20, 34], [10, 54], [0, 28], [0, 66], [10, 40], [10, 58], [0, 22]];
  const g = [];
  code.forEach(([ind, len], i) => {
    const z = 76 - i * 5.4;
    g.push(`<path class="code c${i % 4}" d="${faceLine('y', fy + 0.1, sc.x + 12 + ind, z, sc.x + 12 + ind + len, z)}"/>`);
  });
  out.push(`<g>${g.join('')}</g>`);
  out.push(`<path class="blood" d="${faceDisc('y', fy + 0.1, sc.x + sc.w - 18, 24, 5, 6)}"/>`);
  out.push(S(k.slabOf({ x: o.x + o.w / 2 - 6, y: sc.y + 1, w: 12, d: 3, r: 1 }, 5.4 + 86 - 3, 2.6, P, 2), { tone: 'lo', crease: 'none' }));
  return mat('steel', out.join(''));
}

/* ---------------------------------------------------------------- lamp (left, front) */
function lamp() {
  const cx = 172, cy = 86;
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf({ x: cx - 22, y: cy - 22, w: 44, d: 44, r: 20 }, 0, 4, P)}"/>`);
  out.push(S(k.cylinder(cx, cy, 20, 0, 6, P, 32, 1.2), { tone: 'mid' }));
  out.push(S(k.cylinder(cx, cy, 5, 6, 92, P, 20, 0.6), { tone: 'mid', crease: 'none' }));
  out.push(S(k.slabOf({ x: cx - 4, y: cy - 56, w: 8, d: 62, r: 3 }, 94, 6, P, 4, 0.6), { tone: 'mid' }));
  out.push(S(k.cylinder(cx, cy - 52, 6, 94, 10, P, 20), { tone: 'mid' }));
  out.push(S(k.cylinder(cx, cy - 52, 22, 66, 30, P, 34, 1.4), { tone: 'hi', crease: 'none' }));
  out.push(S(k.cylinder(cx, cy - 52, 14, 60, 6, P, 28, 0.8), { tone: 'lit', lit: true, crease: 'none' }));
  out.push(L(k.ring(cx, cy - 52, 22, 96, P, 30), { tone: 'lo' }));
  return mat('brass', out.join(''));
}

/* ---------------------------------------------------------------- small things on the desk */
function loupe() {
  const cx = 86, cy = 78;
  const out = [];
  out.push(S(k.slabOf({ x: cx + 12, y: cy - 3, w: 52, d: 6, r: 2 }, 0, 3.4, P, 4, 0.5), { tone: 'mid' }));
  out.push(S(k.cylinder(cx, cy, 24, 0, 5, P, 34, 1), { tone: 'mid' }));
  out.push(S(k.cylinder(cx, cy, 20, 5, 0.8, P, 34), { tone: 'lo', crease: 'none' }));
  out.push(`<path class="lens" d="${k.ring(cx, cy, 19.4, 5.9, P, 34)}"/>`);
  out.push(L(k.onTop([[cx - 11, cy - 5], [cx - 4, cy - 10]], 5.9, P), { tone: 'faint' }));
  return mat('brass', out.join(''));
}
function dropper() {
  const cx = -172, cy = 70;
  const out = [];
  out.push(S(k.cylinder(cx, cy, 11, 0, 30, P, 28, 1.6), { tone: 'hi', crease: 'none' }));
  out.push(`<path class="liquid" d="${k.ring(cx, cy, 9.4, 18, P, 26)}"/>`);
  out.push(S(k.cylinder(cx, cy, 5.4, 30, 8, P, 20, 0.6), { tone: 'mid' }));
  out.push(S(k.cylinder(cx, cy, 4.2, 38, 14, P, 20, 2), { tone: 'hi', crease: 'none' }));
  out.push(S(k.slabOf({ x: cx - 7, y: cy - 7, w: 14, d: 14, r: 7 }, 14, 0.4, P, 12), { tone: 'lo', crease: 'none', flat: true }));
  return mat('amber', out.join(''));
}
function mug() {
  const cx = 30, cy = 92;
  const out = [];
  out.push(S(k.cylinder(cx, cy, 15, 0, 26, P, 32, 1.4), { tone: 'hi', crease: 'none' }));
  out.push(S(k.slabOf({ x: cx + 13, y: cy - 3, w: 10, d: 6, r: 2 }, 6, 14, P, 3, 0.6), { tone: 'mid' }));
  out.push(`<path class="coffee" d="${k.ring(cx, cy, 12.8, 22.4, P, 26)}"/>`);
  out.push(`<path class="steam s1" d="M${at(cx - 4, cy, 28).map((n) => n.toFixed(1)).join(' ')} q -5 -9 0 -16 t 0 -16"/><path class="steam s2" d="M${at(cx + 3, cy, 28).map((n) => n.toFixed(1)).join(' ')} q 5 -9 0 -16 t 0 -16"/>`);
  return mat('ceramic', out.join(''));
}
function tag() {
  const o = { x: 36, y: 20, w: 54, d: 34, r: 1.5 };
  const out = [];
  out.push(S(k.slabOf(o, 0, 0.9, P, 2), { tone: 'mid', crease: 'none' }));
  out.push(`<path class="blood" d="${k.ring(o.x + 8, o.y + 8, 2.6, 0.95, P, 14)}"/>`);
  [14, 21, 27].forEach((dy, i) => out.push(L(k.lineOnTop([o.x + 8 + (i ? 0 : 7), o.y + dy], [o.x + o.w - 6 - i * 10, o.y + dy], 0.95, P), { tone: 'lo' })));
  out.push(L(k.onTop([[o.x + 8, o.y + 8], [o.x - 14, o.y - 4], [o.x - 30, o.y + 6]], 0.95, P), { tone: 'red' }));
  return mat('paper', out.join(''));
}

/* ---------------------------------------------------------------- assembly */
export function labFigure() {
  const box = slideBox();
  const items = [
    ['mic', depth(-52, -62), microscope()],
    ['lap', depth(-65, 60), laptop()],
    ['lamp', depth(172, 70), lamp()],
    ['loupe', depth(86, 78), loupe()],
    ['drop', depth(-172, 70), dropper()],
    ['mug', depth(30, 92), mug()],
    ['tag', depth(60, 37), tag()],
  ].sort((a, b) => a[1] - b[1]);
  const body = [desk(), mat('wood', box.back), mat('glass', box.slides), mat('glass', box.lifted), mat('wood', box.front), ...items.map((i) => i[2])];
  return { body: body.join(''), P };
}

/* Tone tables for the two scenes. Each material has four facing shades, a top, a flat fill. */
const ramp = (a, b, c, d, t, p) => ({ 0: a, 1: b, 2: c, 3: d, t, p });
const THEMES = {
  day: {
    wood: ramp('#5a341c', '#6e4226', '#82502e', '#98603a', '#aa7249', '#7a4a2b'),
    steel: ramp('#2a2a2e', '#34343a', '#3f3f46', '#4c4c54', '#62626b', '#3a3a40'),
    brass: ramp('#7e5f19', '#98741f', '#b08a28', '#c9a136', '#e0bf55', '#a07e25'),
    glass: ramp('#a9c9cc', '#b8d7d9', '#c9e4e5', '#dbf0ef', '#f2fffe', '#c4e0e1'),
    amber: ramp('#7a3a0c', '#93480f', '#ad5714', '#c96a1c', '#e4883a', '#9b5114'),
    ceramic: ramp('#cfc8bb', '#dbd5c9', '#e7e2d8', '#f2eee6', '#fffdf8', '#e4dfd5'),
    paper: ramp('#c9b88f', '#d7c8a2', '#e4d7b6', '#efe4c8', '#f7efda', '#e2d5b2'),
  },
  night: {
    wood: ramp('#1b0f09', '#22140c', '#2a1a10', '#321f13', '#3a2417', '#26160d'),
    steel: ramp('#0c0c0f', '#101014', '#15151a', '#1b1b21', '#26262e', '#121216'),
    brass: ramp('#2a2008', '#33270a', '#3d2f0c', '#49380f', '#5a4614', '#33270a'),
    glass: ramp('#1d2a33', '#223240', '#273b4a', '#2d4556', '#35546a', '#243643'),
    amber: ramp('#2b1305', '#351808', '#421d0a', '#52260e', '#6a3513', '#3a1a08'),
    ceramic: ramp('#2e2b29', '#363230', '#3f3b38', '#4a4643', '#5a5551', '#3b3735'),
    paper: ramp('#3a3426', '#453e2d', '#514934', '#5e553c', '#6d6347', '#4a4230'),
  },
};
const FLAT = {
  day: { ink: '#1b0409', ink2: '#3a1a20', ink3: '#7a5a4d', faint: '#a58b7a', blood: '#c8001f', bloodHi: '#ff3b57', screen: '#10161c', c0: '#a9e6ff', c1: '#ffc524', c2: '#ff5a4e', c3: '#b79cff', lens: '#cfe9ec', liquid: '#7ad3c6', coffee: '#2a160d', steam: '#1b0409', halo: '#3a1a10', haloOp: '.38' },
  night: { ink: '#a58b82', ink2: '#6f5a54', ink3: '#4a3a36', faint: '#2b201f', blood: '#a9e6ff', bloodHi: '#ffffff', screen: '#06141c', c0: '#a9e6ff', c1: '#ffd36b', c2: '#ff7a72', c3: '#b79cff', lens: '#10242c', liquid: '#a9e6ff', coffee: '#0a0503', steam: '#a58b82', halo: '#000000', haloOp: '.7' },
};

export function labCss() {
  let css = '';
  for (const [theme, mats] of Object.entries(THEMES)) {
    const f = FLAT[theme];
    const vars = Object.entries(mats).flatMap(([name, m]) => [`--${name}-0:${m[0]}`, `--${name}-1:${m[1]}`, `--${name}-2:${m[2]}`, `--${name}-3:${m[3]}`, `--${name}-t:${m.t}`, `--${name}-p:${m.p}`]).join(';');
    css += `.lab-${theme}{${vars};--anatomy-hi:${f.ink};--anatomy-mid:${f.ink2};--anatomy-lo:${f.ink3};--anatomy-faint:${f.faint};--anatomy-lit:${f.ink};--anatomy-halo:${f.halo};--anatomy-halo-opacity:${f.haloOp};--anatomy-dot:${f.ink};--anatomy-red:${f.blood};--anatomy-weight:.7px;--f-blood:${f.blood};--f-gloss:${f.bloodHi};--f-screen:${f.screen};--f-c0:${f.c0};--f-c1:${f.c1};--f-c2:${f.c2};--f-c3:${f.c3};--f-lens:${f.lens};--f-liquid:${f.liquid};--f-coffee:${f.coffee};--f-steam:${f.steam};--f-ink3:${f.ink3}}
`;
  }
  css += `.blood{fill:var(--f-blood)}.blood.faded{opacity:.55}.gloss{fill:var(--f-gloss);opacity:.6}.screen{fill:var(--f-screen)}
.code{fill:none;stroke-width:2.1;stroke-linecap:round;opacity:.92}.code.c0{stroke:var(--f-c0)}.code.c1{stroke:var(--f-c1)}.code.c2{stroke:var(--f-c2)}.code.c3{stroke:var(--f-c3)}
.lens{fill:var(--f-lens);fill-opacity:.55;stroke:var(--f-ink3);stroke-width:.7}.liquid{fill:var(--f-liquid);fill-opacity:.85}.coffee{fill:var(--f-coffee)}.steam{fill:none;stroke:var(--f-steam);stroke-width:1.6;stroke-linecap:round;opacity:0}
.lift{animation:lift 9s cubic-bezier(.45,0,.2,1) infinite}@keyframes lift{0%,10%{transform:translateY(0)}30%,62%{transform:translateY(-44px)}82%,100%{transform:translateY(0)}}
.steam{animation:steam 4.2s ease-in-out infinite}.steam.s2{animation-delay:1.7s}@keyframes steam{0%{opacity:0;transform:translateY(0)}30%{opacity:.55}100%{opacity:0;transform:translateY(-14px)}}
.code{stroke-dasharray:120;stroke-dashoffset:120;animation:type 7s steps(14,end) infinite}
.code.c1{animation-delay:.3s}.code.c2{animation-delay:.7s}.code.c3{animation-delay:1.1s}
@keyframes type{0%{stroke-dashoffset:120}30%,90%{stroke-dashoffset:0}100%{stroke-dashoffset:120}}
@media (prefers-reduced-motion:reduce){.lift,.steam,.code{animation:none!important}.code{stroke-dashoffset:0}.steam{opacity:0}}`;
  return css;
}
export { P as LAB_P };
