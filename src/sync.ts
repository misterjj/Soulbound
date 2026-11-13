// Lecture et écriture du stock dans Owlbear, partagées par la page de fond et le panneau.
// Trois copies : la scène ouverte (source de vérité, synchronisée en direct chez tous),
// le journal de la room (derniers changements, 16 Ko au plus) et le cache de ce navigateur.

import OBR, { isImage, type Item } from "@owlbear-rodeo/sdk";
import {
  JOURNAL_KEY,
  MAX_STORE_BYTES,
  PID_KEY,
  SETTINGS_KEY,
  bytes,
  capture,
  hasModel,
  merge,
  metadataFromStore,
  modelId,
  newPid,
  parseJournal,
  parseSettings,
  patchFor,
  persistentId,
  persistentsOf,
  pushJournal,
  storeFromMetadata,
  tombstone,
  type Entry,
  type Journal,
  type Settings,
  type Store,
  type TokenInfo,
} from "./model";

/** Calques où vivent les tokens : pas la carte, ni les dessins, ni les notes. */
const TOKEN_LAYERS = new Set(["CHARACTER", "MOUNT", "PROP"]);

export function tokenInfo(item: Item): TokenInfo | null {
  if (!isImage(item) || !TOKEN_LAYERS.has(item.layer)) return null;
  const pid = item.metadata[PID_KEY];
  return { id: item.id, fp: item.image.url, name: item.text?.plainText?.trim() || item.name, pid: typeof pid === "string" ? pid : undefined };
}

export class StoreTooLargeError extends Error {}

// --- Cache du navigateur ---------------------------------------------------------------------

const cacheKey = () => `soulbound/cache/${OBR.room.id}`;

export function readCache(): Store {
  try {
    return merge(JSON.parse(localStorage.getItem(cacheKey()) ?? "{}") as Store);
  } catch {
    return {};
  }
}

export function writeCache(changes: Store) {
  try {
    localStorage.setItem(cacheKey(), JSON.stringify(merge(readCache(), changes)));
  } catch {
    // Cache plein ou bloqué : la scène et le journal restent les copies de référence.
  }
}

// --- Scène, room -------------------------------------------------------------------------------

export const readStore = async () => storeFromMetadata(await OBR.scene.getMetadata());

export const readJournal = async (): Promise<Journal> => parseJournal((await OBR.room.getMetadata())[JOURNAL_KEY]);

export const readSettings = async (): Promise<Settings> => parseSettings((await OBR.room.getMetadata())[SETTINGS_KEY]);

export const writeSettings = (settings: Settings) => OBR.room.setMetadata({ [SETTINGS_KEY]: settings });

/** Enregistre des entrées dans les trois copies. */
export async function writeEntries(changes: Store) {
  if (!Object.keys(changes).length) return;
  const current = await readStore();
  if (bytes(metadataFromStore(merge(current, changes))) > MAX_STORE_BYTES) throw new StoreTooLargeError();
  writeCache(changes);
  await OBR.scene.setMetadata(metadataFromStore(changes));
  // Le journal n'est qu'un filet : son échec ne doit pas faire échouer la sauvegarde.
  try {
    await OBR.room.setMetadata({ [JOURNAL_KEY]: pushJournal(await readJournal(), changes) });
  } catch (error) {
    console.warn("[Soulbound] journal", error);
  }
}

/** Met ces données sur un token. `replace` : retire aussi les données gardées qu'elles n'ont pas. */
export async function applyData(item: Item, data: Store[string]["data"], exclude: string[], replace: boolean, extra: Record<string, unknown> = {}) {
  const patch = patchFor(item.metadata, data, exclude, replace);
  const extras = Object.entries(extra).filter(([key, value]) => item.metadata[key] !== value);
  if (!patch && !extras.length) return false;
  await OBR.scene.items.updateItems([item.id], (drafts) => {
    for (const draft of drafts) {
      if (patch) {
        for (const key of patch.remove) delete draft.metadata[key];
        Object.assign(draft.metadata, structuredClone(patch.set));
      }
      for (const [key, value] of extras) {
        if (value === undefined) delete draft.metadata[key];
        else draft.metadata[key] = value;
      }
    }
  });
  return true;
}

