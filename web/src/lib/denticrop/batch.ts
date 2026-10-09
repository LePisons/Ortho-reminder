// Bounded queue adapted from Orthocrop's useImageProcessor. Each item is claimed
// once; failures belong to their row and do not prevent later items from running.
export async function runBatch<T>(
  items: readonly T[],
  concurrency: number,
  work: (item: T) => Promise<void>,
) {
  let cursor = 0;
  const errors: unknown[] = [];
  await Promise.all(
    Array.from(
      { length: Math.min(items.length, Math.max(1, concurrency)) },
      async () => {
        while (cursor < items.length) {
          const item = items[cursor++];
          try {
            await work(item);
          } catch (error) {
            errors.push(error);
          }
        }
      },
    ),
  );
  if (errors.length)
    throw new AggregateError(errors, "No se completaron todos los elementos.");
}
