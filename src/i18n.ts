// Textes de l'interface, en français et en anglais. Même fonctionnement que Tempest!.

export type Language = "fr" | "en";

const LANGUAGE_KEY = "soulbound/langue";

const fr = {
  "app.name": "Soulbound",
  "app.pause": "Pause",
  "app.resume": "Reprendre",
  "app.pauseTitle": "Suspendre la sauvegarde et la restauration automatiques, pour toute la room",
  "app.noScene": "Ouvre une scène pour voir les tokens gardés.",
  "app.gmOnly": "Soulbound est réservé au MJ : il garde les données des tokens d'une scène à l'autre.",
  "tab.tokens": "Tokens",
  "tab.settings": "Réglages",
  "status.paused": "En pause : rien n'est sauvegardé ni restauré.",
  "status.missing": "Des modifications récentes sont introuvables : elles étaient dans une scène qui n'a pas été rouverte depuis. Ouvre-la, ou importe un export.",
  "selection.label": "Token choisi",
  "selection.none": "Choisis un token sur la carte pour le rendre persistant, en faire un modèle ou lui rendre ses données.",
  "selection.many": "{n} tokens choisis. Le menu clic droit les rend persistants d'un coup.",
  "selection.notToken": "Cet élément n'est pas un token (image sur le calque des personnages, montures ou accessoires).",
  "selection.persistent": "Persistant : ses données le suivent, même supprimé ou dans une autre scène. Toutes ses instances partagent les mêmes données.",
  "selection.instances": "{n} instances sur cette scène, synchronisées.",
  "selection.ordinary": "Ordinaire : ses données disparaissent avec lui.",
  "selection.model": "Modèle de cette image : {when}.",
  "selection.noModel": "Pas de modèle pour cette image.",
  "selection.modelImage": "Cette image a un modèle : ses tokens ne peuvent pas être persistants. Pour un PNJ unique, supprime d'abord le modèle ci-dessous.",
  "selection.persistentImage": "Cette image a des tokens persistants : elle ne peut pas avoir de modèle.",
  "selection.restore": "Persistants avec la même image : relier ce token à l'un d'eux lui donne ses données, puis les garde synchronisées.",
  "selection.restoreTitle": "Relier ce token à {name}",
  "action.persist": "Rendre persistant",
  "action.forget": "Ne plus garder",
  "action.detach": "Détacher cette copie",
  "action.model": "En faire le modèle",
  "action.modelUpdate": "Remplacer le modèle",
  "action.delete": "Supprimer",
  "action.confirmDelete": "Supprimer ?",
  "list.persistent": "Persistants",
  "list.models": "Modèles",
  "list.noPersistent": "Aucun token persistant. Clic droit sur un PJ ou un PNJ nommé, puis « Soulbound : rendre persistant ».",
  "list.noModels": "Aucun modèle. Clic droit sur un rat bien rempli, puis « Soulbound : en faire le modèle » : chaque rat posé ensuite recevra ses données.",
  "list.here": "Sur cette scène",
  "list.hereMany": "{n} instances sur cette scène",
  "list.away": "Absent de cette scène",
  "list.extensions": "{n} extension(s)",
  "list.noData": "aucune donnée",
  "settings.exclude": "Données ignorées",
  "settings.excludeHelp": "Une clé par ligne, ou le début d'une clé (par exemple com.exemple.extension/). Ces données ne sont jamais sauvegardées ni restaurées. Utile pour un état passager ou un lien vers un autre élément de la carte.",
  "settings.backup": "Sauvegarde",
  "settings.backupHelp": "Le stock est copié dans chaque scène ouverte, dans le cache de ce navigateur, et ses derniers changements dans la room. L'export est un filet de plus, à garder hors d'Owlbear.",
  "settings.export": "Exporter",
  "settings.copy": "Copier",
  "settings.copied": "Copié",
  "settings.import": "Importer",
  "settings.imported": "{n} entrée(s) importée(s).",
  "settings.importError": "Ce fichier n'est pas un export de Soulbound.",
  "settings.size": "Taille du stock : {size} Ko sur {max} Ko.",
  "settings.language": "Langue",
  "settings.languageHelp": "Pour ce navigateur seulement.",
  "settings.about": "À propos",
  "settings.support": "Soulbound est gratuit. Si tu veux soutenir son développement :",
  "settings.patreon": "Soutenir sur Patreon",
  "settings.privacy": "Les données restent dans ta room Owlbear et dans ce navigateur : rien n'est envoyé ailleurs.",
  "language.auto": "Auto",
  "language.fr": "Français",
  "language.en": "English",
  "menu.persist": "Soulbound : rendre persistant",
  "menu.persistSkipped": "Seuls les tokens (images des calques personnages, montures ou accessoires) peuvent être persistants.",
  "menu.persistBlocked": "Cette image a un modèle : ses tokens ne peuvent pas être persistants. Supprime le modèle dans le panneau Soulbound d'abord.",
  "menu.modelBlocked": "Cette image a des tokens persistants : elle ne peut pas avoir de modèle. Supprime-les dans le panneau Soulbound d'abord.",
  "menu.forget": "Soulbound : ne plus garder",
  "menu.model": "Soulbound : en faire le modèle",
  "menu.modelSaved": "Modèle enregistré : chaque « {name} » posé recevra ces données.",
  "error.save": "Soulbound n'a pas pu enregistrer.",
  "error.tooLarge": "Le stock de Soulbound est plein : supprime des persistants ou des modèles inutiles.",
  "error.missing": "Soulbound : des modifications récentes sont introuvables. Ouvre le panneau Soulbound pour en savoir plus.",
  "time.never": "jamais",
  "stepper.more": "Plus",
  "stepper.less": "Moins",
};

