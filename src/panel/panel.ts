// Panneau de Soulbound : le token choisi, les persistants et les modèles, puis les réglages.

import OBR, { type Item } from "@owlbear-rodeo/sdk";
import { LANGUAGES, ago, chooseLanguage, currentLanguage, languageSetting, onLanguageChange, t, type Language } from "../i18n";
import {
  DEFAULT_SETTINGS,
  JOURNAL_KEY,
  MAX_STORE_BYTES,
  SETTINGS_KEY,
  bytes,
  candidatesFor,
  exportStore,
  extensionsOf,
  hasModel as imageHasModel,
  importStore,
  isMissing,
  live,
  merge,
  metadataFromStore,
  modelId,
  parseJournal,
  parseSettings,
  persistentsOf,
  storeFromMetadata,
  type Entry,
  type Journal,
  type Settings,
  type Store,
} from "../model";
import { deleteEntry, forget, fullStore, makePersistent, readCache, restoreInto, saveModel, tokenInfo, writeEntries, writeSettings } from "../sync";
import "./panel.css";

type Tab = "tokens" | "settings";

const app = document.querySelector<HTMLDivElement>("#app")!;
const escape = (text: string) => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

let tab: Tab = "tokens";
let store: Store = {};
let journal: Journal = { latest: 0, entries: {} };
let settings: Settings = DEFAULT_SETTINGS;
let items: Item[] = [];
let selection: string[] = [];
/** Entrée dont la suppression attend une confirmation (second clic). */
let confirming: string | undefined;
let notice = "";

const GEAR =
  '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
const TRASH = '<svg class="icon" viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';

const presentPids = () => new Set(items.map((item) => tokenInfo(item)?.pid).filter((pid): pid is string => !!pid));
const instanceCount = (pid: string) => items.filter((item) => tokenInfo(item)?.pid === pid).length;

function thumb(fp: string) {
  return `<img class="thumb" src="${escape(fp)}" alt="" loading="lazy" />`;
}

function dataSummary(entry: Entry) {
  const extensions = extensionsOf(entry.data);
  if (!extensions.length) return t("list.noData");
  return `<span title="${escape(extensions.join("\n"))}">${t("list.extensions", { n: extensions.length })}</span>`;
}

function deleteButton(id: string) {
  const asking = confirming === id;
  return `<button type="button" class="icon-button${asking ? " confirm" : ""}" data-delete="${escape(id)}" aria-label="${t("action.delete")}" title="${t("action.delete")}">${asking ? t("action.confirmDelete") : TRASH}</button>`;
}

function selectionCard() {
  if (!selection.length) return `<p class="hint flush">${t("selection.none")}</p>`;
  if (selection.length > 1) return `<p class="hint flush">${t("selection.many", { n: selection.length })}</p>`;
  const item = items.find((candidate) => candidate.id === selection[0]);
  const token = item && tokenInfo(item);
  if (!token) return `<p class="hint flush">${t("selection.notToken")}</p>`;
  const model = store[modelId(token.fp)];
  const hasModel = imageHasModel(store, token.fp);
  const persistentImage = persistentsOf(store, token.fp).length > 0;
  const { all } = candidatesFor(token, store, new Set());
  const instances = token.pid ? instanceCount(token.pid) : 0;
  return `
    <div class="card">
      <div class="card-head">${thumb(token.fp)}<strong>${escape(token.name)}</strong>
        <span class="badge${token.pid ? " on" : ""}">${token.pid ? t("list.persistent") : "—"}</span></div>
      <p class="hint flush">${t(token.pid ? "selection.persistent" : "selection.ordinary")}</p>
      ${instances > 1 ? `<p class="hint flush">${t("selection.instances", { n: instances })}</p>` : ""}
      ${token.pid ? "" : `<p class="hint flush">${hasModel ? t("selection.model", { when: ago(model.updated) }) : t("selection.noModel")}</p>`}
      <div class="actions">
        ${
          token.pid
            ? `<button type="button" class="stop" data-action="forget">${t(instances > 1 ? "action.detach" : "action.forget")}</button>`
            : `<button type="button" class="stop primary" data-action="persist"${hasModel ? " disabled" : ""}>${t("action.persist")}</button>
               <button type="button" class="stop" data-action="model"${persistentImage ? " disabled" : ""}>${t(hasModel ? "action.modelUpdate" : "action.model")}</button>`
        }
      </div>
      ${!token.pid && hasModel ? `<p class="hint flush">${t("selection.modelImage")}</p>` : ""}
      ${!token.pid && persistentImage ? `<p class="hint flush">${t("selection.persistentImage")}</p>` : ""}
      ${
        !token.pid && all.length
          ? `<p class="hint flush">${t("selection.restore")}</p>
             ${all
               .map(
                 ([id, entry]) =>
                   `<button type="button" class="stop restore" data-restore="${escape(id)}" title="${escape(t("selection.restoreTitle", { name: entry.name }))}">
                      <strong>${escape(entry.name)}</strong><small>${ago(entry.updated)}</small></button>`,
               )
               .join("")}`
          : ""
      }
    </div>`;
}

