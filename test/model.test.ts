import { describe, expect, it } from "vitest";
import {
  ENTRY_PREFIX,
  EMPTY_JOURNAL,
  bytes,
  candidatesFor,
  capture,
  diff,
  exportStore,
  importStore,
  isMissing,
  merge,
  metadataFromStore,
  modelId,
  patchFor,
  pushJournal,
  stable,
  storeFromMetadata,
  tombstone,
  type Entry,
  type Store,
} from "../src/model";

const entry = (over: Partial<Entry> = {}): Entry => ({ kind: "p", fp: "rat.png", name: "Rat", data: {}, updated: 1, ...over });

describe("données gardées", () => {
  it("garde les autres extensions, sans Soulbound ni les clés ignorées", () => {
    const metadata = { "soulbound/pid": "x", "com.stats/hp": 7, "com.fx/temp": true, "com.fx/aura": 1, vide: undefined };
    expect(capture(metadata, ["com.fx/temp"])).toEqual({ "com.stats/hp": 7, "com.fx/aura": 1 });
  });

  it("compare sans tenir compte de l'ordre des clés", () => {
    expect(stable({ b: 1, a: { d: 2, c: [1, { z: 1, y: 2 }] } })).toBe(stable({ a: { c: [1, { y: 2, z: 1 }], d: 2 }, b: 1 }));
  });

  it("un persistant remplace ses données, un modèle ne fait qu'ajouter", () => {
    const metadata = { "com.stats/hp": 3, "com.notes/n": "x", "soulbound/pid": "a" };
    expect(patchFor(metadata, { "com.stats/hp": 10 }, [], true)).toEqual({ set: { "com.stats/hp": 10 }, remove: ["com.notes/n"] });
    expect(patchFor(metadata, { "com.stats/hp": 10 }, [], false)).toEqual({ set: { "com.stats/hp": 10 }, remove: [] });
    expect(patchFor(metadata, { "com.stats/hp": 3, "com.notes/n": "x" }, [], true)).toBeNull();
  });

  it("ne touche jamais aux clés ignorées", () => {
    expect(patchFor({ "com.fx/temp": 1 }, { "com.fx/temp": 2 }, ["com.fx/"], true)).toBeNull();
  });
});

describe("fusion", () => {
  it("garde l'entrée la plus récente, quel que soit l'ordre", () => {
    const old = { "p:a": entry({ data: { hp: 1 }, updated: 1 }) };
    const recent = { "p:a": entry({ data: { hp: 5 }, updated: 2 }), "p:b": entry({ updated: 1 }) };
    expect(merge(old, recent)).toEqual(merge(recent, old));
    expect(merge(old, recent)["p:a"].data).toEqual({ hp: 5 });
  });

  it("une pierre tombale empêche une vieille copie de ressusciter l'entrée", () => {
    const alive = { "p:a": entry({ updated: 5 }) };
    const dead = { "p:a": tombstone(alive["p:a"], 3) };
    expect(dead["p:a"].updated).toBe(6);
    expect(merge(dead, alive)["p:a"].deleted).toBe(true);
  });

  it("ne réécrit que ce qui manque ou a changé", () => {
    const base = { "p:a": entry(), "p:b": entry({ updated: 2 }) };
    const merged = merge(base, { "p:b": entry({ updated: 3 }), "p:c": entry() });
    expect(Object.keys(diff(base, merged)).sort()).toEqual(["p:b", "p:c"]);
  });

  it("relit le stock depuis les metadata de la scène, en ignorant le reste", () => {
    const store: Store = { "p:a": entry() };
    const metadata = { ...metadataFromStore(store), "autre/cle": 1, [`${ENTRY_PREFIX}abime`]: { kind: "?" } };
    expect(storeFromMetadata(metadata)).toEqual(store);
  });
});

describe("journal de la room", () => {
  it("reste sous la taille permise en oubliant les plus anciens, mais garde la date du dernier", () => {
    let journal = EMPTY_JOURNAL;
    for (let i = 1; i <= 50; i++) journal = pushJournal(journal, { [`p:${i}`]: entry({ data: { notes: "x".repeat(200) }, updated: i }) }, 2048);
    expect(bytes(journal)).toBeLessThanOrEqual(2048);
    expect(journal.latest).toBe(50);
    expect(journal.entries["p:50"]).toBeDefined();
    expect(journal.entries["p:1"]).toBeUndefined();
  });

  it("une scène en retard voit qu'il lui manque une modification trop grosse pour le journal", () => {
    const journal = pushJournal(EMPTY_JOURNAL, { "p:a": entry({ data: { sorts: "x".repeat(5000) }, updated: 9 }) }, 1024);
    expect(journal.entries).toEqual({});
    expect(isMissing({ "p:a": entry({ updated: 4 }) }, journal)).toBe(true);
    expect(isMissing(merge({ "p:a": entry({ updated: 9 }) }), journal)).toBe(false);
  });
});

describe("reconnaître un token", () => {
  const store: Store = {
    "p:gandalf": entry({ fp: "mage.png", name: "Gandalf", updated: 3 }),
    "p:saroumane": entry({ fp: "mage.png", name: "Saroumane", updated: 2 }),
    "p:mort": { ...entry({ fp: "mage.png", name: "Gandalf" }), deleted: true },
    [modelId("rat.png")]: entry({ kind: "m" }),
  };

  it("même image et même nom : un seul candidat sûr", () => {
    const { exact, all } = candidatesFor({ fp: "mage.png", name: " gandalf " }, store, new Set());
    expect(exact.map(([id]) => id)).toEqual(["p:gandalf"]);
    expect(all.map(([id]) => id)).toEqual(["p:gandalf", "p:saroumane"]);
  });

  it("un persistant déjà sur la scène n'est pas candidat", () => {
    expect(candidatesFor({ fp: "mage.png", name: "Gandalf" }, store, new Set(["gandalf"])).exact).toEqual([]);
  });

  it("cinq rats : aucun persistant, chacun ne reçoit que le modèle", () => {
    expect(candidatesFor({ fp: "rat.png", name: "Rat" }, store, new Set()).all).toEqual([]);
  });
});

describe("export", () => {
  it("se relit à l'identique", () => {
    const store: Store = { "p:a": entry({ data: { hp: 4 } }) };
    expect(importStore(exportStore(store))).toEqual(store);
    expect(() => importStore('{"entries":{}}')).toThrow();
  });
});

describe("modèle ou persistant, pas les deux", () => {
  it("repère le modèle et les persistants d'une image", async () => {
    const { hasModel, persistentsOf } = await import("../src/model");
    const store: Store = {
      [modelId("rat.png")]: entry({ kind: "m" }),
      "p:pj": entry({ fp: "pj.png", name: "Ayla" }),
      "p:mort": { ...entry({ fp: "rat.png" }), deleted: true },
    };
    expect(hasModel(store, "rat.png")).toBe(true);
    expect(hasModel(store, "pj.png")).toBe(false);
    expect(persistentsOf(store, "pj.png")).toHaveLength(1);
    expect(persistentsOf(store, "rat.png")).toHaveLength(0);
  });
});
