import { Context } from "../../types";
import { ContextProviderFactory } from "../parser/complete";
import { DynamicContext } from "../expressions/types";
import { EditContextProvider } from "./contextProvider";
import { PropertyPath } from "../utils/path";
import { TTLCache } from "../utils/cache";
import { Workflow } from "../workflow";

export function _getContextProviderFactory(
  context: Context,
  cache: TTLCache
): ContextProviderFactory {
  return {
    get: async (workflow: Workflow, path: PropertyPath) => {
      let secrets: string[] | typeof DynamicContext;

      try {
        secrets = await cache.get(
          `${context.owner}/${context.repository}/secrets`,
          context.timeToCacheResponsesInMS,
          async () => {
            if (!context?.client?.actions) {
              return DynamicContext;
            }

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

            return Array.from(secrets.values());
          }
        );
      } catch (e) {
        // TODO: CS: Provide this error somehow to the caller to display to the user
        console.error(e);
        secrets = ["GITHUB_TOKEN", `:: Could not load secrets: ${e?.message}`];
      }

      return new EditContextProvider(workflow, path, secrets);
    },
  };
}
