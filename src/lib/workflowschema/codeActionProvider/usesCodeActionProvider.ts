import { CodeActionKind, Range, TextEdit } from "vscode-languageserver-types";
import { CodeActionProvider, WorkflowCodeAction } from "../../parser/schema";
import { RemoteUses, Uses } from "../../workflow";

import { Context } from "../../../types";
import { TTLCache } from "../../utils/cache";
import { codeActionResolvers } from "./codeActionProviders";
import { iteratePath } from "../../utils/path";

export type UsesCodeAction = WorkflowCodeAction<{
  uses: RemoteUses;
}>;

export const usesCodeActionProvider = (
  context: Context,
  cache: TTLCache
): CodeActionProvider => ({
  provideCodeActions: async (
    documentUri: string,
    range: Range,
    desc,
    workflow,
    path
  ): Promise<UsesCodeAction[] | undefined> => {
    if (!workflow || !context.client) {
      return [];
    }

    // jobs:
    //   foo:
    //     steps:
    //     - uses: "actions/checkout@v2" <- This is where this gets called
    const uses = iteratePath(path, workflow) as Uses;
    if (!uses || uses.type !== "remote") {
      return [];
    }

    if (!/([a-f0-9]){40}/.test(uses.ref)) {
      // Ref does not look like a full sha
      return [
        {
          title: "Security: use full SHA for action reference",
          data: {
            documentUri,
            range,
            kind: "uses-full-sha",
            workflow,
            uses,
          },
          kind: CodeActionKind.QuickFix,
        },
      ];
    }
  },
});

codeActionResolvers["uses-full-sha"] = async (
  context: Context,
  codeAction: UsesCodeAction
) => {
  if (!context.client) {
    return;
  }

  const { documentUri, range, uses } = codeAction.data;
  const { owner, repository, ref } = uses;

  const result = await context.client.git.getTree({
    owner,
    repo: repository,
    tree_sha: ref, // This should support both tags, branches, and (short-)shas
  });
  if (result.status === 200) {
    codeAction.edit = {
      changes: {
        [documentUri]: [
          TextEdit.replace(range, `${owner}/${repository}@${result.data.sha}`),
        ],
      },
    };

    return codeAction;
  }

  return undefined;
};
