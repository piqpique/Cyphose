import { allSessions, deleteSession, type SessionRecord } from '../db';
import { EXERCISES } from '../exercises';
import { PHASES } from '../phases';
import { SESSION_LABELS } from '../routines';
import { parseIso } from '../schedule';
import { settings } from '../state';
import { counts, streak, totalsByExercise, weeklySeries, type WeekStats } from '../stats';
import { app, ask, bindTabs, esc, fmtDay, fmtDayMonth, fmtTime, tabbar, toast } from '../ui';

const nameOf = (id: string) => EXERCISES[id]?.name ?? id;
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;
const PAGE = 15;
const shortDate = (iso: string) => { const d = parseIso(iso); return `${d.getDate()}/${d.getMonth() + 1}`; };
const shortDuration = (sec: number) => (sec < 60 ? `${sec} s` : `${Math.round(sec / 60)} min`);
let showAll = false;

interface ChartOpts {
  id: string;
  title: string;
  series: WeekStats[];
  value: (w: WeekStats) => number;
  max: number;
  maxLabel?: string;
  goal?: { value: number };
  describe: (w: WeekStats, current: boolean) => string;
}

/** Barres par semaine : une seule série par graphique, valeurs au toucher et dans le tableau. */
function chart(o: ChartOpts): string {
  const last = o.series.length - 1;
  return `
  <section class="card">
    <h2>${esc(o.title)}</h2>
    <div class="chart">
      <div class="yaxis" aria-hidden="true"><span style="bottom:100%">${o.maxLabel ?? o.max}</span>${
        o.goal ? `<span class="goal-tick" style="bottom:${(o.goal.value / o.max) * 100}%">${o.goal.value}</span>` : ''
      }<span style="bottom:0">0</span></div>
      <div class="scroll">
        <div class="plot" style="width:${o.series.length * 40}px">
          <div class="grid" style="bottom:100%"></div>
          ${o.goal ? `<div class="goal" style="bottom:${(o.goal.value / o.max) * 100}%"></div>` : ''}
          ${o.series
            .map((w, i) => {
              const v = o.value(w);
              return `<button class="col${i === last ? ' on' : ''}" data-chart="${o.id}" data-text="${esc(o.describe(w, i === last))}" aria-label="${esc(o.describe(w, i === last))}">
                <span class="bar" style="height:${Math.min(100, (v / o.max) * 100)}%"></span>
                <span class="x">${shortDate(w.week)}</span>
              </button>`;
            })
            .join('')}
        </div>
      </div>
    </div>
    <p class="readout" id="readout-${o.id}" aria-live="polite">${esc(o.describe(o.series[last], true))}</p>
  </section>`;
}

/** Part des créneaux prévus où une micro-séance a été faite (plafonnée à 100 %). */
const rate = (w: WeekStats) => (w.planned ? Math.min(100, Math.round((w.micro / w.planned) * 100)) : 0);

function sessionRow(r: SessionRecord): string {
  const done = r.exercises.filter((e) => e.status === 'done').length;
  return `<li>
    <div>
      <b>${esc(SESSION_LABELS[r.type])}</b>
      <span class="muted">${esc(fmtDay(r.startedAt))} · ${fmtTime(r.startedAt)} · ${shortDuration(r.durationSec)} · ${done}/${r.exercises.length} exercices${
        counts(r) ? '' : ' · non comptée'
      }${r.origin === 'rappel' ? ' · depuis un rappel' : ''}</span>
    </div>
    <button class="link danger" data-del="${r.id}" aria-label="Supprimer la séance du ${esc(fmtDay(r.startedAt))} à ${fmtTime(r.startedAt)}">Supprimer</button>
  </li>`;
}

