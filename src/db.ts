/** Stockage local IndexedDB : réglages (kv) et séances. Rien ne sort du téléphone. */
import type { Phase } from './exercises';
import type { SessionType } from './routines';
import type { ExerciseStatus } from './timer';

export interface SessionRecord {
  id?: number;
  startedAt: number;
  endedAt: number;
  /** Durée active, pauses exclues. */
  durationSec: number;
  type: SessionType;
  origin: 'rappel' | 'manuelle';
  phase?: Phase;
  exercises: { id: string; status: ExerciseStatus }[];
}

let dbp: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('cyphose', 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      d.createObjectStore('kv');
      d.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true }).createIndex('startedAt', 'startedAt');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const tx = d.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export const kvGet = <T>(key: string, fallback: T): Promise<T> =>
  run<T | undefined>('kv', 'readonly', (s) => s.get(key)).then((v) => (v === undefined ? fallback : v));

export const kvSet = (key: string, value: unknown) => run('kv', 'readwrite', (s) => s.put(value, key));
export const kvDel = (key: string) => run('kv', 'readwrite', (s) => s.delete(key));

export const addSession = (r: SessionRecord): Promise<number> =>
  run<IDBValidKey>('sessions', 'readwrite', (s) => s.add(r)).then(Number);

export const deleteSession = (id: number) => run('sessions', 'readwrite', (s) => s.delete(id));

export const allSessions = (): Promise<SessionRecord[]> => run('sessions', 'readonly', (s) => s.index('startedAt').getAll());

export const sessionsSince = (ms: number): Promise<SessionRecord[]> =>
  run('sessions', 'readonly', (s) => s.index('startedAt').getAll(IDBKeyRange.lowerBound(ms)));

/** Demande à iOS de ne pas effacer les données (sans garantie). */
export function requestPersistence() {
  navigator.storage?.persist?.().catch(() => {});
}
