// Le stock de Soulbound et ses règles, sans dépendre d'Owlbear (testé dans test/model.test.ts).
//
// Deux sortes d'entrées :
// - « p » (persistant) : un token précis, PJ ou PNJ nommé, marqué à la main. Son item porte
//   PID_KEY ; ses données sont sauvegardées à chaque changement et restaurées ailleurs.
// - « m » (modèle) : les données de départ de tous les tokens d'une même image (le rat).
//   Chaque rat posé les reçoit, puis vit sa vie : ses PV ne remontent pas dans le modèle.
//
// Chaque entrée est rangée sous sa propre clé dans les metadata de la scène : deux MJ qui
// écrivent deux entrées différentes ne s'écrasent pas. Une entrée supprimée reste comme
// pierre tombale, pour que la fusion ne la fasse pas revenir depuis une vieille copie.

export const PLUGIN_ID = "soulbound";
/** Préfixe des entrées dans les metadata de la scène. */
export const ENTRY_PREFIX = `${PLUGIN_ID}/e/`;
/** Sur l'item : identifiant du token persistant. */
export const PID_KEY = `${PLUGIN_ID}/pid`;
/** Dans la room : journal des derniers changements. */
export const JOURNAL_KEY = `${PLUGIN_ID}/journal`;
/** Dans la room : réglages partagés (clés ignorées, pause). */
export const SETTINGS_KEY = `${PLUGIN_ID}/settings`;

/** La room est limitée à 16 Ko au total : le journal en prend au plus 10. */
export const MAX_JOURNAL_BYTES = 10 * 1024;
/** Garde-fou sur le stock dans la scène (Owlbear a accepté 512 Ko lors de nos tests). */
export const MAX_STORE_BYTES = 400 * 1024;

export type Kind = "p" | "m";
export type Data = Record<string, unknown>;

export interface Entry {
  kind: Kind;
  /** Empreinte de l'image (son URL) : relie un nouveau token à son modèle ou à son persistant. */
  fp: string;
  name: string;
  /** Les metadata des autres extensions, telles que sur le token. */
  data: Data;
  /** Date de la dernière modification (ms) : la plus récente gagne à la fusion. */
  updated: number;
  deleted?: true;
}

/** Clé de l'entrée (« p:<pid> » ou « m:<hash> ») → entrée. */
export type Store = Record<string, Entry>;

export interface Settings {
  /** Préfixes de clés de metadata à ne jamais sauvegarder ni restaurer. */
  exclude: string[];
  paused: boolean;
}

export const DEFAULT_SETTINGS: Settings = { exclude: [], paused: false };

export interface Journal {
  /** Date de la modification la plus récente connue dans la room, même si elle n'a pas tenu dans le journal. */
  latest: number;
  entries: Store;
}

export const EMPTY_JOURNAL: Journal = { latest: 0, entries: {} };

export const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value) ?? "").length;

