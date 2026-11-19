import { sessionsSince } from '../db';
import { PHASES, phaseProposal, phaseWeekLabel, snoozeDate } from '../phases';
import { buildPlan, type SessionType } from '../routines';
import { DAY_LABELS, dayKind, fmtMin, isoDate, mondayOf, nextSlot, type DayType } from '../schedule';
import { saveSetting, setOverride, setPhase, settings } from '../state';
import { weekStats } from '../stats';
import { app, bindTabs, esc, fmtDay, fmtMinutes, tabbar, toast } from '../ui';
import { openSession, planDuration } from './player';

const durationOf = (type: SessionType) =>
  fmtMinutes(planDuration(buildPlan(type, settings.phase, settings.rotation, '', { voice: settings.voice && type !== 'bureau' }).items));

export async function renderHome() {
  const now = new Date();
  const today = isoDate(now);
  const kind = dayKind(now, settings.planning, settings.overrides);
  const next = nextSlot(now, kind, settings.schedule);
  const monday = mondayOf(now);
  const week = weekStats(await sessionsSince(monday.getTime()), monday, now, settings);
  const phase = PHASES[settings.phase];
  const proposal = phaseProposal(settings.phase, settings.phaseStart, settings.phaseSnooze, today);

  const microType: SessionType = kind === 'bureau' ? 'bureau' : 'teletravail';
  const dayButtons =
    kind === 'weekend'
      ? `<p class="muted">Pas de micro-séance le week-end.</p>`
      : `<div class="seg" role="group" aria-label="Type du jour">${(['bureau', 'teletravail', 'conge'] as DayType[])
          .map((t) => `<button data-day="${t}" class="${t === kind ? 'on' : ''}" aria-pressed="${t === kind}">${DAY_LABELS[t]}</button>`)
          .join('')}</div>`;

  const nextText = next
    ? next.what === 'micro'
      ? `Prochaine micro-séance à <b>${fmtMin(next.min)}</b>`
      : `Routine maison à <b>${fmtMin(next.min)}</b>`
    : `Plus de créneau aujourd’hui.`;

  // En entretien, la version courte devient la séance principale.
  const main: SessionType = settings.phase === 4 ? 'maison-courte' : 'maison';
  const other: SessionType = main === 'maison' ? 'maison-courte' : 'maison';
  const label = (t: SessionType) => (t === 'maison' ? 'Routine maison complète' : 'Routine maison courte');

  app.innerHTML = `
  <main class="home with-tabs">
    <header class="entete">
      <div class="entete-haut">
        <span class="marque" aria-label="ROBIN.PIQUET">Robin<span class="point" aria-hidden="true">.</span>Piquet</span>
        <span class="label">${esc(fmtDay(now))}</span>
      </div>
      <h1>Cyphose</h1>
      <p class="label">Phase ${settings.phase} · ${phase.name} · ${phaseWeekLabel(settings.phase, settings.phaseStart, today)}</p>
    </header>

    ${
      proposal
        ? `<section class="card proposal">
      <h2>Passer en phase ${proposal.next} ?</h2>
      <p>Tu as fait ${proposal.weeks} semaines en phase ${settings.phase}. Passe à la phase ${proposal.next} (${PHASES[proposal.next].name.toLowerCase()}) si :</p>
      <p class="criterion">${esc(proposal.criterion)}</p>
      <button class="secondary" id="phase-yes">C’est validé : passer en phase ${proposal.next}</button>
      <button class="link" id="phase-later">Pas encore, redemander dans 7 jours</button>
    </section>`
        : ''
    }

    <section class="card">
      <h2>Aujourd’hui</h2>
      ${dayButtons}
      <p class="next-slot">${nextText}</p>
    </section>

    <section class="actions">
      <button class="primary big" data-start="${main}">${label(main)}<small>${durationOf(main)}</small></button>
      <button class="secondary" data-start="${other}">${label(other)}<small>${durationOf(other)}</small></button>
      <button class="secondary" data-start="${microType}">Micro-séance maintenant<small>${
        microType === 'bureau' ? 'set discret, assis' : 'set complet'
      } · ${durationOf(microType)}</small></button>
      ${phase.hint ? `<p class="muted center">${esc(phase.hint)}</p>` : ''}
    </section>

    <section class="card bloc">
      <h2>Cette semaine</h2>
      <div class="stats">
        <div><span class="num">${week.homeDays}<small>/7</small></span><span class="muted">jours avec routine maison · objectif ${phase.goalText}</span></div>
        <div><span class="num">${week.micro}<small>/${week.planned}</small></span><span class="muted">micro-séances · créneaux prévus</span></div>
      </div>
      <button class="link" data-nav="history">Voir l’historique</button>
    </section>
  </main>
  ${tabbar('home')}`;

  bindTabs();
  app.querySelectorAll<HTMLButtonElement>('[data-day]').forEach((b) =>
    b.addEventListener('click', async () => {
      await setOverride(today, b.dataset.day as DayType);
      renderHome();
    }),
  );
  app.querySelectorAll<HTMLButtonElement>('[data-start]').forEach((b) =>
    b.addEventListener('click', () => openSession(b.dataset.start as SessionType, 'manuelle', true)),
  );
  app.querySelector('#phase-yes')?.addEventListener('click', async () => {
    await setPhase(proposal!.next);
    toast(`Phase ${proposal!.next} : ${PHASES[proposal!.next].name}. Les doses sont mises à jour.`);
    renderHome();
  });
  app.querySelector('#phase-later')?.addEventListener('click', async () => {
    await saveSetting('phaseSnooze', snoozeDate(today));
    renderHome();
  });
}