type Key = keyof typeof fr;

const en: Record<Key, string> = {
  "app.name": "Soulbound",
  "app.pause": "Pause",
  "app.resume": "Resume",
  "app.pauseTitle": "Pause automatic saving and restoring, for the whole room",
  "app.noScene": "Open a scene to see the kept tokens.",
  "app.gmOnly": "Soulbound is for the GM: it keeps token data from one scene to the next.",
  "tab.tokens": "Tokens",
  "tab.settings": "Settings",
  "status.paused": "Paused: nothing is saved or restored.",
  "status.missing": "Some recent changes can't be found: they were in a scene that hasn't been opened since. Open it, or import an export.",
  "selection.label": "Selected token",
  "selection.none": "Select a token on the map to make it persistent, turn it into a template, or give it back its data.",
  "selection.many": "{n} tokens selected. The right-click menu makes them all persistent at once.",
  "selection.notToken": "This isn't a token (an image on the character, mount or prop layer).",
  "selection.persistent": "Persistent: its data follows it, even when deleted or in another scene. All its instances share the same data.",
  "selection.instances": "{n} instances in this scene, kept in sync.",
  "selection.ordinary": "Ordinary: its data is lost with it.",
  "selection.model": "Template for this image: {when}.",
  "selection.noModel": "No template for this image.",
  "selection.modelImage": "This image has a template: its tokens can't be persistent. For a unique NPC, delete the template below first.",
  "selection.persistentImage": "This image has persistent tokens: it can't have a template.",
  "selection.restore": "Persistent tokens with the same image: linking this token to one gives it that data and keeps it in sync.",
  "selection.restoreTitle": "Link this token to {name}",
  "action.persist": "Make persistent",
  "action.forget": "Stop keeping",
  "action.detach": "Detach this copy",
  "action.model": "Make it the template",
  "action.modelUpdate": "Replace the template",
  "action.delete": "Delete",
  "action.confirmDelete": "Delete?",
  "list.persistent": "Persistent",
  "list.models": "Templates",
  "list.noPersistent": "No persistent tokens. Right-click a PC or a named NPC, then “Soulbound: make persistent”.",
  "list.noModels": "No templates. Right-click a fully set-up rat, then “Soulbound: make it the template”: every rat placed afterwards gets its data.",
  "list.here": "In this scene",
  "list.hereMany": "{n} instances in this scene",
  "list.away": "Not in this scene",
  "list.extensions": "{n} extension(s)",
  "list.noData": "no data",
  "settings.exclude": "Ignored data",
  "settings.excludeHelp": "One key per line, or the start of a key (for example com.example.extension/). This data is never saved or restored. Useful for passing state or a link to another map item.",
  "settings.backup": "Backup",
  "settings.backupHelp": "The store is copied into every opened scene and into this browser's cache, and its latest changes into the room. An export is one more safety net, kept outside Owlbear.",
  "settings.export": "Export",
  "settings.copy": "Copy",
  "settings.copied": "Copied",
  "settings.import": "Import",
  "settings.imported": "{n} entries imported.",
  "settings.importError": "This file isn't a Soulbound export.",
  "settings.size": "Store size: {size} KB of {max} KB.",
  "settings.language": "Language",
  "settings.languageHelp": "For this browser only.",
  "settings.about": "About",
  "settings.support": "Soulbound is free. If you want to support its development:",
  "settings.patreon": "Support on Patreon",
  "settings.privacy": "Data stays in your Owlbear room and in this browser: nothing is sent anywhere else.",
  "language.auto": "Auto",
  "language.fr": "Français",
  "language.en": "English",
  "menu.persist": "Soulbound: make persistent",
  "menu.persistSkipped": "Only tokens (images on the character, mount or prop layers) can be persistent.",
  "menu.persistBlocked": "This image has a template: its tokens can't be persistent. Delete the template in the Soulbound panel first.",
  "menu.modelBlocked": "This image has persistent tokens: it can't have a template. Delete them in the Soulbound panel first.",
  "menu.forget": "Soulbound: stop keeping",
  "menu.model": "Soulbound: make it the template",
  "menu.modelSaved": "Template saved: every “{name}” placed will get this data.",
  "error.save": "Soulbound couldn't save.",
  "error.tooLarge": "Soulbound's store is full: delete unused persistent tokens or templates.",
  "error.missing": "Soulbound: some recent changes can't be found. Open the Soulbound panel to learn more.",
  "time.never": "never",
  "stepper.more": "More",
  "stepper.less": "Less",
};