// --- Actions du MJ -----------------------------------------------------------------------------

/**
 * Marque ces tokens comme persistants et sauvegarde leurs données tout de suite.
 * Les tokens dont l'image a un modèle sont refusés (`blocked`).
 */
export async function makePersistent(items: Item[]) {
  const [{ exclude }, store] = await Promise.all([readSettings(), fullStore()]);
  const now = Date.now();
  const changes: Store = {};
  const pids = new Map<string, string>();
  let blocked = 0;
  for (const item of items) {
    const token = tokenInfo(item);
    if (!token) continue;
    if (hasModel(store, token.fp)) {
      blocked++;
      continue;
    }
    const pid = token.pid ?? newPid();
    pids.set(item.id, pid);
    changes[persistentId(pid)] = { kind: "p", fp: token.fp, name: token.name, data: capture(item.metadata, exclude), updated: now };
  }
  await writeEntries(changes);
  if (pids.size) await OBR.scene.items.updateItems([...pids.keys()], (drafts) => drafts.forEach((draft) => (draft.metadata[PID_KEY] = pids.get(draft.id))));
  return { made: pids.size, blocked };
}

/**
 * Ces tokens ne sont plus suivis. S'il reste d'autres instances du même persistant dans la scène,
 * ceux-ci sont seulement détachés (ils deviennent des créatures à part) ; sinon l'entrée est supprimée.
 */
export async function forget(items: Item[]) {
  const [store, all] = await Promise.all([readStore(), OBR.scene.items.getItems()]);
  const chosen = new Set(items.map((item) => item.id));
  const now = Date.now();
  const changes: Store = {};
  for (const item of items) {
    const pid = tokenInfo(item)?.pid;
    const entry = pid && store[persistentId(pid)];
    const others = all.some((other) => !chosen.has(other.id) && tokenInfo(other)?.pid === pid);
    if (entry && !others) changes[persistentId(pid)] = tombstone(entry, now);
  }
  await writeEntries(changes);
  await OBR.scene.items.updateItems(
    items.map((item) => item.id),
    (drafts) => drafts.forEach((draft) => delete draft.metadata[PID_KEY]),
  );
}

/** Les données de ce token deviennent le modèle de son image, sauf si cette image a des persistants. */
export async function saveModel(item: Item): Promise<"saved" | "blocked" | "notToken"> {
  const token = tokenInfo(item);
  if (!token || token.pid) return "notToken";
  const [{ exclude }, store] = await Promise.all([readSettings(), fullStore()]);
  if (persistentsOf(store, token.fp).length) return "blocked";
  const data = capture(item.metadata, exclude);
  await writeEntries({ [modelId(token.fp)]: { kind: "m", fp: token.fp, name: token.name, data, updated: Date.now() } });
  return "saved";
}

/** Supprime une entrée. Un persistant présent dans la scène redevient un token ordinaire. */
export async function deleteEntry(id: string) {
  const store = await readStore();
  const entry = store[id];
  if (!entry) return;
  await writeEntries({ [id]: tombstone(entry, Date.now()) });
  if (entry.kind === "p") {
    const pid = id.slice(2);
    await OBR.scene.items.updateItems(
      (item) => item.metadata[PID_KEY] === pid,
      (drafts) => drafts.forEach((draft) => delete draft.metadata[PID_KEY]),
    );
  }
}

/** Ce token devient ce persistant (une instance de plus s'il est déjà sur la scène) : il reçoit son identifiant et ses données. */
export async function restoreInto(id: string, item: Item, entry: Entry) {
  const { exclude } = await readSettings();
  await applyData(item, entry.data, exclude, true, { [PID_KEY]: id.slice(2) });
}

/** Le stock le plus complet que ce navigateur puisse voir : scène, cache et journal. */
export async function fullStore() {
  const [scene, journal] = await Promise.all([readStore(), readJournal()]);
  return merge(scene, readCache(), journal.entries);
}
