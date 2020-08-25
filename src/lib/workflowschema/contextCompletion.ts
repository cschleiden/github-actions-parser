import { Context } from "../../types";
import { ContextProviderFactory } from "../parser/complete";
import { TTLCache } from "../utils/cache";
import { PropertyPath } from "../utils/path";
import { Workflow } from "../workflow";
import { EditContextProvider } from "./contextProvider";

export function _getContextProviderFactory(
  context: Context,
  cache: TTLCache
): ContextProviderFactory {
  return {
    get: async (workflow: Workflow, path: PropertyPath) => {
      let secrets: string[];

      try {
        secrets = await cache.get(
          `${context.owner}/${context.repository}/secrets`,
          context.timeToCacheResponsesInMS,
          async () => {
            // Use a set to dedupe repo and org secrets
            const secrets = new Set<string>(["GITHUB_TOKEN"]);

            if (context?.client?.actions) {
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
              if (context.ownerIsOrg && context.orgFeaturesEnabled) {
                // Org secrets need more permissions and are more likely to fail. If we cannot get org secrets
                // we still want to return the repo secrets.
                p.push(
                  (async () => {
                    try {
                      const orgSecretsResponse = await context.client.actions.listOrgSecrets(
                        {
                          org: context.owner,
                          repo: context.repository,
                        }
                      );

                      orgSecretsResponse.data.secrets.forEach((x) =>
                        secrets.add(x.name)
                      );
                    } catch (e) {
                      console.error(e);
                      secrets.add(
                        `:: Could not retrieve org secrets {e.?message}`
                      );
                    }
                  })()
                );
              }

              await Promise.all(p);
            }

            return Array.from(secrets.values());
          }
        );
      } catch (e) {
        console.error(e);
        secrets = ["GITHUB_TOKEN", `:: Could not load secrets: ${e?.message}`];
      }

      return new EditContextProvider(workflow, path, secrets);
    },
  };
}
