import { ExpressionContextCompletion } from "../expressions/completion";
import { WorkflowDocument } from "../parser/parser";
import { CompletionOption } from "../parser/types";
import { TTLCache } from "../utils/cache";
import { iteratePath, PropertyPath } from "../utils/path";
import { Context } from "./workflowSchema";

export function _getExpressionCompleter(
  ctx: Context
): ExpressionContextCompletion {
  const cache = new TTLCache<CompletionOption[]>(500);

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
          return cache.get("secrets", async () => {
            // Use a set to dedupe repo and org secrets
            const secrets = new Set<string>(["GITHUB_TOKEN"]);

            // Get repo secrets
            const repoSecretsResponse = await ctx.client.actions.listRepoSecrets(
              {
                owner: ctx.owner,
                repo: ctx.repository,
              }
            );

            repoSecretsResponse.data.secrets.forEach((x) =>
              secrets.add(x.name)
            );

            // Get org secrets
            if (ctx.ownerIsOrg) {
              const orgSecretsResponse = await ctx.client.actions.listOrgSecrets(
                {
                  org: ctx.owner,
                  repo: ctx.repository,
                }
              );

              orgSecretsResponse.data.secrets.forEach((x) =>
                secrets.add(x.name)
              );
            }

            return Array.from(secrets.values()).map((x) => ({ value: x }));
          });
        }
      }

      return [];
    },
  };
}
