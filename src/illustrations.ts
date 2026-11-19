import { esc } from './ui';

/**
 * Illustrations intégrées au code en SVG : elles prennent les polices de la charte
 * (Archivo, Fragment Mono) et restent disponibles hors ligne.
 * Fichiers convertis au style des schémas ROBIN.PIQUET par scripts/brand-illustrations.mjs.
 */
const files = import.meta.glob<string>('./illustrations/*.svg', { query: '?raw', import: 'default', eager: true });

export function illustration(file: string, label: string): string {
  const svg = files[`./illustrations/${file}`] ?? '';
  return `<figure class="illus" role="img" aria-label="${esc(label)}">${svg}</figure>`;
}
