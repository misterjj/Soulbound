// Page de fond : chez le MJ, suit les tokens, sauvegarde les persistants et restaure les nouveaux.
//
// Un seul client agit : le MJ connecté au plus petit identifiant de connexion (le « meneur »).
// Les autres MJ gardent seulement leur cache à jour, pour prendre le relais à tout moment.

import OBR, { type Item } from "@owlbear-rodeo/sdk";
import { onLanguageChange, t } from "./i18n";
import {
  DEFAULT_SETTINGS,
  PID_KEY,
  PLUGIN_ID,
  SETTINGS_KEY,
  capture,
  candidatesFor,
  diff,
  isMissing,
  latest,
  merge,
  modelId,
  parseSettings,
  persistentId,
  sameData,
  storeFromMetadata,
  type Settings,
  type Store,
} from "./model";
import { StoreTooLargeError, applyData, forget, makePersistent, readCache, readJournal, readStore, saveModel, tokenInfo, writeCache, writeEntries } from "./sync";

/** Stock connu de ce client : il suit la partie d'une scène à l'autre. */
let store: Store = {};
let settings: Settings = DEFAULT_SETTINGS;
let leader = false;
let isGM = false;
/** Items vus dans la scène ouverte : tout item absent de cet ensemble vient d'être posé. */
let known: Set<string> | undefined;
let pending: Store = {};
let flushTimer: ReturnType<typeof setTimeout> | undefined;
/** Avertissement de perte déjà montré pour cette date : une seule fois. */
let warnedFor = 0;

const SAVE_DELAY_MS = 400;

function queue(id: string, entry: Store[string]) {
  store[id] = entry;
  pending[id] = entry;
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, SAVE_DELAY_MS);
}

async function flush() {
  const changes = pending;
  pending = {};
  try {
    await writeEntries(changes);
  } catch (error) {
    console.error("[Soulbound]", error);
    OBR.notification.show(t(error instanceof StoreTooLargeError ? "error.tooLarge" : "error.save"), "ERROR");
  }
}

async function updateLeader() {
  const [role, me, players] = await Promise.all([OBR.player.getRole(), OBR.player.getConnectionId(), OBR.party.getPlayers()]);
  isGM = role === "GM";
  const gms = [me, ...players.filter((player) => player.role === "GM").map((player) => player.connectionId)];
  leader = isGM && gms.sort()[0] === me;
}

/** Les persistants de la scène prennent les données du stock, plus récentes que celles de la scène. */
async function syncPersistent(items: Item[]) {
  for (const item of items) {
    const pid = tokenInfo(item)?.pid;
    if (!pid) continue;
    const entry = store[persistentId(pid)];
    if (entry?.deleted) await applyData(item, {}, settings.exclude, false, { [PID_KEY]: undefined });
    else if (entry) await applyData(item, entry.data, settings.exclude, true);
  }
}

/** Ouverture d'une scène : fusion des trois copies, puis le stock complet est écrit dans cette scène. */
async function startScene() {
  known = undefined;
  if (!isGM) return;
  const [scene, journal, items] = await Promise.all([readStore(), readJournal(), OBR.scene.items.getItems()]);
  store = merge(store, readCache(), scene, journal.entries);
  writeCache(store);
  if (leader) {
    try {
      await writeEntries(diff(scene, store));
    } catch (error) {
      console.error("[Soulbound]", error);
      OBR.notification.show(t(error instanceof StoreTooLargeError ? "error.tooLarge" : "error.save"), "ERROR");
    }
    if (!settings.paused) await syncPersistent(items);
    if (isMissing(store, journal) && warnedFor !== journal.latest) {
      warnedFor = journal.latest;
      OBR.notification.show(t("error.missing"), "WARNING");
    }
  }
  known = new Set(items.map((item) => item.id));
}

