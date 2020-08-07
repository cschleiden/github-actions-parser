import { ContextProviderFactory } from "../parser/complete";
import { Workflow } from "../parser/parser";
import { TTLCache } from "../utils/cache";
import { PropertyPath } from "../utils/path";
import { EditContextProvider } from "./contextProvider";
import { Context } from "./workflowSchema";

export function _getContextProviderFactory(
  context: Context,
  cache: TTLCache<any>
): ContextProviderFactory {
  return {
    get: async (workflow: Workflow, path: PropertyPath) =>
      new EditContextProvider(
        workflow,
        path,
        await cache.get(
          "secrets",
          context.timeToCacheResponsesInMS,
          async () => {
            // Use a set to dedupe repo and org secrets
            const secrets = new Set<string>(["GITHUB_TOKEN"]);

            // Get repo secrets
            const p: Promise<unknown>[] = [];
            p.push(
              (async () => {
                const repoSecretsResponse = await context.client.actions.listRepoSecrets(
                  {
                    owner: context.owner,
                    repo: context.repository,
                  }
                );

                repoSecretsResponse.data.secrets.forEach((x) =>
                  secrets.add(x.name)
                );
              })()
            );

            // Get org secrets
            if (context.ownerIsOrg) {
              p.push(
                (async () => {
                  const orgSecretsResponse = await context.client.actions.listOrgSecrets(
                    {
                      org: context.owner,
                      repo: context.repository,
                    }
                  );

                  orgSecretsResponse.data.secrets.forEach((x) =>
                    secrets.add(x.name)
                  );
                })()
              );
            }

            await Promise.all(p);

            return Array.from(secrets.values());
          }
        )
      ),
  };
}
