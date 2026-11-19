import type { SessionRecord } from './db';
import { SESSION_LABELS } from './routines';
import { isoDate } from './schedule';

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const cell = (v: string | number) => {
  const s = String(v);
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Export CSV des séances. Séparateur « ; » et BOM UTF-8 pour qu'Excel et
 * Numbers en français ouvrent le fichier correctement (accents, colonnes).
 */
export function toCsv(records: SessionRecord[], nameOf: (id: string) => string): string {
  const header = ['date', 'debut', 'fin', 'duree_s', 'type', 'origine', 'phase', 'exercices_faits', 'exercices_sautes', 'detail'];
  const rows = [...records]
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((r) => {
      const done = r.exercises.filter((e) => e.status === 'done').length;
      return [
        isoDate(new Date(r.startedAt)),
        hhmm(r.startedAt),
        hhmm(r.endedAt),
        r.durationSec,
        SESSION_LABELS[r.type],
        r.origin,
        r.phase ?? '',
        done,
        r.exercises.length - done,
        r.exercises.map((e) => `${nameOf(e.id)} : ${e.status === 'done' ? 'fait' : 'sauté'}`).join(' | '),
      ];
    });
  return '﻿' + [header, ...rows].map((row) => row.map(cell).join(';')).join('\r\n') + '\r\n';
}
