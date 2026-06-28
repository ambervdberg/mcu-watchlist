import assert from "node:assert/strict";
import test from "node:test";
import {
  LoginTokenStore,
  UserStore,
  hashEmail,
  hashLoginToken,
  normalizeEmail
} from "./userAuth.js";

type StoredEntity = Record<string, unknown> & {
  partitionKey: string;
  rowKey: string;
};

class MemoryTable {
  readonly entities = new Map<string, StoredEntity>();
  public rejectNextUpdate = false;

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

  /**Updates an entity and can simulate a stale ETag write. */
  async updateEntity(entity: object): Promise<void> {
    if (this.rejectNextUpdate) {
      this.rejectNextUpdate = false;
      throw Object.assign(new Error("Precondition failed."), { statusCode: 412 });
    }

    await this.upsertEntity(entity);
  }
}

test("normalizeEmail trims and lowercases valid email addresses", () => {
  assert.equal(normalizeEmail("  Amber.Example+MCU@Example.COM  "), "amber.example+mcu@example.com");
  assert.throws(() => normalizeEmail("not-an-email"), /valid email/i);
});

test("UserStore reuses a stable user id for the same normalized email", async () => {
  const table = new MemoryTable();
  const store = new UserStore(table, () => "user_fixed", () => "2026-06-22T12:00:00.000Z");

  const firstUser = await store.getOrCreateUserByEmail("Amber@Example.com");
  const secondUser = await store.getOrCreateUserByEmail(" amber@example.COM ");
  const lookupRow = await table.getEntity<StoredEntity>("email", firstUser.emailHash);

  assert.deepEqual(firstUser, secondUser);
  assert.equal(firstUser.userId, "user_fixed");
  assert.equal(lookupRow.userId, "user_fixed");
});

test("UserStore reads an existing user by id for session probes", async () => {
  const table = new MemoryTable();
  const store = new UserStore(table, () => "user_fixed", () => "2026-06-22T12:00:00.000Z");

  await store.getOrCreateUserByEmail("amber@example.com");

  assert.deepEqual(await store.getUserById("user_fixed"), {
    userId: "user_fixed",
    email: "amber@example.com",
    emailHash: hashEmail("amber@example.com")
  });
});

test("LoginTokenStore stores token hashes and consumes valid unused tokens once", async () => {
  const table = new MemoryTable();
  const store = new LoginTokenStore(table, () => "raw-token", () => "2026-06-22T12:00:00.000Z");

  const created = await store.createLoginToken({
    email: "Amber@Example.com",
    returnPath: "/title/iron-man",
    expiresAt: "2026-06-22T12:15:00.000Z"
  });
  const storedRow = await table.getEntity<StoredEntity>("login", hashLoginToken("raw-token"));
  const consumed = await store.consumeLoginToken("raw-token", "2026-06-22T12:05:00.000Z");
  const reused = await store.consumeLoginToken("raw-token", "2026-06-22T12:06:00.000Z");

  assert.equal(created.rawToken, "raw-token");
  assert.equal(storedRow.rowKey, hashLoginToken("raw-token"));
  assert.equal(storedRow.rawToken, undefined);
  assert.deepEqual(consumed, {
    email: "amber@example.com",
    returnPath: "/title/iron-man"
  });
  assert.equal(reused, null);
});

test("LoginTokenStore rejects expired tokens", async () => {
  const table = new MemoryTable();
  const store = new LoginTokenStore(table, () => "raw-token", () => "2026-06-22T12:00:00.000Z");

  await store.createLoginToken({
    email: "amber@example.com",
    returnPath: "/",
    expiresAt: "2026-06-22T12:15:00.000Z"
  });

  assert.equal(await store.consumeLoginToken("raw-token", "2026-06-22T12:16:00.000Z"), null);
}
);

test("LoginTokenStore rejects tokens when another request consumes first", async () => {
  const table = new MemoryTable();
  const store = new LoginTokenStore(table, () => "raw-token", () => "2026-06-22T12:00:00.000Z");

  await store.createLoginToken({
    email: "amber@example.com",
    returnPath: "/",
    expiresAt: "2026-06-22T12:15:00.000Z"
  });
  table.rejectNextUpdate = true;

  assert.equal(await store.consumeLoginToken("raw-token", "2026-06-22T12:05:00.000Z"), null);
});
