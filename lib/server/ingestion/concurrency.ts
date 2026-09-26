/**
 * Executes an array of asynchronous tasks with a strict concurrency bound.
 * Guarantees that at most `limit` tasks run in parallel.
 *
 * @param items Array of items to process
 * @param limit Maximum number of concurrent tasks (worker pool size)
 * @param worker Async function invoked per item
 * @returns Array of results in original item order
 */
export async function runConcurrentPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const concurrency = Math.max(1, Math.min(limit, items.length));
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const runWorker = async () => {
    while (nextIndex < items.length) {
      const idx = nextIndex++;
      results[idx] = await worker(items[idx], idx);
    }
  };

  const pool = Array.from({ length: concurrency }, () => runWorker());
  await Promise.all(pool);
  return results;
}
