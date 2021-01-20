import {
  CustomValue,
  CustomValueProvider,
  CustomValueValidation,
  NodeDesc,
} from "../../parser/schema";
import { PropertyPath, iteratePath } from "../../utils/path";
import { RemoteUses, Step, Workflow } from "../../workflow";

import { Context } from "../../../types";
import { TTLCache } from "../../utils/cache";
import { load } from "js-yaml";

async function getActionYamlContent(
  context: Context,
  uses: RemoteUses
): Promise<string | undefined> {
  if (context?.client?.repos) {
    // TODO: CS: Think about how to surface API errors to consumers of the library. E.g., the token might
    // be invalid, or it might not meet SSO requirements
    let contentResp = await context.client.repos.getContent({
      owner: uses.owner,
      repo: uses.repository,
      path: "action.yml",
      ref: uses.ref,
    });

    if (contentResp.status === 404) {
      // There isn't an API to easily get two different files, when we cannot find `action.yml`, look
      // for `action.yaml`, too.
      // It might be okay to make two calls in parallel but for now this seems to work.
      contentResp = await context.client.repos.getContent({
        owner: uses.owner,
        repo: uses.repository,
        path: "action.yaml",
        ref: uses.ref,
      });
    }

    if (contentResp?.data?.content) {
      // Response is base64 encoded, so decode
      const buff = Buffer.from(contentResp.data.content, "base64");
      let text = buff.toString("utf-8");
      // Remove any null bytes - see https://github.com/cschleiden/vscode-github-actions/issues/42
      text = text.replace("\0", "");
      return text;
    }
  }

  return undefined;
}

export const actionsInputProvider = (
  context: Context,
  cache: TTLCache
): CustomValueProvider => async (
  _: NodeDesc,
  workflow: Workflow | undefined,
  path: PropertyPath
): Promise<CustomValue[] | undefined> => {
  if (!workflow) {
    return [];
  }

  // jobs:
  //   foo:
  //     steps:
  //     - uses: "actions/checkout@v2"
  //       with:
  //         | <- This is where this gets called

  // First, find the `uses`. Strip of the last `with` in the path, need the step level
  if (path[path.length - 1] === "with") {
    path.pop();
  }

  const step = iteratePath(path, workflow) as Step;
  if (!step || !("uses" in step) || step.uses.type !== "remote") {
    return [];
  }

  const uses = step.uses;

  return cache.get<CustomValue[] | undefined>(
    `${uses.owner}/${uses.repository}@${uses.ref}`,
    // Cache actions parameters for a long time
    1_000 * 60 * 60,
    async (): Promise<CustomValue[] | undefined> => {
      const text = await getActionYamlContent(context, uses);
      if (text) {
        try {
          const { inputs } = load(text, {
            json: true, // Support unicode characters in unquoted strings
          });
          if (inputs) {
            return Object.keys(inputs).map((key) => ({
              value: key,
              description: `${
                inputs[key].description || ""
              } \n\nrequired: \`${!!inputs[key].required}\` \n\n${
                (inputs[key].default && `default:\`${inputs[key].default}\``) ||
                ""
              }`,
              validation: !!inputs[key].required
                ? CustomValueValidation.Required
                : CustomValueValidation.None,
            }));
          }
        } catch (e) {
          console.error(e);
        }
      }

      return undefined;
    }
  );
};
