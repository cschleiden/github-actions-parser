export interface RemoteUses {
  ref: string;

  owner: string;

  name: string;
}

export interface LocalUses {
  path: string;
}

export type Uses = RemoteUses | LocalUses;

export function parseUses(input: string): Uses | undefined {
  if (input.indexOf("@") !== -1) {
    // Remote uses
    const [x, ref] = input.split("@");
    const [owner, name] = x.split("/");

    return {
      ref,
      owner,
      name,
    };
  } else {
    // TODO: CS: support local
  }

  return undefined;
}
