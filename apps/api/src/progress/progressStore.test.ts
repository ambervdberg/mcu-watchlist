import assert from "node:assert/strict";
import test from "node:test";
import { ProgressStore } from "./progressStore.js";

type StoredEntity = Record<string, unknown> & {
  partitionKey: string;
  rowKey: string;
};

class MemoryTable {
  readonly entities = new Map<string, StoredEntity>();

  /**Returns an entity by Table Storage partition and row keys. */
  async getEntity<T>(partitionKey: string, rowKey: string): Promise<T> {
    const entity = this.entities.get(`${partitionKey}:${rowKey}`);

    if (!entity) {
      throw Object.assign(new Error("Not found."), { statusCode: 404 });
    }

    return entity as T;
  }

  /**Stores a full entity replacement in the fake table. */
  async upsertEntity(entity: object): Promise<void> {
    const storedEntity = entity as StoredEntity;

    this.entities.set(`${storedEntity.partitionKey}:${storedEntity.rowKey}`, { ...storedEntity });
  }
}

test("ProgressStore stores each user's progress in a separate partition", async () => {
  const table = new MemoryTable();
  const store = new ProgressStore(table, () => "2026-06-22T12:00:00.000Z");

  await store.saveProgress("user_one", ["iron-man"], [], {}, {});
  await store.saveProgress("user_two", ["thor"], ["hulk"], {}, {});

  assert.deepEqual(await store.getProgress("user_one"), {
    watchedIds: ["iron-man"],
    skippedIds: [],
    watchedDates: {},
    watchedEpisodes: {}
  });
  assert.deepEqual(await store.getProgress("user_two"), {
    watchedIds: ["thor"],
    skippedIds: ["hulk"],
    watchedDates: {},
    watchedEpisodes: {}
  });
  assert.equal(table.entities.has("household:marvel-mcu"), false);
});

test("ProgressStore saves only dates for ids the user marked watched", async () => {
  const table = new MemoryTable();
  const store = new ProgressStore(table, () => "2026-06-22T12:00:00.000Z");

  await store.saveProgress(
    "user_one",
    ["iron-man"],
    [],
    {
      "iron-man": "2026-06-22",
      thor: "2026-06-23"
    },
    {}
  );

  assert.deepEqual((await store.getProgress("user_one")).watchedDates, {
    "iron-man": "2026-06-22"
  });
});
