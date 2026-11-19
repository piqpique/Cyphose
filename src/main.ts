import { registerSW } from 'virtual:pwa-register';
import './style.css';
import { addSession, kvGet, kvSet, requestPersistence, sessionsSince, type SessionRecord } from './db';
import { beep, keepAwake, unlockAudio } from './device';
import { EXERCISES, type Phase } from './exercises';
import { buildPlan, INITIAL_ROTATION, SESSION_LABELS, type PlanItem, type RotationState, type SessionType } from './routines';
import {
  DAY_LABELS,
  DEFAULT_PLANNING,
  DEFAULT_SCHEDULE,
  dayKind,
  fmtMin,
  isoDate,
  microSlots,
  nextSlot,
  type DayType,
  type Planning,
  type ScheduleSettings,
} from './schedule';
import { buildSegments } from './segments';
import { advance, currentSegment, finishRun, pause, remaining, resume, skipExercise, startRun, type RunEvent, type RunState } from './timer';

registerSW({ immediate: true });
requestPersistence();

const app = document.querySelector<HTMLDivElement>('#app')!;

const PHASES: Record<Phase, string> = { 1: 'Apprentissage', 2: 'Renforcement', 3: 'Intégration', 4: 'Entretien' };
const SESSION_TYPES: SessionType[] = ['maison', 'maison-courte', 'bureau', 'teletravail'];

interface Settings {
  phase: Phase;
  sound: boolean;
  planning: Planning;
  schedule: ScheduleSettings;
  overrides: Record<string, DayType>;
  protocolStart: string;
}

let settings: Settings;

async function loadSettings(): Promise<Settings> {
  const s: Settings = {
    phase: await kvGet<Phase>('phase', 1),
    sound: await kvGet('sound', true),
    planning: await kvGet('planning', DEFAULT_PLANNING),
    schedule: await kvGet('schedule', DEFAULT_SCHEDULE),
    overrides: await kvGet<Record<string, DayType>>('overrides', {}),
    protocolStart: await kvGet('protocolStart', ''),
  };
  if (!s.protocolStart) {
    s.protocolStart = isoDate(new Date());
    await kvSet('protocolStart', s.protocolStart);
  }
  return s;
}

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function protocolWeek(): number {
  const start = new Date(settings.protocolStart + 'T00:00:00');
  return Math.floor((Date.now() - start.getTime()) / (7 * 86_400_000)) + 1;
}

function mondayOf(d: Date): Date {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}

/* ---------------- Accueil ---------------- */

