const funcDescription = {
  toJSON:
    "Returns a pretty-print JSON representation of `value`. You can use this function to debug the information provided in contexts.",
};

export const Undetermined = {};

export function getFunctionDescription(f: string): string | undefined {
  return funcDescription[f];
}

export function contains<T>(haystack: T | T[], needle: T): boolean {
  if (Array.isArray(haystack)) {
    return haystack.indexOf(needle) !== -1;
  } else {
    return (
      ("" + haystack)
        .toLocaleLowerCase()
        .indexOf(("" + needle).toLocaleLowerCase()) !== -1
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

export function toJSON(input: unknown): string {
  return JSON.stringify(input);
}

export function fromJSON(input: string | typeof Undetermined): unknown {
  if (typeof input === "string") {
    return JSON.parse(input);
  }

  if (input === Undetermined) {
    return Undetermined;
  }

  throw new Error("Unknown input for `fromJSON`");
}

export function hashFiles(path: string[]): string {
  return `sha-256-hash-for-${path.join()}`;
}

export function format(format: string, ...params: string[]): string {
  let idx = 0;
  format = format.replace(/(\{\d+\})/gm, () => params[idx++]);
  return format.replace("{{", "{").replace("}}", "}");
}

export function always(): boolean {
  return true;
}

export function failure() {
  return Undetermined;
}

export function success() {
  return Undetermined;
}

export function cancelled() {
  return Undetermined;
}