/** FNV-1a 32 bits : une clé courte pour l'URL d'une image. */
export function hash(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export const modelId = (fp: string) => `m:${hash(fp)}`;
export const persistentId = (pid: string) => `p:${pid}`;

export function newPid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/** JSON aux clés triées : deux objets égaux donnent le même texte. */
export function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .filter((key) => object[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export const sameData = (a: Data, b: Data) => stable(a) === stable(b);

/** Cette clé de metadata appartient-elle aux données gardées ? */
export function isKept(key: string, exclude: string[]) {
  if (key.startsWith(`${PLUGIN_ID}/`)) return false;
  return !exclude.some((prefix) => prefix && key.startsWith(prefix));
}

/** Ce que Soulbound garde des metadata d'un token. */
export function capture(metadata: Data, exclude: string[]): Data {
  const data: Data = {};
  for (const [key, value] of Object.entries(metadata)) if (value !== undefined && isKept(key, exclude)) data[key] = value;
  return data;
}

/** Les extensions dont un token porte des données : la partie de la clé avant le dernier « / ». */
export function extensionsOf(data: Data) {
  return [...new Set(Object.keys(data).map((key) => (key.includes("/") ? key.slice(0, key.lastIndexOf("/")) : key)))].sort();
}

/**
 * Changements à faire sur les metadata d'un token pour qu'il porte exactement ces données.
 * `replace` retire aussi les données gardées absentes de l'entrée (token persistant) ;
 * sans lui, on ne fait qu'ajouter (modèle posé sur un token neuf). Null s'il n'y a rien à faire.
 */
export function patchFor(metadata: Data, data: Data, exclude: string[], replace: boolean) {
  const set: Data = {};
  const remove: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (!isKept(key, exclude)) continue;
    if (stable(metadata[key]) !== stable(value)) set[key] = value;
  }
  if (replace) for (const key of Object.keys(capture(metadata, exclude))) if (!(key in data)) remove.push(key);
  return Object.keys(set).length || remove.length ? { set, remove } : null;
}

/** La plus récente des deux ; à égalité, un ordre fixe, pour que tous les clients choisissent pareil. */
export function newer(a: Entry | undefined, b: Entry | undefined): Entry | undefined {
  if (!a) return b;
  if (!b) return a;
  if (a.updated !== b.updated) return a.updated > b.updated ? a : b;
  return stable(a) >= stable(b) ? a : b;
}

/** Fusion entrée par entrée : la plus récente gagne. Sans ordre ni doublon à craindre. */
export function merge(...stores: (Store | undefined)[]): Store {
  const result: Store = {};
  for (const store of stores) {
    if (!store) continue;
    for (const [id, entry] of Object.entries(store)) if (isEntry(entry)) result[id] = newer(result[id], entry)!;
  }
  return result;
}

/** Les entrées de `merged` que `base` n'a pas, ou pas dans cette version. */
export function diff(base: Store, merged: Store): Store {
  const changed: Store = {};
  for (const [id, entry] of Object.entries(merged)) if (!base[id] || stable(base[id]) !== stable(entry)) changed[id] = entry;
  return changed;
}

export const latest = (store: Store) => Object.values(store).reduce((max, entry) => Math.max(max, entry.updated), 0);

export const live = (store: Store) => Object.entries(store).filter(([, entry]) => !entry.deleted);

export function isEntry(value: unknown): value is Entry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Entry;
  return (entry.kind === "p" || entry.kind === "m") && typeof entry.fp === "string" && typeof entry.updated === "number" && !!entry.data && typeof entry.data === "object";
}

/** Le stock, lu dans les metadata d'une scène. */
export function storeFromMetadata(metadata: Data): Store {
  const store: Store = {};
  for (const [key, value] of Object.entries(metadata)) if (key.startsWith(ENTRY_PREFIX) && isEntry(value)) store[key.slice(ENTRY_PREFIX.length)] = value;
  return store;
}

export function metadataFromStore(store: Store): Data {
  const metadata: Data = {};
  for (const [id, entry] of Object.entries(store)) metadata[ENTRY_PREFIX + id] = entry;
  return metadata;
}

export function tombstone(entry: Entry, now: number): Entry {
  return { kind: entry.kind, fp: entry.fp, name: entry.name, data: {}, updated: Math.max(now, entry.updated + 1), deleted: true };
}

/**
 * Ajoute des changements au journal de la room, puis retire les plus anciens tant qu'il dépasse
 * la taille permise. `latest` garde la date du plus récent, même s'il était trop gros pour y tenir :
 * une scène en retard saura ainsi qu'il lui manque quelque chose.
 */
export function pushJournal(journal: Journal, changes: Store, maxBytes = MAX_JOURNAL_BYTES): Journal {
  const entries = merge(journal.entries, changes);
  const next: Journal = { latest: Math.max(journal.latest, latest(changes)), entries };
  const order = Object.entries(entries).sort(([, a], [, b]) => a.updated - b.updated);
  while (order.length && bytes(next) > maxBytes) delete next.entries[order.shift()![0]];
  return next;
}

export function parseJournal(value: unknown): Journal {
  if (!value || typeof value !== "object") return { ...EMPTY_JOURNAL, entries: {} };
  const raw = value as Partial<Journal>;
  return { latest: typeof raw.latest === "number" ? raw.latest : 0, entries: merge(raw.entries as Store) };
}

export function parseSettings(value: unknown): Settings {
  const raw = (value && typeof value === "object" ? value : {}) as Partial<Settings>;
  return {
    exclude: Array.isArray(raw.exclude) ? raw.exclude.filter((prefix): prefix is string => typeof prefix === "string" && !!prefix.trim()) : [],
    paused: raw.paused === true,
  };
}

/** Une modification plus récente que tout ce que l'on a retrouvé : elle s'est perdue. */
export const isMissing = (store: Store, journal: Journal) => journal.latest > latest(store);

export interface TokenInfo {
  id: string;
  fp: string;
  name: string;
  pid?: string;
}

/**
 * Persistants absents de la scène qui pourraient être ce token neuf : même image.
 * `exact` : même image et même nom. Soulbound ne restaure seul que s'il y en a exactement un ;
 * sinon, le MJ choisit dans le panneau.
 */
export function candidatesFor(token: Pick<TokenInfo, "fp" | "name">, store: Store, presentPids: Set<string>) {
  const all = live(store)
    .filter(([id, entry]) => entry.kind === "p" && entry.fp === token.fp && !presentPids.has(id.slice(2)))
    .sort(([, a], [, b]) => b.updated - a.updated);
  const name = token.name.trim().toLowerCase();
  return { all, exact: all.filter(([, entry]) => entry.name.trim().toLowerCase() === name) };
}

/**
 * Une image a soit un modèle, soit des persistants, jamais les deux : sinon un token neuf de
 * cette image ne saurait pas s'il est une instance du persistant ou une créature tirée du modèle.
 */
export const hasModel = (store: Store, fp: string) => {
  const model = store[modelId(fp)];
  return !!model && !model.deleted;
};

export const persistentsOf = (store: Store, fp: string) => live(store).filter(([, entry]) => entry.kind === "p" && entry.fp === fp);

/** Le fichier d'export : le stock entier, pierres tombales comprises. */
export function exportStore(store: Store) {
  return JSON.stringify({ format: "soulbound", version: 1, exported: Date.now(), entries: store }, null, 1);
}

export function importStore(text: string): Store {
  const parsed = JSON.parse(text) as { format?: string; entries?: unknown };
  if ((parsed?.format !== "soulbound" && parsed?.format !== "mnemo") || !parsed.entries || typeof parsed.entries !== "object") throw new Error("format");
  return merge(parsed.entries as Store);
}