async function renderHome() {
  await keepAwake(false);
  const now = new Date();
  const kind = dayKind(now, settings.planning, settings.overrides);
  const next = nextSlot(now, kind, settings.schedule);

  const monday = mondayOf(now);
  const week = await sessionsSince(monday.getTime());
  const home = new Set(week.filter((s) => s.type === 'maison' || s.type === 'maison-courte').map((s) => isoDate(new Date(s.startedAt)))).size;
  const micro = week.filter((s) => s.type === 'bureau' || s.type === 'teletravail').length;
  let planned = 0;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  for (let d = new Date(monday); d <= now; d.setDate(d.getDate() + 1)) {
    if (isoDate(d) < settings.protocolStart) continue; // pas de créneau avant l'installation
    const k = dayKind(d, settings.planning, settings.overrides);
    if (k !== 'bureau' && k !== 'teletravail') continue;
    const slots = microSlots(settings.schedule);
    planned += isoDate(d) === isoDate(now) ? slots.filter((t) => t <= nowMin).length : slots.length;
  }

  const microType: SessionType = kind === 'bureau' ? 'bureau' : 'teletravail';
  const dayButtons =
    kind === 'weekend'
      ? `<p class="muted">Pas de micro-séance le week-end.</p>`
      : `<div class="seg" role="group" aria-label="Type du jour">${(['bureau', 'teletravail', 'conge'] as DayType[])
          .map((t) => `<button data-day="${t}" class="${t === kind ? 'on' : ''}">${DAY_LABELS[t]}</button>`)
          .join('')}</div>`;

  const nextText = next
    ? next.what === 'micro'
      ? `Prochaine micro-séance à <b>${fmtMin(next.min)}</b>`
      : `Routine maison à <b>${fmtMin(next.min)}</b>`
    : `Plus de créneau aujourd’hui.`;

  app.innerHTML = `
  <main class="home">
    <header>
      <h1>Cyphose</h1>
      <p class="muted">Phase ${settings.phase} · ${PHASES[settings.phase]} · semaine ${protocolWeek()}</p>
    </header>

    <section class="card">
      <h2>Aujourd’hui</h2>
      ${dayButtons}
      <p>${nextText}</p>
    </section>

    <section class="actions">
      <button class="primary big" data-start="maison">Lancer la routine maison</button>
      <button class="secondary" data-start="maison-courte">Version courte (8 min)</button>
      <button class="secondary" data-start="${microType}">Micro-séance maintenant${kind === 'bureau' ? ' (discrète)' : ''}</button>
    </section>

    <section class="card">
      <h2>Cette semaine</h2>
      <div class="stats">
        <div><span class="num">${home}<small>/7</small></span><span class="muted">routines maison · objectif 5</span></div>
        <div><span class="num">${micro}<small>/${planned}</small></span><span class="muted">micro-séances · créneaux prévus</span></div>
      </div>
    </section>

    <section class="card settings">
      <h2>Réglages</h2>
      <label>Phase
        <select id="phase">${([1, 2, 3, 4] as Phase[])
          .map((p) => `<option value="${p}" ${p === settings.phase ? 'selected' : ''}>${p}. ${PHASES[p]}</option>`)
          .join('')}</select>
      </label>
      <label class="row">Son <input type="checkbox" id="sound" ${settings.sound ? 'checked' : ''}></label>
      <details><summary>Les 4 phases</summary><figure class="illus"><img src="./illustrations/phases.svg" alt="Les 4 phases du protocole et leurs critères de passage"></figure></details>
      <details><summary>Réglage du poste de travail</summary><figure class="illus"><img src="./illustrations/poste.svg" alt="Réglage du poste : haut de l’écran au niveau des yeux, dos contre le dossier"></figure></details>
    </section>
  </main>`;

  app.querySelectorAll<HTMLButtonElement>('[data-day]').forEach((b) =>
    b.addEventListener('click', async () => {
      settings.overrides[isoDate(new Date())] = b.dataset.day as DayType;
      await kvSet('overrides', settings.overrides);
      renderHome();
    }),
  );
  app.querySelectorAll<HTMLButtonElement>('[data-start]').forEach((b) =>
    b.addEventListener('click', () => openSession(b.dataset.start as SessionType, 'manuelle', true)),
  );
  app.querySelector<HTMLSelectElement>('#phase')!.addEventListener('change', async (e) => {
    settings.phase = Number((e.target as HTMLSelectElement).value) as Phase;
    await kvSet('phase', settings.phase);
    renderHome();
  });
  app.querySelector<HTMLInputElement>('#sound')!.addEventListener('change', async (e) => {
    settings.sound = (e.target as HTMLInputElement).checked;
    await kvSet('sound', settings.sound);
  });
}

/* ---------------- Lecteur de séance ---------------- */

interface Live {
  type: SessionType;
  origin: SessionRecord['origin'];
  items: PlanItem[];
  run: RunState;
  startedAt: number;
  timer: number;
  lastWhole: number;
  shownKey: string;
}

let live: Live | null = null;

