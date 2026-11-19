import { addSession, deleteSession, kvDel, kvSet, type SessionRecord } from '../db';
import { beep, keepAwake, speak, stopSpeech, unlockAudio } from '../device';
import { EXERCISES } from '../exercises';
import { buildPlan, SESSION_LABELS, type PlanItem, type RotationState, type SessionType } from '../routines';
import { navigate } from '../router';
import { isoDate } from '../schedule';
import { buildSegments, totalSeconds, type Segment } from '../segments';
import { saveSetting, settings } from '../state';
import { counts } from '../stats';
import {
  activeMs,
  advance,
  currentSegment,
  doneCount,
  finishRun,
  pause,
  remaining,
  remainingTotal,
  resume,
  resumeAfterAbsence,
  skipExercise,
  skipSegment,
  startRun,
  type RunEvent,
  type RunState,
  type SegmentEndEvent,
} from '../timer';
import { app, ask, esc, fmtDuration, fmtMinutes, toast } from '../ui';

/** Au-delà de cette absence, la séance est mise en pause à l'heure du départ. */
export const MAX_ABSENCE_MS = 5 * 60_000;

/** Ce qui est sauvegardé pour reprendre une séance si iOS ferme l'app. */
export interface LiveSnapshot {
  type: SessionType;
  origin: SessionRecord['origin'];
  items: PlanItem[];
  run: RunState;
  startedAt: number;
  /** Rotation télétravail à enregistrer seulement si la séance est gardée. */
  rotationAfter: RotationState | null;
  hiddenAt: number | null;
  savedAt: number;
}

interface Refs {
  main: HTMLElement;
  label: HTMLElement;
  time: HTMLElement;
  counter: HTMLElement;
  bar: HTMLElement;
  next: HTMLElement;
  left: HTMLElement;
  banner: HTMLElement;
  breath: HTMLElement | null;
  pause: HTMLButtonElement;
  step: HTMLButtonElement;
}

interface Live extends LiveSnapshot {
  timer: number;
  lastWhole: number;
  exKey: number;
  segKey: string;
  refs: Refs | null;
}

let live: Live | null = null;

export const sessionActive = () => live !== null;

const soundOn = (t: SessionType) => (t === 'bureau' ? settings.soundBureau : settings.sound);
const voiceOn = (t: SessionType) => settings.voice && t !== 'bureau';

function snapshotOf(l: Live): LiveSnapshot {
  const { type, origin, items, run, startedAt, rotationAfter, hiddenAt } = l;
  return { type, origin, items, run, startedAt, rotationAfter, hiddenAt, savedAt: Date.now() };
}

function persist() {
  if (live) kvSet('live', snapshotOf(live)).catch(() => {});
}

export const planDuration = (items: PlanItem[]) => items.reduce((t, i) => t + totalSeconds(buildSegments(i.dose, i.prep)), 0);

/* ---------------- Ouverture ---------------- */

/**
 * Ouvre une séance. `fromTap` : lancée par un toucher (le son peut démarrer tout de
 * suite). Sinon (lien d'un rappel), un écran « Démarrer » demande ce toucher.
 * Tout est synchrone jusqu'au démarrage : iOS n'autorise son et voix que dans le toucher.
 */
export function openSession(type: SessionType, origin: SessionRecord['origin'], fromTap: boolean) {
  const plan = buildPlan(type, settings.phase, settings.rotation, isoDate(new Date()));
  const start = () => {
    const now = Date.now();
    begin({
      type,
      origin,
      items: plan.items,
      run: startRun(plan.items.map((i) => buildSegments(i.dose, i.prep)), now),
      startedAt: now,
      rotationAfter: type === 'teletravail' ? plan.rotation : null,
      hiddenAt: null,
      savedAt: now,
    });
  };
  if (fromTap) return start();

  app.innerHTML = `
  <main class="ready">
    <h1>${SESSION_LABELS[type]}</h1>
    <p class="muted">${fmtMinutes(planDuration(plan.items))} · ${plan.items.map((i) => esc(EXERCISES[i.exerciseId].name)).join(' · ')}</p>
    <button class="primary big" id="go">Démarrer</button>
    <button class="link" id="home">Retour à l’accueil</button>
  </main>`;
  app.querySelector('#go')!.addEventListener('click', start);
  app.querySelector('#home')!.addEventListener('click', () => navigate('home'));
}

