import { safeLoad } from "js-yaml";
import { Context } from "../../../types";
import { Workflow } from "../../parser/parser";
import {
  CustomValue,
  CustomValueProvider,
  CustomValueValidation,
  NodeDesc,
} from "../../parser/schema";
import { TTLCache } from "../../utils/cache";
import { iteratePath, PropertyPath } from "../../utils/path";
import { parseUses, RemoteUses } from "../uses";

async function getActionYamlContent(
  context: Context,
  uses: RemoteUses
): Promise<string | undefined> {
  // TODO: CS: Think about how to surface API errors to consumers of the library. E.g., the token might
  // be invalid, or it might not meet SSO requirements
  let contentResp = await context.client.repos.getContent({
    owner: uses.owner,
    repo: uses.name,
    path: "action.yml",
    ref: uses.ref,
  });

  if (contentResp.status === 404) {
    contentResp = await context.client.repos.getContent({
      owner: uses.owner,
      repo: uses.name,
      path: "action.yaml",
      ref: uses.ref,
    });
  }

  if (contentResp?.data?.content) {
    const buff = new Buffer(contentResp.data.content, "base64");
    const text = buff.toString("ascii");
    return text;
  }

  return undefined;
}

export const actionsInputProvider = (
  context: Context,
  cache: TTLCache<any>
): CustomValueProvider => async (
  desc: NodeDesc,
  workflow: Workflow | undefined,
  path: PropertyPath
): Promise<CustomValue[]> => {
  if (!workflow) {
    return [];
  }

  // jobs:
  //   foo:
  //     steps:
  //     - uses: "actions/checkout@v2"
  //       with:
  //         | <- This is where this gets called

  // First, find the `uses`. Strip of the last `with`, need the step level
  if (path[path.length - 1] === "with") {
    path.pop();
  }

  const step = iteratePath(path, workflow);
  const usesInput = step["uses"];
  if (!usesInput) {
    return [];
  }

  try {
    const uses = parseUses(usesInput);
    if (uses && "owner" in uses) {
      return cache.get(usesInput, undefined, async () => {
        const text = await getActionYamlContent(context, uses);
        if (text) {
          const { inputs } = safeLoad(text);
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
        }
      });
    }
  } catch (e) {
    console.error(e);
  }

  return [];
};
