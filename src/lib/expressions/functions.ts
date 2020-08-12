const funcDescription = {
  toJson:
    "Returns a pretty-print JSON representation of `value`. You can use this function to debug the information provided in contexts.",
};

export function getFunctionDescription(f: string): string | undefined {
  return funcDescription[f];
}

export function contains<S extends T[] | string, T>(
  haystack: S,
  needle: T
): boolean {
  if (Array.isArray(haystack)) {
    return haystack.indexOf(needle) !== -1;
  } else if (typeof haystack === "string") {
    return (
      ("" + haystack)
        .toLocaleLowerCase()
        .indexOf((needle as any).toLocaleLowerCase()) !== -1
    );
  }
}

export function startsWith(haystack: string, needle: string): boolean {
  return haystack.startsWith(needle);
}

export function endsWith(haystack: string, needle: string): boolean {
  return haystack.endsWith(needle);
}

export function join<T>(arr: T[], separator?: string): string {
  return arr.join(separator);
}

export function toJson(input: unknown): string {
  return JSON.stringify(input);
}

export function fromJson(input: string): unknown {
  return JSON.parse(input);
}

export function hashFiles(path: string[]): string {
  return `sha-256-hash-for-${path.join()}`;
}

export function format(format: string, ...params: string[]): string {
  let idx = 0;
  format = format.replace(/(\{\d+\})/gm, () => params[idx++]);
  return format.replace("{{", "{").replace("}}", "}");
}