async function openSession(type: SessionType, origin: SessionRecord['origin'], fromTap: boolean) {
  const today = isoDate(new Date());
  const rotation = await kvGet<RotationState>('rotation', INITIAL_ROTATION);
  const plan = buildPlan(type, settings.phase, rotation, today);
  if (type === 'teletravail') await kvSet('rotation', plan.rotation);
  const segs = plan.items.map((i) => buildSegments(i.dose));

  const begin = () => {
    unlockAudio();
    keepAwake(true);
    const now = Date.now();
    live = { type, origin, items: plan.items, run: startRun(segs, now), startedAt: now, timer: 0, lastWhole: -1, shownKey: '' };
    live.timer = window.setInterval(tick, 100);
    tick();
  };

  if (fromTap) return begin();

  // Ouvert depuis un lien (rappel) : iOS exige un toucher pour le son et l'écran allumé.
  app.innerHTML = `
  <main class="ready">
    <h1>${SESSION_LABELS[type]}</h1>
    <p class="muted">${plan.items.map((i) => esc(EXERCISES[i.exerciseId].name)).join(' · ')}</p>
    <button class="primary big" id="go">Démarrer</button>
    <button class="link" id="home">Retour à l’accueil</button>
  </main>`;
  app.querySelector('#go')!.addEventListener('click', begin);
  app.querySelector('#home')!.addEventListener('click', renderHome);
}

function onEvents(events: RunEvent[]) {
  if (!live) return;
  for (const e of events) {
    if (e.type === 'segmentEnd') {
      flash(e.kind === 'work' ? 'end' : 'go');
      if (settings.sound) beep(e.kind === 'work' ? 523 : 880, 0.25);
    }
    if (e.type === 'finished') endSession();
  }
}

function flash(kind: 'end' | 'go') {
  document.body.classList.remove('flash-end', 'flash-go');
  void document.body.offsetWidth;
  document.body.classList.add(`flash-${kind}`);
}

function tick() {
  if (!live) return;
  const now = Date.now();
  const { state, events } = advance(live.run, now);
  live.run = state;
  onEvents(events);
  if (!live || live.run.finished) return;

  const seg = currentSegment(live.run)!;
  const left = remaining(live.run, now);
  const whole = Math.ceil(left);
  if (whole !== live.lastWhole) {
    if (settings.sound && whole <= 3 && whole >= 1 && live.lastWhole > whole && seg.kind !== 'inhale' && seg.kind !== 'exhale')
      beep(1200, 0.06, 0.15);
    live.lastWhole = whole;
  }

  const key = `${live.run.ex}:${live.run.seg}:${live.run.pausedAt !== null}`;
  if (key !== live.shownKey) {
    live.shownKey = key;
    renderPlayer();
  }
  const t = app.querySelector('#time');
  if (t) t.textContent = String(whole);
  const bar = app.querySelector<HTMLElement>('#bar');
  if (bar) {
    const segs = live.run.plan[live.run.ex];
    const total = segs.reduce((a, s) => a + s.seconds, 0);
    const done = segs.slice(0, live.run.seg).reduce((a, s) => a + s.seconds, 0) + (seg.seconds - left);
    bar.style.width = `${Math.min(100, (done / total) * 100)}%`;
  }
}