function begin(snap: LiveSnapshot) {
  unlockAudio();
  keepAwake(true);
  live = { ...snap, hiddenAt: null, timer: 0, lastWhole: -1, exKey: -1, segKey: '', refs: null };
  live.timer = window.setInterval(tick, 200);
  persist();
  tick();
}

/** Séance retrouvée au démarrage (app fermée par iOS ou rechargée). */
export function renderResume(snap: LiveSnapshot, then: () => void) {
  const now = Date.now();
  let run = resumeAfterAbsence(snap.run, snap.hiddenAt ?? snap.savedAt, now, MAX_ABSENCE_MS).state;
  run = advance(run, now).state; // absence courte : le chrono rattrape le temps écoulé
  if (!run.finished) run = pause(run, now); // le chrono ne tourne pas pendant que l'on choisit
  const s: LiveSnapshot = { ...snap, run, hiddenAt: null };
  const done = doneCount(run);
  const total = s.items.length;

  app.innerHTML = `
  <main class="ready">
    <h1>Séance en cours</h1>
    <p>${SESSION_LABELS[s.type]}</p>
    <p class="muted">${
      run.finished
        ? `Terminée pendant ton absence : ${done}/${total} exercices faits.`
        : `Exercice ${run.ex + 1}/${total} · ${done} fait${done > 1 ? 's' : ''} · ${run.pausedAt !== null ? 'en pause' : 'en cours'}`
    }</p>
    ${run.finished ? '' : '<button class="primary big" id="resume">Reprendre</button>'}
    ${done ? `<button class="${run.finished ? 'primary big' : 'secondary'}" id="save">Enregistrer et terminer</button>` : ''}
    <button class="link danger" id="discard">Abandonner sans enregistrer</button>
  </main>`;

  app.querySelector('#resume')?.addEventListener('click', () => begin({ ...s, run: resume(s.run, Date.now()) }));
  app.querySelector('#save')?.addEventListener('click', async () => {
    await kvDel('live');
    await saveRecord(s, finishRun(s.run), Date.now());
  });
  app.querySelector('#discard')!.addEventListener('click', async () => {
    const ok = await ask({
      title: 'Abandonner la séance ?',
      text: 'Elle ne sera pas enregistrée.',
      actions: [
        { id: 'discard', label: 'Abandonner', style: 'danger' },
        { id: 'back', label: 'Annuler', style: 'secondary' },
      ],
    });
    if (ok !== 'discard') return;
    await kvDel('live');
    toast('Séance abandonnée, rien n’a été enregistré.');
    then();
  });
}

/* ---------------- Boucle ---------------- */

function tick() {
  const l = live;
  // App cachée : rien n'avance ici, la règle d'absence s'applique au retour (onVisibility).
  if (!l || l.hiddenAt !== null) return;
  const now = Date.now();
  const { state, events } = advance(l.run, now);
  l.run = state;
  feedback(l, events);
  if (l.run.finished) return void finish(true);
  render(l, now);
}

/** Son et flash de fin d'étape. Après un rattrapage (écran verrouillé), un seul signal. */
function feedback(l: Live, events: RunEvent[]) {
  const ends = events.filter((e): e is SegmentEndEvent => e.type === 'segmentEnd');
  const last = ends.at(-1);
  if (!last) return;
  flash(last.kind === 'work' ? 'end' : 'go');
  if (soundOn(l.type)) beep(last.kind === 'work' ? 523 : 880, 0.25);
}

function flash(kind: 'end' | 'go') {
  document.body.classList.remove('flash-end', 'flash-go');
  void document.body.offsetWidth;
  document.body.classList.add(`flash-${kind}`);
}

