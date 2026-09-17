import test from "node:test";
import assert from "node:assert/strict";
import { acknowledgeKeyedOperation, acquireOperationKey, runKeyedOperation } from "../src/services/operation-key.ts";

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const terminal = (error: string) => ({ response: { status: 409, data: { error } } });

test("true retries and reloads retain the same operation key", async () => {
  const storage = new MemoryStorage(); let created = 0; const createKey = () => `key-${++created}`;
  const failing = () => runKeyedOperation({ kind: "script-revision", id: "reel", payload: '[1,"same"]', storage, createKey, execute: async (key) => { throw { retryable: true, key }; } });
  await assert.rejects(failing);
  let replayKey = "";
  await runKeyedOperation({ kind: "script-revision", id: "reel", payload: '[1,"same"]', storage, createKey, execute: async (key) => { replayKey = key; } });
  assert.equal(replayKey, "key-1"); assert.equal(created, 1);
});

test("revision acknowledgement retires only its key and a new instruction gets a fresh key", async () => {
  const storage = new MemoryStorage(); let created = 0; const createKey = () => `revision-${++created}`;
  const oldKey = acquireOperationKey("script-revision", "reel", '[1,"old"]', undefined, storage, createKey);
  await acknowledgeKeyedOperation({ kind: "script-revision", id: "reel", key: oldKey, storage, execute: async () => undefined });
  const nextKey = acquireOperationKey("script-revision", "reel", '[1,"new"]', undefined, storage, createKey);
  assert.notEqual(nextKey, oldKey);
});

test("thumbnail acknowledgement allows the next regeneration and terminal consumed retires its key", async () => {
  const storage = new MemoryStorage(); let created = 0; const createKey = () => `thumbnail-${++created}`;
  const oldKey = acquireOperationKey("thumbnail-regeneration", "reel", "regenerate", undefined, storage, createKey);
  await acknowledgeKeyedOperation({ kind: "thumbnail-regeneration", id: "reel", key: oldKey, storage, execute: async () => undefined });
  const nextKey = acquireOperationKey("thumbnail-regeneration", "reel", "regenerate", undefined, storage, createKey);
  assert.notEqual(nextKey, oldKey);
  await assert.rejects(runKeyedOperation({ kind: "thumbnail-regeneration", id: "reel", payload: "regenerate", storage, createKey, execute: async () => { throw terminal("Thumbnail was abandoned"); } }));
  assert.notEqual(acquireOperationKey("thumbnail-regeneration", "reel", "regenerate", undefined, storage, createKey), nextKey);
});

test("an old acknowledgement cannot erase a newer operation", async () => {
  const storage = new MemoryStorage();
  const oldKey = acquireOperationKey("script-revision", "reel", '[1,"old"]', undefined, storage, () => "old");
  const newKey = acquireOperationKey("script-revision", "reel", '[2,"new"]', undefined, storage, () => "new");
  await acknowledgeKeyedOperation({ kind: "script-revision", id: "reel", key: oldKey, storage, execute: async () => undefined });
  assert.equal(acquireOperationKey("script-revision", "reel", '[2,"new"]', undefined, storage, () => "unexpected"), newKey);
});

test("a completed old-version payload cannot poison a future revision", async () => {
  const storage = new MemoryStorage(); let created = 0; const createKey = () => `key-${++created}`;
  await assert.rejects(runKeyedOperation({ kind: "script-revision", id: "reel", payload: '[1,"old"]', storage, createKey, execute: async () => { throw terminal("Revision was abandoned"); } }));
  let used = "";
  await runKeyedOperation({ kind: "script-revision", id: "reel", payload: '[2,"new"]', storage, createKey, execute: async (key) => { used = key; } });
  assert.equal(used, "key-2");
});