function rows(kind: "p" | "m") {
  const present = presentPids();
  const entries = live(store)
    .filter(([, entry]) => entry.kind === kind)
    .sort(([, a], [, b]) => a.name.localeCompare(b.name));
  if (!entries.length) return `<p class="hint flush">${t(kind === "p" ? "list.noPersistent" : "list.noModels")}</p>`;
  return `<div class="rows">${entries
    .map(([id, entry]) => {
      const here = kind === "p" && present.has(id.slice(2));
      const count = kind === "p" ? instanceCount(id.slice(2)) : 0;
      const where = kind === "p" ? `${count > 1 ? t("list.hereMany", { n: count }) : t(here ? "list.here" : "list.away")} · ` : "";
      return `<div class="row${kind === "p" && !here ? " away" : ""}">${thumb(entry.fp)}
        <span class="row-text"><strong>${escape(entry.name)}</strong><small>${where}${dataSummary(entry)} · ${ago(entry.updated)}</small></span>
        ${deleteButton(id)}</div>`;
    })
    .join("")}</div>`;
}

function tokensTab() {
  const count = (kind: "p" | "m") => live(store).filter(([, entry]) => entry.kind === kind).length;
  return `
    ${settings.paused ? `<p class="warning">${t("status.paused")}</p>` : ""}
    ${isMissing(store, journal) ? `<p class="warning">${t("status.missing")}</p>` : ""}
    <section><p class="label">${t("selection.label")}</p>${selectionCard()}</section>
    <section><p class="label">${t("list.persistent")} (${count("p")})</p>${rows("p")}</section>
    <section><p class="label">${t("list.models")} (${count("m")})</p>${rows("m")}</section>`;
}

function settingsTab() {
  const size = bytes(metadataFromStore(store));
  const language = languageSetting();
  return `
    <section>
      <p class="label">${t("settings.exclude")}</p>
      <textarea data-exclude spellcheck="false" placeholder="com.exemple.extension/">${escape(settings.exclude.join("\n"))}</textarea>
      <p class="hint flush">${t("settings.excludeHelp")}</p>
    </section>
    <section>
      <p class="label">${t("settings.backup")}</p>
      <div class="actions">
        <button type="button" class="stop" data-action="export">${t("settings.export")}</button>
        <button type="button" class="stop" data-action="copy">${t("settings.copy")}</button>
        <button type="button" class="stop" data-action="import">${t("settings.import")}</button>
        <input type="file" accept="application/json,.json" data-import hidden />
      </div>
      ${notice ? `<p class="hint flush">${escape(notice)}</p>` : ""}
      <p class="hint flush">${t("settings.backupHelp")}</p>
      <p class="hint flush">${t("settings.size", { size: Math.ceil(size / 1024), max: MAX_STORE_BYTES / 1024 })}</p>
    </section>
    <section>
      <p class="label">${t("settings.language")}</p>
      <div class="segmented" role="group" aria-label="${t("settings.language")}">
        ${(["auto", ...LANGUAGES] as const).map((value) => `<button type="button" data-language="${value}" aria-pressed="${value === language}">${t(`language.${value}`)}</button>`).join("")}
      </div>
      <p class="hint flush">${t("settings.languageHelp")}</p>
    </section>
    <section class="about">
      <p class="label">${t("settings.about")}</p>
      <p class="hint flush">${t("settings.support")}</p>
      <p><a class="patreon" href="https://www.patreon.com/misterjj_obr" target="_blank" rel="noopener">${t("settings.patreon")}</a></p>
      <p class="hint flush">${t("settings.privacy")}</p>
    </section>`;
}

function render() {
  // Une saisie en cours dans la liste des clés ignorées ne doit pas être effacée par un redessin.
  if (document.activeElement?.matches("textarea")) return;
  const scroll = app.querySelector(".content")?.scrollTop ?? 0;
  app.innerHTML = `
    <header class="bar"><strong>${t("app.name")}</strong>
      <button type="button" class="stop" data-action="pause" aria-pressed="${settings.paused}" title="${t("app.pauseTitle")}">${t(settings.paused ? "app.resume" : "app.pause")}</button></header>
    <nav class="tabs" role="tablist">
      <button type="button" role="tab" data-tab="tokens" aria-selected="${tab === "tokens"}">${t("tab.tokens")}</button>
      <button type="button" role="tab" class="tab-icon" data-tab="settings" aria-selected="${tab === "settings"}" aria-label="${t("tab.settings")}" title="${t("tab.settings")}">${GEAR}</button>
    </nav>
    <main class="content">${tab === "tokens" ? tokensTab() : settingsTab()}</main>`;
  app.querySelector(".content")!.scrollTop = scroll;
}

