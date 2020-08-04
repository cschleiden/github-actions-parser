import { ExpressionContextCompletion } from "../expressions/completion";
import { WorkflowDocument } from "../parser/parser";
import { CompletionOption } from "../parser/types";
import { iteratePath, PropertyPath } from "../utils/path";
import { Context } from "./workflowSchema";

export function _getExpressionCompleter(
  ctx: Context
): ExpressionContextCompletion {
  return {
    completeContext: async (
      context: string,
      doc: WorkflowDocument,
      path: PropertyPath
    ): Promise<CompletionOption[]> => {
      switch (context) {
        case "env": {
          const options: string[] = [];

          if (doc.workflow) {
            iteratePath(path, doc.workflow, (x) => {
              if (x["env"]) {
                options.push(...Object.keys(x["env"]));
              }
            });
          }

          return options.map((value) => ({ value }));
        }

        case "secrets": {
          const result: CompletionOption[] = [];

          // Get repo secrets
          const repoSecretsResponse = await ctx.client.actions.listRepoSecrets({
            owner: ctx.owner,
            repo: ctx.repository,
          });

          result.push(
            ...repoSecretsResponse.data.secrets.map((s) => ({
              value: s.name,
            }))
          );

          // Get org secrets
          if (ctx.ownerIsOrg) {
            const orgSecretsResponse = await ctx.client.actions.listOrgSecrets({
              org: ctx.owner,
              repo: ctx.repository,
            });

            result.push(
              ...orgSecretsResponse.data.secrets.map((s) => ({
                value: s.name,
              }))
            );
          }

          return result;
        }
      }

      return [];
    },
  };
}
