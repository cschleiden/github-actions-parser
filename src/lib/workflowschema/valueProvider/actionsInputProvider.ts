import { safeLoad } from "js-yaml";
import { Context } from "../../../types";
import { Workflow } from "../../parser/parser";
import { CustomValueProvider, NodeDesc, ValueDesc } from "../../parser/schema";
import { iteratePath, PropertyPath } from "../../utils/path";

export const actionsInputProvider = (
  context: Context
): CustomValueProvider => async (
  desc: NodeDesc,
  workflow: Workflow | undefined,
  path: PropertyPath
): Promise<ValueDesc[]> => {
  if (!workflow) {
    return [];
  }

  // jobs:
  //   foo:
  //     steps:
  //     - uses: "actions/checkout@v2"
  //       with:
  //         | <- This is where this gets called

  // First, find the `uses`
  if (path[path.length - 1] === "with") {
    path.pop();
  }

  const step = iteratePath(path, workflow);
  const uses = step["uses"];
  if (!uses) {
    return [];
  }

  try {
    const [actionsOwner, actionsRepo] = uses.split("@")[0].split("/");

    const contentResp = await context.client.repos.getContent({
      owner: actionsOwner,
      repo: actionsRepo,
      path: "action.yml",
      // ref : TODO: CS: Parse `uses` here!
    });
    if (contentResp?.data?.content) {
      const buff = new Buffer(contentResp.data.content, "base64");
      const text = buff.toString("ascii");
      const m = safeLoad(text);
      const inputs = m["inputs"];
      if (inputs) {
        return Object.keys(inputs).map((key) => ({
          value: key,
          description: `${
            inputs[key].description || ""
          } \n\nrequired: \`${!!inputs[key].required}\` \n\n${
            (inputs[key].default && `default:\`${inputs[key].default}\``) || ""
          }`,
        }));
      }
    }
  } catch (e) {
    console.error(e);
  }

  return [];
};