function render(l: Live, now: number) {
  if (l.exKey !== l.run.ex || !l.refs) {
    mountExercise(l);
    l.exKey = l.run.ex;
    l.segKey = '';
  }
  const segId = `${l.run.ex}:${l.run.seg}`;
  const key = `${segId}:${l.run.pausedAt !== null}`;
  if (key !== l.segKey) {
    const segChanged = !l.segKey.startsWith(`${segId}:`);
    l.segKey = key;
    updateSegment(l, now, segChanged);
    persist();
  }
  updateClock(l, now);
}

/* ---------------- Affichage ---------------- */

/** Construit l'écran d'un exercice une seule fois (pas de clignotement de l'illustration). */
function mountExercise(l: Live) {
  const item = l.items[l.run.ex];
  const ex = EXERCISES[item.exerciseId];
  const isBreath = item.dose.kind === 'breaths';

  app.innerHTML = `
  <main class="player">
    <header class="top">
      <div>
        <p class="muted">${SESSION_LABELS[l.type]} · exercice ${l.run.ex + 1}/${l.items.length}</p>
        <p class="muted small" id="left"></p>
      </div>
      <button class="link" id="stop">Arrêter</button>
    </header>
    <p class="banner" id="banner" hidden></p>

    <figure class="illus"><img src="./illustrations/${esc(ex.illustration)}" alt="Illustration : ${esc(ex.name)}"></figure>

    <h1 class="exname">${esc(ex.name)}</h1>
    ${item.dose.note ? `<p class="note">${esc(item.dose.note)}</p>` : ''}

    <section class="clock">
      <p class="label" id="label" aria-live="polite"></p>
      ${isBreath ? '<div class="breath-host" id="breath" aria-hidden="true"></div>' : ''}
      <p class="time" id="time" aria-hidden="true"></p>
      <p class="counter" id="counter"></p>
      <div class="progress" aria-hidden="true"><div id="bar"></div></div>
      <p class="muted next" id="next"></p>
    </section>

    <ul class="cues">${ex.cues.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
    <p class="avoid"><b>À éviter :</b> ${esc(ex.avoid)}</p>

    <footer class="controls">
      <button class="secondary" id="pause">Pause</button>
      <button class="secondary" id="step">Étape suivante</button>
      <button class="secondary" id="skip">Exercice suivant</button>
    </footer>
  </main>`;
  window.scrollTo(0, 0);

  const $ = <T extends HTMLElement>(id: string) => app.querySelector<T>(`#${id}`)!;
  l.refs = {
    main: app.querySelector('main')!,
    label: $('label'),
    time: $('time'),
    counter: $('counter'),
    bar: $('bar'),
    next: $('next'),
    left: $('left'),
    banner: $('banner'),
    breath: app.querySelector('#breath'),
    pause: $('pause'),
    step: $('step'),
  };
  l.lastWhole = -1;

  l.refs.pause.addEventListener('click', () => control((s, now) => ({ state: s.pausedAt === null ? pause(s, now) : resume(s, now), events: [] })));
  l.refs.step.addEventListener('click', () => control(skipSegment));
  $('skip').addEventListener('click', () => control(skipExercise));
  $('stop').addEventListener('click', stopFlow);
}

/** Applique une action de l'utilisateur sur la séance. */
function control(action: (s: RunState, now: number) => { state: RunState; events: RunEvent[] }) {
  const l = live;
  if (!l) return;
  const now = Date.now();
  const { state, events } = action(l.run, now);
  l.run = state;
  if (l.refs) l.refs.banner.hidden = true;
  feedback(l, events);
  if (l.run.finished) return void finish(true);
  render(l, now);
}

function nextText(l: Live): string {
  const nextSeg = l.run.plan[l.run.ex][l.run.seg + 1];
  if (nextSeg) return nextSeg.label;
  const nextEx = l.items[l.run.ex + 1];
  return nextEx ? `exercice suivant, ${EXERCISES[nextEx.exerciseId].name}` : 'fin de séance';
}