async function onItems(items: Item[]) {
  if (!known) return;
  const previous = known;
  known = new Set(items.map((item) => item.id));
  if (!leader || settings.paused) return;

  // Persistants : toutes les instances d'un même persistant (copies comprises) partagent ses données.
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const pid = tokenInfo(item)?.pid;
    if (pid) groups.set(pid, [...(groups.get(pid) ?? []), item]);
  }
  const now = Date.now();
  for (const [pid, group] of groups) {
    const id = persistentId(pid);
    let entry = store[id];
    if (!entry) continue;
    if (entry.deleted) {
      for (const item of group) await applyData(item, {}, settings.exclude, false, { [PID_KEY]: undefined });
      continue;
    }
    // Une instance déjà là dont les données ont changé porte la nouvelle version ; les autres la suivent.
    const changed = group.find((item) => previous.has(item.id) && !sameData(capture(item.metadata, settings.exclude), entry!.data));
    if (changed) {
      const token = tokenInfo(changed)!;
      entry = { ...entry, data: capture(changed.metadata, settings.exclude), name: token.name, fp: token.fp, updated: Math.max(now, entry.updated + 1) };
      queue(id, entry);
    } else {
      const renamed = group.map(tokenInfo).find((token) => token && previous.has(token.id) && (token.name !== entry!.name || token.fp !== entry!.fp));
      if (renamed && group.length === 1) queue(id, { ...entry, name: renamed.name, fp: renamed.fp, updated: Math.max(now, entry.updated + 1) });
    }
    for (const item of group) if (item !== changed) await applyData(item, entry.data, settings.exclude, true);
  }

  for (const item of items) {
    const token = tokenInfo(item);
    if (!token || token.pid || previous.has(item.id)) continue;
    // Même image et même nom qu'un seul persistant, présent ou non : c'est lui (une instance de plus).
    const { exact } = candidatesFor(token, store, new Set());
    if (exact.length === 1) {
      const [id, entry] = exact[0];
      await applyData(item, entry.data, settings.exclude, true, { [PID_KEY]: id.slice(2) });
      continue;
    }
    // Un token qui porte déjà des données (copié-collé) les garde : le modèle n'est que pour les neufs.
    const model = store[modelId(token.fp)];
    if (model && !model.deleted && !Object.keys(capture(item.metadata, settings.exclude)).length) await applyData(item, model.data, settings.exclude, false);
  }
}

function setupMenus() {
  const tokenFilter = { key: "type", value: "IMAGE" } as const;
  const notMap = { key: "layer", value: "MAP", operator: "!=" } as const;
  OBR.contextMenu.create({
    id: `${PLUGIN_ID}/persistant`,
    icons: [{ icon: "/persist.svg", label: t("menu.persist"), filter: { roles: ["GM"], every: [tokenFilter, notMap, { key: ["metadata", PID_KEY], value: undefined }] } }],
    async onClick(context) {
      try {
        const { made, blocked } = await makePersistent(context.items);
        if (blocked) OBR.notification.show(t("menu.persistBlocked"), "WARNING");
        else if (made < context.items.length) OBR.notification.show(t("menu.persistSkipped"), "INFO");
      } catch (error) {
        console.error("[Soulbound]", error);
        OBR.notification.show(t(error instanceof StoreTooLargeError ? "error.tooLarge" : "error.save"), "ERROR");
      }
    },
  });
  OBR.contextMenu.create({
    id: `${PLUGIN_ID}/oublier`,
    icons: [{ icon: "/forget.svg", label: t("menu.forget"), filter: { roles: ["GM"], every: [{ key: ["metadata", PID_KEY], value: undefined, operator: "!=" }] } }],
    onClick: (context) => forget(context.items).catch((error) => console.error("[Soulbound]", error)),
  });
  OBR.contextMenu.create({
    id: `${PLUGIN_ID}/modele`,
    icons: [{ icon: "/model.svg", label: t("menu.model"), filter: { roles: ["GM"], max: 1, every: [tokenFilter, notMap, { key: ["metadata", PID_KEY], value: undefined }] } }],
    async onClick(context) {
      const [item] = context.items;
      if (!item) return;
      const result = await saveModel(item);
      if (result === "saved") OBR.notification.show(t("menu.modelSaved", { name: tokenInfo(item)?.name ?? "" }), "SUCCESS");
      else if (result === "blocked") OBR.notification.show(t("menu.modelBlocked"), "WARNING");
    },
  });
}

OBR.onReady(async () => {
  await updateLeader();
  settings = parseSettings((await OBR.room.getMetadata())[SETTINGS_KEY]);
  setupMenus();
  // Les menus sont écrits dans la langue du moment : ils suivent un changement.
  onLanguageChange(setupMenus);

  OBR.party.onChange(() => updateLeader());
  OBR.player.onChange(() => updateLeader());
  OBR.room.onMetadataChange((metadata) => (settings = parseSettings(metadata[SETTINGS_KEY])));
  // Un autre MJ a écrit : ce client fusionne, pour que son cache soit à jour s'il devient meneur.
  OBR.scene.onMetadataChange((metadata) => {
    if (!isGM) return;
    const before = latest(store);
    store = merge(store, storeFromMetadata(metadata));
    if (latest(store) !== before) writeCache(store);
  });
  OBR.scene.items.onChange((items) => onItems(items).catch((error) => console.error("[Soulbound]", error)));
  OBR.scene.onReadyChange((ready) => {
    if (ready) startScene().catch((error) => console.error("[Soulbound]", error));
    else known = undefined;
  });
  if (await OBR.scene.isReady()) await startScene();
});