function renderMessage(text: string) {
  app.innerHTML = `<header class="bar"><strong>${t("app.name")}</strong></header><main class="content"><p class="hint flush">${text}</p></main>`;
}

async function act(work: () => Promise<unknown>) {
  try {
    await work();
  } catch (error) {
    console.error("[Soulbound]", error);
    OBR.notification.show(t("error.save"), "ERROR");
  }
}

const selectedItem = () => items.find((item) => item.id === selection[0]);

function download(text: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  link.download = `soulbound-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function importFile(file: File) {
  try {
    const imported = importStore(await file.text());
    await writeEntries(imported);
    store = merge(store, imported);
    notice = t("settings.imported", { n: live(imported).length });
  } catch {
    notice = t("settings.importError");
  }
  render();
}

app.addEventListener("click", async (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>("button");
  if (!target) return;
  const { tab: nextTab, action, language, restore } = target.dataset;
  const remove = target.dataset.delete;
  if (remove === undefined) confirming = undefined;
  if (nextTab) {
    tab = nextTab as Tab;
    notice = "";
  } else if (language) {
    chooseLanguage(language as Language | "auto");
  } else if (remove) {
    if (confirming !== remove) confirming = remove;
    else {
      confirming = undefined;
      await act(() => deleteEntry(remove));
    }
  } else if (restore) {
    const item = selectedItem();
    const entry = store[restore];
    if (item && entry) await act(() => restoreInto(restore, item, entry));
  } else if (action === "pause") {
    settings = { ...settings, paused: !settings.paused };
    await act(() => writeSettings(settings));
  } else if (action === "persist" || action === "forget" || action === "model") {
    const item = selectedItem();
    if (item) await act(() => (action === "persist" ? makePersistent([item]) : action === "forget" ? forget([item]) : saveModel(item)));
  } else if (action === "export") {
    download(exportStore(store));
  } else if (action === "copy") {
    await navigator.clipboard.writeText(exportStore(store)).then(
      () => (notice = t("settings.copied")),
      () => download(exportStore(store)),
    );
  } else if (action === "import") {
    app.querySelector<HTMLInputElement>("[data-import]")?.click();
    return;
  }
  render();
});

app.addEventListener("change", (event) => {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement;
  if (target.matches("[data-import]")) {
    const file = (target as HTMLInputElement).files?.[0];
    if (file) importFile(file);
  } else if (target.matches("[data-exclude]")) {
    const exclude = [...new Set(target.value.split("\n").map((line) => line.trim()).filter(Boolean))];
    settings = { ...settings, exclude };
    act(() => writeSettings(settings));
  }
});
// Le champ perd le focus : le panneau peut de nouveau suivre les changements.
app.addEventListener("focusout", (event) => {
  if ((event.target as HTMLElement).matches("textarea")) setTimeout(render, 0);
});

async function applyTheme() {
  const theme = await OBR.theme.getTheme();
  document.documentElement.dataset.theme = theme.mode === "LIGHT" ? "light" : "dark";
}

async function loadScene() {
  if (!(await OBR.scene.isReady())) {
    items = [];
    renderMessage(t("app.noScene"));
    return;
  }
  [store, items] = await Promise.all([fullStore(), OBR.scene.items.getItems()]);
  selection = (await OBR.player.getSelection()) ?? [];
  render();
}

OBR.onReady(async () => {
  document.documentElement.lang = currentLanguage();
  await applyTheme();
  OBR.theme.onChange(applyTheme);
  if ((await OBR.player.getRole()) !== "GM") {
    renderMessage(t("app.gmOnly"));
    return;
  }
  const room = await OBR.room.getMetadata();
  settings = parseSettings(room[SETTINGS_KEY]);
  journal = parseJournal(room[JOURNAL_KEY]);
  onLanguageChange(render);
  OBR.room.onMetadataChange((metadata) => {
    settings = parseSettings(metadata[SETTINGS_KEY]);
    journal = parseJournal(metadata[JOURNAL_KEY]);
    render();
  });
  OBR.scene.onMetadataChange((metadata) => {
    store = merge(store, readCache(), storeFromMetadata(metadata));
    render();
  });
  OBR.scene.items.onChange((next) => {
    items = next;
    render();
  });
  OBR.player.onChange((player) => {
    const next = player.selection ?? [];
    if (next.join() === selection.join()) return;
    selection = next;
    confirming = undefined;
    render();
  });
  OBR.scene.onReadyChange(() => loadScene());
  await loadScene();
});