function updateSegment(l: Live, now: number, segChanged: boolean) {
  const r = l.refs!;
  const seg = currentSegment(l.run)!;
  const paused = l.run.pausedAt !== null;
  r.main.className = `player kind-${seg.kind}${paused ? ' paused' : ''}`;
  r.label.textContent = paused ? 'En pause' : seg.label;
  r.counter.textContent = seg.counter;
  r.next.textContent = `Ensuite : ${nextText(l)}`;
  r.pause.textContent = paused ? 'Reprendre' : 'Pause';
  r.step.textContent = seg.kind === 'prep' ? 'Je suis prêt' : 'Étape suivante';

  if (r.breath) {
    r.breath.replaceChildren();
    if (seg.kind === 'inhale' || seg.kind === 'exhale') {
      // Le cercle reprend là où il en était (après une pause), pas depuis le début.
      const el = document.createElement('div');
      el.className = `breath ${seg.kind}`;
      el.style.animationDuration = `${seg.seconds}s`;
      el.style.animationDelay = `-${(seg.seconds - remaining(l.run, now)).toFixed(2)}s`;
      r.breath.append(el);
    }
  }
  if (segChanged && !paused) announce(l, seg);
}

function updateClock(l: Live, now: number) {
  const r = l.refs!;
  const seg = currentSegment(l.run)!;
  const left = remaining(l.run, now);
  const whole = Math.ceil(left);
  if (whole !== l.lastWhole) {
    // Décompte sonore des 3 dernières secondes, seulement sur les étapes assez longues.
    const countdown =
      soundOn(l.type) &&
      l.run.pausedAt === null &&
      seg.seconds >= 5 &&
      seg.kind !== 'inhale' &&
      seg.kind !== 'exhale' &&
      whole >= 1 &&
      whole <= 3 &&
      l.lastWhole > whole;
    if (countdown) beep(1200, 0.06, 0.15);
    l.lastWhole = whole;
    r.time.textContent = String(whole);
    r.left.textContent = `${fmtMinutes(Math.ceil(remainingTotal(l.run, now)))} restantes`;
  }
  const segs = l.run.plan[l.run.ex];
  const total = totalSeconds(segs);
  const done = totalSeconds(segs.slice(0, l.run.seg)) + (seg.seconds - left);
  r.bar.style.width = `${Math.min(100, (done / total) * 100)}%`;
}

/** Annonces vocales : nom de l'exercice, changements, respiration, longues tenues. Les répétitions courtes n'ont que les bips. */
function announce(l: Live, seg: Segment) {
  if (!voiceOn(l.type)) return;
  const ex = EXERCISES[l.items[l.run.ex].exerciseId];
  let text = '';
  if (seg.kind === 'prep') text = ex.name;
  else if (seg.kind === 'switch' || seg.kind === 'inhale' || seg.kind === 'exhale') text = seg.label;
  else if (seg.label === 'Repos entre séries') text = `Repos, ${seg.seconds} secondes`;
  else if (seg.kind === 'work' && seg.seconds >= 10) text = `${seg.label}, ${seg.seconds} secondes`;
  speak(text);
}

/* ---------------- Arrêt, fin, absence ---------------- */

async function stopFlow() {
  const l = live;
  if (!l) return;
  const wasPaused = l.run.pausedAt !== null;
  if (!wasPaused) control((s, now) => ({ state: pause(s, now), events: [] }));
  const done = doneCount(l.run);
  const choice = await ask({
    title: 'Arrêter la séance ?',
    text: done
      ? `${done} exercice${done > 1 ? 's' : ''} sur ${l.items.length} fait${done > 1 ? 's' : ''}.`
      : 'Aucun exercice terminé : rien ne sera enregistré.',
    actions: done
      ? [
          { id: 'save', label: 'Enregistrer et terminer', style: 'primary' },
          { id: 'discard', label: 'Abandonner sans enregistrer', style: 'danger' },
          { id: 'continue', label: 'Continuer la séance', style: 'secondary' },
        ]
      : [
          { id: 'discard', label: 'Abandonner', style: 'danger' },
          { id: 'continue', label: 'Continuer la séance', style: 'secondary' },
        ],
  });
  if (live !== l) return;
  if (choice === 'save') {
    l.run = finishRun(l.run);
    return finish(true);
  }
  if (choice === 'discard') return finish(false);
  if (!wasPaused) control((s, now) => ({ state: resume(s, now), events: [] }));
}

