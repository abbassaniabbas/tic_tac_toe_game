/** Small SecureStore values; the manifest switches only after every new chunk is saved. */
export interface SecureStoragePort {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}
interface Manifest {
  generation: string;
  count: number;
}
export function createChunkedStorage(
  port: SecureStoragePort,
  uuid: () => string,
) {
  let queue: Promise<unknown> = Promise.resolve();
  function serial<T>(action: () => Promise<T>): Promise<T> {
    const next = queue.then(action, action);
    queue = next.catch(() => undefined);
    return next;
  }
  function base(key: string) {
    if (!/^[a-zA-Z0-9._-]+$/.test(key)) throw new Error("Invalid storage key");
    return `${key}.manifest`;
  }
  function readManifest(raw: string | null): Manifest | null {
    if (!raw) return null;
    try {
      const m = JSON.parse(raw);
      if (
        /^[a-zA-Z0-9-]+$/.test(m.generation) &&
        Number.isInteger(m.count) &&
        m.count > 0 &&
        m.count <= 128
      )
        return m;
    } catch {}
    return null;
  }
  const chunkKey = (key: string, m: Manifest, index: number) =>
    `${key}.${m.generation}.${index}`;
  async function clean(key: string, m: Manifest | null) {
    if (m)
      await Promise.all(
        Array.from({ length: m.count }, (_, i) =>
          port.remove(chunkKey(key, m, i)),
        ),
      );
  }
  return {
    getItem(key: string): Promise<string | null> {
      return serial(async () => {
        const m = readManifest(await port.get(base(key)));
        if (!m) return null;
        const chunks = await Promise.all(
          Array.from({ length: m.count }, (_, i) =>
            port.get(chunkKey(key, m, i)),
          ),
        );
        return chunks.some((c) => c === null) ? null : chunks.join("");
      });
    },
    setItem(key: string, value: string): Promise<void> {
      return serial(async () => {
        const manifestKey = base(key);
        const points = Array.from(value);
        const count = Math.max(1, Math.ceil(points.length / 400));
        if (count > 128)
          throw new Error("Session exceeds secure storage limit");
        const old = readManifest(await port.get(manifestKey));
        const m = { generation: uuid(), count };
        if (!/^[a-zA-Z0-9-]+$/.test(m.generation))
          throw new Error("Invalid storage generation");
        try {
          for (let i = 0; i < count; i++)
            await port.set(
              chunkKey(key, m, i),
              points.slice(i * 400, (i + 1) * 400).join(""),
            );
          await port.set(manifestKey, JSON.stringify(m));
        } catch (e) {
          await clean(key, m).catch(() => undefined);
          throw e;
        }
        await clean(key, old).catch(() => undefined);
      });
    },
    removeItem(key: string): Promise<void> {
      return serial(async () => {
        const m = readManifest(await port.get(base(key)));
        await port.remove(base(key));
        await clean(key, m);
      });
    },
  };
}
