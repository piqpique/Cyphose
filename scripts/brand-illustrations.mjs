// Passe les illustrations au style des schémas ROBIN.PIQUET (fond sombre surface-raised) :
// traits crème, repères et accessoires atténués, ce qui bouge en ambre, étiquettes Fragment Mono.
// Idempotent : les couleurs déjà converties ne sont pas retouchées.
// Usage : node scripts/brand-illustrations.mjs src/illustrations
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const COLORS = {
  '#1d1d1b': '#F0EDE4', // trait principal → creme (ink)
  '#6f6f6a': '#9AA39D', // étiquettes, segments secondaires → ink-3
  '#9b9b94': '#6E7872', // accessoires, sol, positions de départ → atténué
  '#c8642a': '#E08A2E', // flèches, ce qui bouge → ambre
  '#eeebe3': '#232A2B', // aplats clairs (mur, rouleau) → un cran au-dessus de surface-raised
};
const MONO = `'Fragment Mono', ui-monospace, Menlo, monospace`;
const DISPLAY = `Archivo, 'Helvetica Neue', Arial, sans-serif`;

const dir = process.argv[2];
for (const f of readdirSync(dir).filter((n) => n.endsWith('.svg'))) {
  const p = join(dir, f);
  let s = readFileSync(p, 'utf8');
  s = s.replace(/(fill|stroke)="(#[0-9a-fA-F]{6})"/g, (m, attr, c) => `${attr}="${COLORS[c.toLowerCase()] ?? c}"`);
  s = s.replace(/font-family="Inter, DejaVu Sans, sans-serif"/g, `font-family="${DISPLAY}"`);
  // Étiquettes (12,5 px, ou 13 px en gris) : Fragment Mono 10 px, la taille des étiquettes de figures de la charte.
  s = s.replace(/<text([^>]*?) font-size="12\.5"([^>]*)>/g, `<text$1 font-size="10" font-family="${MONO}" letter-spacing="0.4"$2>`);
  s = s.replace(/<text([^>]*?) font-size="13"([^>]*fill="#9AA39D"[^>]*)>/g, `<text$1 font-size="10" font-family="${MONO}" letter-spacing="0.4"$2>`);
  // Passage précédent à 11 px : ramené à 10 px.
  s = s.replace(/ font-size="11" font-family="'Fragment Mono'/g, ` font-size="10" font-family="'Fragment Mono'`);
  s = s.replace(/font-weight="600"/g, 'font-weight="700"');
  writeFileSync(p, s);
}