async function finish(keep: boolean) {
  const l = live;
  if (!l) return;
  live = null;
  clearInterval(l.timer);
  keepAwake(false);
  await kvDel('live');
  if (!keep) {
    stopSpeech();
    toast('Séance abandonnée, rien n’a été enregistré.');
    return navigate('home');
  }
  if (soundOn(l.type)) beep(660, 0.4);
  if (voiceOn(l.type)) speak('Séance terminée');
  await saveRecord(l, l.run, Date.now());
}

async function saveRecord(s: LiveSnapshot, run: RunState, endedAt: number) {
  const record: SessionRecord = {
    startedAt: s.startedAt,
    endedAt,
    durationSec: Math.round(activeMs(run, s.startedAt, endedAt) / 1000),
    type: s.type,
    origin: s.origin,
    phase: settings.phase,
    exercises: s.items.map((i, k) => ({ id: i.exerciseId, status: run.statuses[k] })),
  };
  const id = await addSession(record);
  if (s.rotationAfter) await saveSetting('rotation', s.rotationAfter);
  renderEnd(record, id);
}

function renderEnd(record: SessionRecord, id: number) {
  const counted = counts(record);
  app.innerHTML = `
  <main class="end">
    <h1>Séance enregistrée</h1>
    <p class="big-num">${fmtDuration(record.durationSec)}</p>
    <p class="muted">${counted ? 'Elle compte dans ta semaine.' : 'Aucun exercice fait : elle ne compte pas dans tes statistiques.'}</p>
    <ul class="results">${record.exercises
      .map(
        (e) =>
          `<li class="${e.status}"><span>${esc(EXERCISES[e.id].name)}</span><span>${e.status === 'done' ? 'Fait' : 'Sauté'}</span></li>`,
      )
      .join('')}</ul>
    <button class="primary big" id="home">Retour à l’accueil</button>
    <button class="link danger" id="del">Supprimer cette séance</button>
  </main>`;
  app.querySelector('#home')!.addEventListener('click', () => navigate('home'));
  app.querySelector('#del')!.addEventListener('click', async () => {
    const ok = await ask({
      title: 'Supprimer cette séance ?',
      text: 'Elle disparaîtra de l’historique et des statistiques.',
      actions: [
        { id: 'del', label: 'Supprimer', style: 'danger' },
        { id: 'back', label: 'Garder', style: 'secondary' },
      ],
    });
    if (ok !== 'del') return;
    await deleteSession(id);
    toast('Séance supprimée.');
    navigate('home');
  });
}

/** Écran verrouillé, autre app : on note l'heure de départ et on rattrape au retour. */
export function onVisibility(visible: boolean) {
  const l = live;
  if (!l) return;
  const now = Date.now();
  if (!visible) {
    l.hiddenAt = now;
    persist();
    return;
  }
  let autoPaused = false;
  if (l.hiddenAt !== null) {
    const r = resumeAfterAbsence(l.run, l.hiddenAt, now, MAX_ABSENCE_MS);
    l.run = r.state;
    l.hiddenAt = null;
    autoPaused = r.autoPaused;
  }
  tick();
  // Après tick : l'écran a pu être reconstruit si l'exercice a changé.
  if (autoPaused && live === l && l.refs) {
    l.refs.banner.textContent = 'Séance mise en pause pendant ton absence. Touche « Reprendre » pour continuer.';
    l.refs.banner.hidden = false;
  }
}