function renderPlayer() {
  if (!live) return;
  const { run, items } = live;
  const item = items[run.ex];
  const ex = EXERCISES[item.exerciseId];
  const seg = currentSegment(run)!;
  const paused = run.pausedAt !== null;
  const breath = seg.kind === 'inhale' || seg.kind === 'exhale';
  const nextSeg = run.plan[run.ex][run.seg + 1];
  const nextEx = items[run.ex + 1];
  const nextText = nextSeg ? nextSeg.label : nextEx ? `Exercice suivant : ${EXERCISES[nextEx.exerciseId].name}` : 'Fin de séance';

  app.innerHTML = `
  <main class="player kind-${seg.kind} ${paused ? 'paused' : ''}">
    <header class="top">
      <span class="muted">${SESSION_LABELS[live.type]} · ${run.ex + 1}/${items.length}</span>
      <button class="link" id="stop">Terminer</button>
    </header>

    <figure class="illus"><img src="./illustrations/${esc(ex.illustration)}" alt="Illustration : ${esc(ex.name)}"></figure>

    <h1 class="exname">${esc(ex.name)}</h1>
    ${item.dose.note ? `<p class="note">${esc(item.dose.note)}</p>` : ''}

    <section class="clock">
      <p class="label">${paused ? 'En pause' : esc(seg.label)}</p>
      ${breath ? `<div class="breath ${seg.kind}" style="--d:${seg.seconds}s"></div>` : ''}
      <p class="time" id="time"></p>
      <p class="counter">${esc(seg.counter)}</p>
      <div class="progress"><div id="bar"></div></div>
      <p class="muted next">Ensuite : ${esc(nextText)}</p>
    </section>

    <ul class="cues">${ex.cues.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
    <p class="avoid"><b>À éviter :</b> ${esc(ex.avoid)}</p>

    <footer class="controls">
      <button class="secondary" id="pause">${paused ? 'Reprendre' : 'Pause'}</button>
      <button class="secondary" id="skip">Passer l’exercice</button>
    </footer>
  </main>`;

  app.querySelector('#pause')!.addEventListener('click', () => {
    if (!live) return;
    const now = Date.now();
    live.run = live.run.pausedAt === null ? pause(live.run, now) : resume(live.run, now);
    tick();
  });
  app.querySelector('#skip')!.addEventListener('click', () => {
    if (!live) return;
    const { state, events } = skipExercise(live.run, Date.now());
    live.run = state;
    onEvents(events);
    tick();
  });
  app.querySelector('#stop')!.addEventListener('click', () => {
    if (!live) return;
    if (!confirm('Terminer la séance maintenant ? Elle sera enregistrée.')) return;
    live.run = finishRun(live.run);
    endSession();
  });
}

async function endSession() {
  if (!live) return;
  const l = live;
  live = null;
  clearInterval(l.timer);
  await keepAwake(false);
  const endedAt = Date.now();
  const record: SessionRecord = {
    startedAt: l.startedAt,
    endedAt,
    durationSec: Math.round((endedAt - l.startedAt) / 1000),
    type: l.type,
    origin: l.origin,
    exercises: l.items.map((i, k) => ({ id: i.exerciseId, status: l.run.statuses[k] })),
  };
  await addSession(record);
  if (settings.sound) beep(660, 0.4);

  const min = Math.floor(record.durationSec / 60);
  const sec = record.durationSec % 60;
  app.innerHTML = `
  <main class="end">
    <h1>Séance enregistrée</h1>
    <p class="big-num">${min} min ${String(sec).padStart(2, '0')} s</p>
    <ul class="results">${record.exercises
      .map((e) => `<li class="${e.status}"><span>${esc(EXERCISES[e.id].name)}</span><span>${e.status === 'done' ? 'Fait' : 'Sauté'}</span></li>`)
      .join('')}</ul>
    <button class="primary big" id="home">Retour à l’accueil</button>
  </main>`;
  app.querySelector('#home')!.addEventListener('click', renderHome);
}

/* ---------------- Démarrage ---------------- */

async function boot() {
  settings = await loadSettings();
  const params = new URLSearchParams(location.search);
  const seance = params.get('seance') as SessionType | null;
  if (seance && SESSION_TYPES.includes(seance)) {
    history.replaceState(null, '', location.pathname);
    return openSession(seance, params.get('origine') === 'rappel' ? 'rappel' : 'manuelle', false);
  }
  renderHome();
}

// Rafraîchit l'accueil au retour dans l'app (le jour ou le prochain créneau a pu changer).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !live && app.querySelector('.home')) renderHome();
  if (document.visibilityState === 'visible' && live) tick();
});

boot().catch((e) => {
  app.innerHTML = `<main><h1>Erreur</h1><pre>${esc(String(e))}</pre></main>`;
});
