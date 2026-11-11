import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { C, ROOT, r1, rng, seedOf, spatter, TITLE, BODY, TYPEB, Doc, paperDefs, grain, dripCss, dripEl, still } from './lib.mjs';

/**
 * The two pictures that change by themselves: the evidence log (the latest public pushes) and the hunt (the whole
 * contribution year laid out as a crime scene). A scheduled workflow runs this and publishes the files to the output
 * branch. Only public data is used: public push events, the commits they point at, and the contribution calendar.
 */
const USER = process.env.GITHUB_REPOSITORY_OWNER || 'varunaditya27';
const token = process.env.GITHUB_TOKEN || execSync('gh auth token', { encoding: 'utf8' }).trim();
const DIST = join(ROOT, 'dist');

const api = async (path, body) => {
  const res = await fetch(`https://api.github.com${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'profile-readme', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const short = (iso) => { const d = new Date(iso); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
const long = (iso) => { const d = new Date(iso); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const now = new Date().toISOString();

/* ---------------------------------------------------------------- data */
const calendar = (await api('/graphql', { query: `query{user(login:"${USER}"){contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{date contributionCount weekday}}}}}}` })).data.user.contributionsCollection.contributionCalendar;
const profile = await api(`/users/${USER}`);
const events = (await api(`/users/${USER}/events/public?per_page=60`)).filter((e) => e.type === 'PushEvent' && e.payload?.head);
const seen = new Set();
const latest = [];
for (const e of events) {
  if (seen.has(e.repo.name)) continue;
  seen.add(e.repo.name);
  try {
    const c = await api(`/repos/${e.repo.name}/commits/${e.payload.head}`);
    latest.push({ repo: e.repo.name.split('/')[1], when: e.created_at, msg: c.commit.message.split('\n')[0] });
  } catch { /* a repo that went private or was deleted since the event */ }
  if (latest.length === 5) break;
}

/* ---------------------------------------------------------------- the log */
function log() {
  const W = 1000, ROW = 62, TOP = 150;
  const H = TOP + Math.max(latest.length, 1) * ROW + 40;
  const d = new Doc(W, H, `Evidence log, ${long(now)}. The latest public pushes: ${latest.map((l) => `${short(l.when)}, ${l.repo}, ${l.msg}`).join('. ')}. ${calendar.totalContributions} contributions in the last year.`);
  paperDefs(d);
  const T = 16;
  const rowCss = latest.map((_, i) => { const a = 6 + i * 9; return `.l${i}{animation:l${i} ${T}s infinite}@keyframes l${i}{0%,${a}%{opacity:0;transform:translateX(-12px)}${a + 4}%,100%{opacity:1;transform:none}}`; }).join('');
  d.css = `${rowCss}.cyc{animation:cyc ${T}s infinite}@keyframes cyc{0%,90%{opacity:1}96%,100%{opacity:0}}.cur{animation:blink 1s steps(1) infinite}@keyframes blink{50%{opacity:0}}${dripCss}${still('.cyc,.cur,.dr,' + latest.map((_, i) => '.l' + i).join(','))}`;
  d.defs.push(`<clipPath id="c"><rect width="${W}" height="${H}" rx="14"/></clipPath>`);
  d.add(`<rect width="${W}" height="${H}" fill="${C.cabinet}"/><g clip-path="url(#c)">`);
  d.add(`<g filter="url(#torn)"><rect x="22" y="22" width="${W - 44}" height="${H - 44}" fill="${C.paper}"/></g><g transform="translate(22 22)">${grain(W - 44, H - 44)}</g>`);
  d.add(`<g opacity=".85" filter="url(#ink)">${spatter(W - 70, 40, seedOf('log'), { n: 40, reach: 200, angle: Math.PI * 0.85, cone: 1.3, big: 9, fill: C.arterial })}</g>`);
  d.add(d.text(TITLE(1996), 'LATEST EVIDENCE', 56, 92, 34, { fill: C.ink }));
  d.add(d.text(BODY(520), `${calendar.totalContributions.toLocaleString('en-US')} contributions in the last year, ${profile.public_repos} public repositories. Logged ${long(now)}.`, 58, 122, 17, { fill: C.ink2 }));
  d.add(`<g class="cyc">`);
  latest.forEach((l, i) => {
    const y = TOP + i * ROW + 22;
    let msg = l.msg;
    while (d.measure(BODY(430), msg, 19) > 590 && msg.length > 8) msg = msg.slice(0, -2);
    if (msg !== l.msg) msg = msg.trimEnd() + '…';
    d.add(`<g class="l${i}">${d.text(BODY(760), short(l.when), 58, y + 4, 17, { fill: C.deep })}${d.text(BODY(780), l.repo, 150, y + 4, 21, { fill: C.ink })}${d.text(BODY(430), msg, 380, y + 4, 19, { fill: C.ink2 })}<rect x="56" y="${y + 24}" width="${W - 112}" height="1.4" fill="${C.ink}" opacity=".16"/></g>`);
  });
  d.add(`</g>`);
  if (!latest.length) d.add(d.text(BODY(430), 'Nothing new in the public record yet.', 58, TOP + 40, 20, { fill: C.ink2 }));
  d.add(`<rect class="cur" x="58" y="${H - 48}" width="10" height="18" fill="${C.deep}"/>`);
  d.add(dripEl(W - 130, H - 44, 14, 0.4, 6, C.blood, 6));
  d.add(`</g>`);
  d.write('log.svg', DIST);
}

/* ---------------------------------------------------------------- the hunt */
function hunt() {
  const days = calendar.weeks.flatMap((w, wi) => w.contributionDays.map((day) => ({ ...day, wi })));
  const counts = days.map((x) => x.contributionCount).filter((n) => n > 0).sort((a, b) => a - b);
  const level = (n) => (n === 0 ? 0 : 1 + [0.25, 0.5, 0.75].filter((q) => n > counts[Math.floor(q * (counts.length - 1))]).length);
  const top = [...days].sort((a, b) => b.contributionCount - a.contributionCount).slice(0, 5);
  const W = 1000, PITCH = 17.2, LEFT = (W - calendar.weeks.length * PITCH) / 2 + PITCH / 2, GY = 118, H = 380;
  const d = new Doc(W, H, `The hunt. A year of contributions as a crime scene: ${calendar.totalContributions} in all. The five biggest days: ${top.map((t, i) => `${i + 1}, ${long(t.date)}, ${t.contributionCount}`).join('; ')}.`);
  paperDefs(d);
  const T = 16, SWEEP = 11;
  d.css = `.glow{animation:glow ${T}s infinite}@keyframes glow{0%{fill:#7a0b16;transform:scale(1)}1.5%{fill:${C.luminol};transform:scale(1.45)}7%,9%{fill:${C.luminol};transform:scale(1.2)}16%,100%{fill:#7a0b16;transform:scale(1)}}.glow{transform-box:fill-box;transform-origin:center}
.beam{animation:beam ${T}s infinite}@keyframes beam{0%{transform:translateX(0);opacity:0}2%{opacity:1}${(SWEEP / T) * 100}%{transform:translateX(${calendar.weeks.length * PITCH}px);opacity:1}${(SWEEP / T) * 100 + 3}%,100%{transform:translateX(${calendar.weeks.length * PITCH}px);opacity:0}}
.mk{animation:mk ${T}s infinite}@keyframes mk{0%,2%{opacity:.35}5%,60%{opacity:1}90%,100%{opacity:.35}}${dripCss}${still('.glow,.beam,.mk,.dr')}@media (prefers-reduced-motion: reduce){.beam{opacity:0}}`;
  d.defs.push(`<clipPath id="c"><rect width="${W}" height="${H}" rx="14"/></clipPath>
<linearGradient id="cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8f6bff" stop-opacity=".5"/><stop offset="1" stop-color="#6b3dff" stop-opacity="0"/></linearGradient>`);
  d.add(`<rect width="${W}" height="${H}" fill="${C.cabinet}"/><g clip-path="url(#c)">`);
  d.add(d.text(TITLE(1996), `${calendar.totalContributions.toLocaleString('en-US')} MARKS IN A YEAR`, 40, 66, 30, { fill: C.bone }));
  /* month names along the top */
  let lastMonth = -1;
  calendar.weeks.forEach((w, wi) => {
    const m = new Date(w.contributionDays[0].date).getUTCMonth();
    if (m !== lastMonth && wi < calendar.weeks.length - 2) { d.add(d.text(BODY(520), MONTHS[m], LEFT + wi * PITCH - 6, GY - 22, 12, { fill: C.bone3 })); lastMonth = m; }
  });
  /* the scene: every day is a spot, sized by how much happened */
  const rand = rng(41);
  const spots = days.map((day) => {
    const lv = level(day.contributionCount);
    const x = LEFT + day.wi * PITCH, y = GY + day.weekday * PITCH;
    if (!lv) return `<circle cx="${r1(x)}" cy="${r1(y)}" r="1.3" fill="#2a1a1c"/>`;
    const rr = 2.2 + lv * 1.5 + rand() * 0.5;
    const delay = ((day.wi / calendar.weeks.length) * SWEEP).toFixed(2);
    return `<circle class="glow" cx="${r1(x)}" cy="${r1(y)}" r="${r1(rr)}" fill="#7a0b16" style="animation-delay:${delay}s"/>`;
  });
  d.add(spots.join(''));
  /* the lamp and its beam */
  d.add(`<g class="beam"><g transform="translate(${LEFT - 6} 0)"><polygon points="-6,86 6,86 ${PITCH * 5},${GY + 7 * PITCH + 10} ${-PITCH * 5},${GY + 7 * PITCH + 10}" fill="url(#cone)"/><rect x="-14" y="76" width="28" height="12" rx="3" fill="#2d2a35" stroke="${C.bone3}" stroke-width="1.4"/><rect x="-6" y="70" width="12" height="7" rx="2" fill="#3a3643"/></g></g>`);
  /* evidence markers on the five biggest days */
  top.forEach((t, i) => {
    const x = LEFT + t.wi * PITCH, y = GY + t.weekday * PITCH;
    d.add(`<g class="mk" style="animation-delay:${((t.wi / calendar.weeks.length) * SWEEP).toFixed(2)}s"><path d="M${r1(x - 9)} ${r1(y - 8)} h18 l-3 -16 h-12 z" fill="${C.sun}" stroke="${C.ink}" stroke-width="1.2"/>${d.text(BODY(800), String(i + 1), x, y - 11, 11, { fill: C.ink, anchor: 'middle' })}</g>`);
  });
  /* the marker list: real days, real counts */
  top.forEach((t, i) => {
    const cx = 56 + (i % 3) * 300, cy = 290 + Math.floor(i / 3) * 40;
    d.add(`<path d="M${cx - 9} ${cy} h18 l-3 -16 h-12 z" fill="${C.sun}" stroke="${C.ink}" stroke-width="1.2" transform="translate(0 4)"/>${d.text(BODY(800), String(i + 1), cx, cy - 4, 11, { fill: C.ink, anchor: 'middle' })}${d.text(BODY(500), `${long(t.date)}: ${t.contributionCount} contributions`, cx + 18, cy + 2, 16, { fill: C.bone2 })}`);
  });
  d.add(`</g>`);
  d.write('hunt.svg', DIST);
}

log();
hunt();
