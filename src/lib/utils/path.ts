export type PropertyPath = (string | [string, number])[];

export function iteratePath(
  path: PropertyPath,
  obj: unknown,
  f?: (x: unknown) => void
) {
  for (const p of path) {
    if (p == "$") continue;
    if (!obj) break;

    f && f(obj);

    if (typeof p === "string") {
      obj = obj[p];
    } else {
      // Sequence
      obj = obj[p[0]][p[1]];
    }
  }

  return obj;
}