export async function renderHistory() {
  const now = new Date();
  const records = await allSessions();
  const goal = PHASES[settings.phase];

  if (!records.length) {
    app.innerHTML = `
    <main class="with-tabs history">
      <h1>Historique</h1>
      <section class="card"><p>Aucune séance enregistrée pour l’instant.</p><p class="muted">Lance ta première routine depuis l’accueil.</p></section>
    </main>${tabbar('history')}`;
    bindTabs();
    return;
  }

  const series = weeklySeries(records, now, settings);
  const cur = series[series.length - 1];
  const days = streak(records, now);
  const totals = totalsByExercise(records, nameOf);
  const recent = [...records].sort((a, b) => b.startedAt - a.startedAt);
  const shown = showAll ? recent : recent.slice(0, PAGE);
  const weekOf = (w: WeekStats, current: boolean) => `Semaine du ${fmtDayMonth(parseIso(w.week))}${current ? ' (en cours)' : ''}`;

  app.innerHTML = `
  <main class="with-tabs history">
    <h1>Historique</h1>

    <section class="card bloc">
      <h2>Cette semaine</h2>
      <div class="stats">
        <div><span class="num">${cur.homeDays}<small>/7</small></span><span class="muted">jours avec routine maison · objectif ${goal.goalText}</span></div>
        <div><span class="num">${cur.micro}<small>/${cur.planned}</small></span><span class="muted">micro-séances · créneaux prévus</span></div>
      </div>
      <p>${days ? `<b>${plural(days, 'jour')}</b> d’affilée avec une routine maison.` : 'Pas de série en cours : une routine maison aujourd’hui en démarre une.'}</p>
    </section>

    ${chart({
      id: 'home',
      title: `Jours de routine maison par semaine · objectif ${goal.goalText}`,
      series,
      value: (w) => w.homeDays,
      max: 7,
      goal: { value: goal.goal },
      describe: (w, c) => `${weekOf(w, c)} : ${plural(w.homeDays, 'jour')} avec routine maison sur 7.`,
    })}

    ${chart({
      id: 'micro',
      title: 'Créneaux de micro-séance tenus, par semaine',
      series,
      value: (w) => rate(w),
      max: 100,
      maxLabel: '100 %',
      describe: (w, c) =>
        w.planned
          ? `${weekOf(w, c)} : ${plural(w.micro, 'micro-séance')} pour ${plural(w.planned, 'créneau')} prévu${w.planned > 1 ? 's' : ''} (${rate(w)} %).`
          : `${weekOf(w, c)} : aucun créneau prévu${w.micro ? `, ${plural(w.micro, 'micro-séance')} quand même` : ''}.`,
    })}

    <details class="card">
      <summary>Voir les chiffres par semaine</summary>
      <table>
        <thead><tr><th>Semaine du</th><th>Maison (jours)</th><th>Micro</th><th>Créneaux</th></tr></thead>
        <tbody>${[...series]
          .reverse()
          .map((w) => `<tr><td>${esc(fmtDayMonth(parseIso(w.week)))}</td><td>${w.homeDays}</td><td>${w.micro}</td><td>${w.planned}</td></tr>`)
          .join('')}</tbody>
      </table>
    </details>

    <section class="card">
      <h2>Total par exercice</h2>
      ${
        totals.length
          ? `<ul class="totals">${totals.map((t) => `<li><span>${esc(t.name)}</span><span class="count">${t.count}</span></li>`).join('')}</ul>`
          : '<p class="muted">Aucun exercice terminé pour l’instant.</p>'
      }
    </section>

    <section class="card">
      <h2>Séances</h2>
      <ul class="sessions">${shown.map(sessionRow).join('')}</ul>
      ${!showAll && recent.length > PAGE ? `<button class="link" id="more">Tout afficher (${recent.length})</button>` : ''}
    </section>
  </main>
  ${tabbar('history')}`;

  bindTabs();
  app.querySelectorAll<HTMLElement>('.scroll').forEach((s) => (s.scrollLeft = s.scrollWidth));
  app.querySelectorAll<HTMLButtonElement>('.col').forEach((b) => {
    const show = () => {
      const id = b.dataset.chart!;
      app.querySelectorAll(`.col[data-chart="${id}"]`).forEach((c) => c.classList.toggle('on', c === b));
      app.querySelector(`#readout-${id}`)!.textContent = b.dataset.text!;
    };
    b.addEventListener('click', show);
    b.addEventListener('mouseenter', show);
    b.addEventListener('focus', show);
  });
  app.querySelector('#more')?.addEventListener('click', () => {
    showAll = true;
    keepScroll(renderHistory);
  });
  app.querySelectorAll<HTMLButtonElement>('[data-del]').forEach((b) =>
    b.addEventListener('click', async () => {
      const ok = await ask({
        title: 'Supprimer cette séance ?',
        text: 'Elle disparaîtra de l’historique et des statistiques.',
        actions: [
          { id: 'del', label: 'Supprimer', style: 'primary' },
          { id: 'back', label: 'Garder', style: 'link' },
        ],
      });
      if (ok !== 'del') return;
      await deleteSession(Number(b.dataset.del));
      toast('Séance supprimée.');
      keepScroll(renderHistory);
    }),
  );
}

async function keepScroll(render: () => Promise<void>) {
  const y = window.scrollY;
  await render();
  window.scrollTo(0, y);
}
