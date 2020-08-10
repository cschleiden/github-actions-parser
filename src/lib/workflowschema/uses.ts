import { Uses } from "../workflow";

export function parseUses(input: string): Uses | undefined {
  if (input.indexOf("@") !== -1) {
    // Remote uses
    const [x, ref] = input.split("@");
    const [_, owner, repository, subdirectory] = x.match(
      /([^\/]*)\/([^\/]*)\/?(.*)?/
    );

    return {
      type: "remote",
      ref,
      owner,
      repository,
      subdirectory,
    };
  } else if (input.indexOf("docker://") !== -1) {
    // TODO: Parse docker uses
    return {
      type: "docker",
    };
  } else {
    // Local
    return {
      type: "local",
    };
  }

  return undefined;
}
