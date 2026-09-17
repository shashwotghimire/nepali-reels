export type OperationKind = "script-revision" | "thumbnail-regeneration";

type StoredOperation = { key: string; payload: string };
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const storageName = (kind: OperationKind, id: string) => `phase4:${kind}:${id}`;

function readStored(storage: StorageLike, name: string): StoredOperation | null {
  const raw = storage.getItem(name);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredOperation>;
    return typeof parsed.key === "string" && typeof parsed.payload === "string" ? parsed as StoredOperation : null;
  } catch {
    return { key: raw, payload: "legacy" };
  }
}

export function acquireOperationKey(
  kind: OperationKind,
  id: string,
  payload: string,
  suppliedKey?: string,
  storage: StorageLike = localStorage,
  createKey: () => string = () => crypto.randomUUID(),
) {
  const name = storageName(kind, id);
  const current = readStored(storage, name);
  const key = suppliedKey ?? (current?.payload === payload ? current.key : createKey());
  storage.setItem(name, JSON.stringify({ key, payload } satisfies StoredOperation));
  return key;
}

export function retireOperationKey(
  kind: OperationKind,
  id: string,
  key: string,
  storage: StorageLike = localStorage,
) {
  const name = storageName(kind, id);
  if (readStored(storage, name)?.key === key) storage.removeItem(name);
}

export function isTerminalOperationError(error: unknown) {
  const response = (error as { response?: { status?: number; data?: { error?: string } } })?.response;
  return response?.status === 409 && ["Revision was abandoned", "Thumbnail was abandoned"].includes(response.data?.error ?? "");
}

export async function runKeyedOperation<T>(input: {
  kind: OperationKind;
  id: string;
  payload: string;
  suppliedKey?: string;
  execute: (key: string) => Promise<T>;
  storage?: StorageLike;
  createKey?: () => string;
}) {
  const key = acquireOperationKey(input.kind, input.id, input.payload, input.suppliedKey, input.storage, input.createKey);
  try {
    const result = await input.execute(key);
    retireOperationKey(input.kind, input.id, key, input.storage);
    return result;
  } catch (error) {
    if (isTerminalOperationError(error)) retireOperationKey(input.kind, input.id, key, input.storage);
    throw error;
  }
}

export async function acknowledgeKeyedOperation<T>(input: {
  kind: OperationKind;
  id: string;
  key: string;
  execute: () => Promise<T>;
  storage?: StorageLike;
}) {
  const result = await input.execute();
  retireOperationKey(input.kind, input.id, input.key, input.storage);
  return result;
}
