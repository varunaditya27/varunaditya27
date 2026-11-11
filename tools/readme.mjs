import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = JSON.parse(readFileSync(join(ROOT, 'data/projects.json'), 'utf8'));
const SITE = 'https://varun-aditya-portfolio.vercel.app';
const page = (id) => `${SITE}/projects/${id}`;
const byId = (id) => DATA.projects.find((p) => p.id === id);

const alt = {
  hero: 'Varun Aditya, AI engineer and software developer in Bengaluru. An isometric lab bench with a box of blood slides, a microscope, a laptop running code and a lamp. The lights go out and the blood glows blue.',
  divider: 'Crime scene tape',
};
const img = (file, text, width = '100%') => `<img src="assets/${file}.svg" alt="${text}" width="${width}">`;
const plate = (file, text) => `<p align="center">${img(file, text)}</p>`;

const cards = DATA.selected.map((id) => `<a href="${page(id)}">${img(`case-${id}`, `Case file: ${byId(id).name}. Open it on the portfolio.`, '100%')}</a>`);

const groups = Object.entries(DATA.chapters).map(([cid, name]) => {
  const items = DATA.projects.filter((p) => p.chapter === cid).map((p) => `<a href="${page(p.id)}">${p.name}</a>`);
  return items.length ? `<p><b>${name}</b><br>${items.join(' · ')}</p>` : '';
}).join('\n');

const md = `<div align="center">

<a href="${SITE}">${img('hero', alt.hero)}</a>

<p>
<a href="${SITE}"><b>Portfolio</b></a> &nbsp;|&nbsp;
<a href="${SITE}/Varun_Aditya_Resume.pdf">Résumé</a> &nbsp;|&nbsp;
<a href="https://www.linkedin.com/in/varunaditya27">LinkedIn</a> &nbsp;|&nbsp;
<a href="mailto:varunaditya2706@gmail.com">Email</a>
</p>

</div>

Hi, I'm Varun, an AI engineer and software developer in Bengaluru. I'm studying Information Science and Engineering at RV College of Engineering and I'm Vice President of Coding Club RVCE. This page is the lab behind my [portfolio](${SITE}), where the ${DATA.projects.length} projects are written up as case files.

${plate('plate-subject', 'Section 1. Person of interest')}

<p align="center">${img('subject', 'Subject file for Varun Aditya, with a photograph.')}</p>

<p align="center">${img('divider', alt.divider)}</p>

${plate('plate-cases', `Section 2. Open cases. ${DATA.projects.length} projects, four on the board.`)}

<table>
<tr>
<td width="50%">${cards[0]}</td>
<td width="50%">${cards[1]}</td>
</tr>
<tr>
<td width="50%">${cards[2]}</td>
<td width="50%">${cards[3]}</td>
</tr>
</table>

<details>
<summary><b>All ${DATA.projects.length} case files</b></summary>
<br>

${groups}

</details>

<p align="center">${img('divider', alt.divider)}</p>

${plate('plate-log', 'Section 3. The log: my latest public pushes, refreshed daily.')}

<p align="center"><img src="https://raw.githubusercontent.com/varunaditya27/varunaditya27/output/log.svg" alt="Evidence log of my latest public pushes, refreshed every day." width="100%"></p>

${plate('plate-record', 'Section 4. The priors: results and roles in date order.')}

<p align="center">${img('record', 'Results and roles in date order, from the start of the degree in September 2024 to Vice President of Coding Club RVCE in 2026 to 2027.')}</p>

${plate('plate-tools', 'Section 5. The kit: what the projects are built with.')}

<p align="center">${img('stack', 'Tools used across the projects, grouped as languages, frameworks, AI and models, data and services, and systems and chains.')}</p>

<p align="center">${img('divider', alt.divider)}</p>

${plate('plate-activity', 'Section 6. The hunt: a year of contributions as a crime scene.')}

<p align="center"><img src="https://raw.githubusercontent.com/varunaditya27/varunaditya27/output/hunt.svg" alt="My contribution year as a crime scene: every day is a blood droplet, a UV lamp sweeps across and the droplets glow, and the five biggest days carry numbered evidence markers." width="100%"></p>

${plate('plate-contact', 'Section 7. Leave a message.')}

<p align="center">
<a href="mailto:varunaditya2706@gmail.com">varunaditya2706@gmail.com</a> &nbsp;|&nbsp;
<a href="https://www.linkedin.com/in/varunaditya27">linkedin.com/in/varunaditya27</a> &nbsp;|&nbsp;
<a href="${SITE}">${SITE.replace('https://', '')}</a>
</p>

<p align="center">${img('footer', 'That is the file. Varun Aditya, Bengaluru.')}</p>
`;
writeFileSync(join(ROOT, 'README.md'), md);
console.log('README.md', (md.length / 1024).toFixed(1) + ' KB');
