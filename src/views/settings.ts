import { toCsv } from '../csv';
import { allSessions } from '../db';
import { EXERCISES, type Phase } from '../exercises';
import { PHASES, phaseWeekLabel } from '../phases';
import {
  DAY_LABELS,
  fmtMin,
  isoDate,
  microSlots,
  scheduleError,
  WEEKDAYS,
  type DayType,
  type ScheduleSettings,
  type Weekday,
} from '../schedule';
import { saveSetting, setPhase, settings } from '../state';
import { illustration } from '../illustrations';
import { app, ask, bindTabs, esc, tabbar, toast } from '../ui';

const PLANNING_TYPES: DayType[] = ['bureau', 'teletravail', 'conge'];
const INTERVALS = [60, 65, 70, 75, 80, 85, 90];

const slotsPreview = (s: ScheduleSettings) => microSlots(s).map(fmtMin).join(' · ') || 'aucun';

export function renderSettings() {
  const s = settings.schedule;
  const today = isoDate(new Date());
  const time = (key: keyof ScheduleSettings, label: string) =>
    `<label>${label}<input type="time" data-time="${key}" value="${esc(String(s[key]))}" required></label>`;

  app.innerHTML = `
  <main class="with-tabs settings-page">
    <h1>Réglages</h1>

    <section class="card settings">
      <h2>Phase</h2>
      <label>Phase actuelle
        <select id="phase">${([1, 2, 3, 4] as Phase[])
          .map((p) => `<option value="${p}" ${p === settings.phase ? 'selected' : ''}>${p}. ${PHASES[p].name}</option>`)
          .join('')}</select>
      </label>
      <p class="muted">${phaseWeekLabel(settings.phase, settings.phaseStart, today)}. Les doses des séances suivent la phase.</p>
      ${
        settings.phase === 4
          ? '<button class="secondary" id="back2">Mon dos s’arrondit à nouveau : revenir en phase 2</button>'
          : ''
      }
      <details><summary>Les 4 phases</summary>${illustration('phases.svg', 'Les 4 phases du protocole et leurs critères de passage')}</details>
    </section>

    <section class="card settings">
      <h2>Planning de la semaine</h2>
      ${WEEKDAYS.map(
        (d) => `<label>${d.label}
          <select data-planning="${d.day}">${PLANNING_TYPES.map(
            (t) => `<option value="${t}" ${settings.planning[d.day] === t ? 'selected' : ''}>${DAY_LABELS[t]}</option>`,
          ).join('')}</select></label>`,
      ).join('')}
      <p class="muted">Pour un seul jour (congé, journée au bureau imprévue), change-le depuis l’accueil.</p>
    </section>

    <section class="card settings">
      <h2>Horaires</h2>
      ${time('firstSlot', 'Premier créneau')}
      <label>Intervalle
        <select data-interval>${INTERVALS.map((m) => `<option value="${m}" ${m === s.intervalMin ? 'selected' : ''}>${m} min</option>`).join('')}</select>
      </label>
      ${time('dayEnd', 'Fin des créneaux')}
      ${time('lunchStart', 'Pause de midi : début')}
      ${time('lunchEnd', 'Pause de midi : fin')}
      ${time('homeTime', 'Rappel routine maison')}
      <p class="muted" id="slots">Créneaux : ${slotsPreview(s)}</p>
      <p class="error" id="schedule-error" role="alert" hidden></p>
    </section>

    <section class="card settings">
      <h2>Son et voix</h2>
      <label class="row">Son (maison et télétravail)<input type="checkbox" data-flag="sound" ${settings.sound ? 'checked' : ''}></label>
      <label class="row">Son pendant le set discret du bureau<input type="checkbox" data-flag="soundBureau" ${settings.soundBureau ? 'checked' : ''}></label>
      <label class="row">Annonces vocales (maison et télétravail)<input type="checkbox" data-flag="voice" ${settings.voice ? 'checked' : ''}></label>
      <p class="muted">Les annonces donnent le nom de l’exercice, les changements de côté, la respiration et les longues tenues. Le set discret reste muet par défaut.</p>
    </section>

    <section class="card settings">
      <h2>Données</h2>
      <p class="muted">Tes séances restent sur cet iPhone, rien n’est envoyé ailleurs. Exporte-les de temps en temps pour en garder une copie.</p>
      <button class="secondary" id="export">Exporter les séances (CSV)</button>
    </section>

    <section class="card settings">
      <h2>Poste de travail</h2>
      <details><summary>Réglage du poste</summary>${illustration('poste.svg', 'Réglage du poste : haut de l’écran au niveau des yeux, dos contre le dossier')}</details>
    </section>

    <p class="version">Version du ${esc(__BUILD__)}</p>
  </main>
  ${tabbar('settings')}`;

  bindTabs();

  app.querySelector<HTMLSelectElement>('#phase')!.addEventListener('change', async (e) => {
    const p = Number((e.target as HTMLSelectElement).value) as Phase;
    await setPhase(p);
    toast(`Phase ${p} : ${PHASES[p].name}.`);
    renderSettings();
  });
  app.querySelector('#back2')?.addEventListener('click', async () => {
    const ok = await ask({
      title: 'Revenir en phase 2 ?',
      text: 'Les doses de renforcement reprennent pour au moins 8 semaines.',
      actions: [
        { id: 'yes', label: 'Revenir en phase 2', style: 'primary' },
        { id: 'no', label: 'Annuler', style: 'link' },
      ],
    });
    if (ok !== 'yes') return;
    await setPhase(2);
    toast('Phase 2 : Renforcement.');
    renderSettings();
  });

  app.querySelectorAll<HTMLSelectElement>('[data-planning]').forEach((sel) =>
    sel.addEventListener('change', () =>
      saveSetting('planning', { ...settings.planning, [Number(sel.dataset.planning) as Weekday]: sel.value as DayType }),
    ),
  );

  const scheduleChanged = () => {
    const next: ScheduleSettings = { ...settings.schedule };
    app.querySelectorAll<HTMLInputElement>('[data-time]').forEach((i) => {
      (next as unknown as Record<string, string>)[i.dataset.time!] = i.value;
    });
    next.intervalMin = Number(app.querySelector<HTMLSelectElement>('[data-interval]')!.value);
    const err = scheduleError(next);
    const errEl = app.querySelector<HTMLElement>('#schedule-error')!;
    errEl.hidden = !err;
    errEl.textContent = err ? `${err} Les horaires ne sont pas enregistrés.` : '';
    if (err) return;
    saveSetting('schedule', next);
    app.querySelector('#slots')!.textContent = `Créneaux : ${slotsPreview(next)}`;
  };
  app.querySelectorAll('[data-time], [data-interval]').forEach((i) => i.addEventListener('change', scheduleChanged));

  app.querySelectorAll<HTMLInputElement>('[data-flag]').forEach((c) =>
    c.addEventListener('change', () => saveSetting(c.dataset.flag as 'sound' | 'soundBureau' | 'voice', c.checked)),
  );

  app.querySelector('#export')!.addEventListener('click', exportCsv);
}

/** Partage du fichier (menu iOS : Fichiers, Mail…) ou téléchargement si le partage n'existe pas. */
async function exportCsv() {
  const records = await allSessions();
  if (!records.length) return toast('Aucune séance à exporter.');
  const name = `cyphose-${isoDate(new Date())}.csv`;
  const file = new File([toCsv(records, (id) => EXERCISES[id]?.name ?? id)], name, { type: 'text/csv' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Séances Cyphose' });
      return;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