export const DICTIONARIES: Record<Language, Record<Key, string>> = { fr, en };
export const LANGUAGES: Language[] = ["fr", "en"];

const isLanguage = (value: unknown): value is Language => LANGUAGES.includes(value as Language);

function savedLanguage() {
  try {
    return localStorage.getItem(LANGUAGE_KEY);
  } catch {
    return null;
  }
}

let forced: Language | undefined;

export const browserLanguage = (): Language =>
  typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("fr") ? "fr" : "en";

export function languageSetting(): Language | "auto" {
  const saved = savedLanguage();
  return isLanguage(saved) ? saved : "auto";
}

export function currentLanguage(): Language {
  if (forced) return forced;
  const setting = languageSetting();
  return setting === "auto" ? browserLanguage() : setting;
}

export function chooseLanguage(language: Language | "auto") {
  try {
    if (language === "auto") localStorage.removeItem(LANGUAGE_KEY);
    else localStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    // Sans stockage, le choix ne dure que le temps de la page.
  }
  if (typeof document !== "undefined") document.documentElement.lang = currentLanguage();
}

/** Langue changée depuis une autre page de l'extension. */
export function onLanguageChange(callback: () => void) {
  window.addEventListener("storage", (event) => {
    if (event.key !== LANGUAGE_KEY) return;
    document.documentElement.lang = currentLanguage();
    callback();
  });
}

/** Pour les tests : impose une langue. */
export const setLanguage = (language: Language | undefined) => {
  forced = language;
};

export function t(key: Key, vars: Record<string, string | number> = {}) {
  const text = DICTIONARIES[currentLanguage()][key] ?? fr[key];
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

/** « il y a 3 min », dans la langue de l'interface. */
export function ago(time: number, now = Date.now()) {
  if (!time) return t("time.never");
  const format = new Intl.RelativeTimeFormat(currentLanguage(), { numeric: "auto" });
  const seconds = Math.round((time - now) / 1000);
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [["second", 60], ["minute", 60], ["hour", 24], ["day", 30], ["month", 12], ["year", Infinity]];
  let value = seconds;
  for (const [unit, size] of steps) {
    if (Math.abs(value) < size) return format.format(unit === "second" ? Math.min(0, value) : value, unit);
    value = Math.round(value / size);
  }
  return format.format(value, "year");
}
