import { CompletionOption, Context, Hover } from "../../types";
import { complete as genericComplete } from "../parser/complete";
import { hover as genericHover } from "../parser/hover";
import { parse as genericParse, WorkflowDocument } from "../parser/parser";
import { MapNodeDesc, NodeDesc, ValueDesc } from "../parser/schema";
import { TTLCache } from "../utils/cache";
import { _getContextProviderFactory } from "./contextCompletion";
import { eventMap, events } from "./schema/events";
import { NeedsCustomValueProvider } from "./schema/needs";
import { actionsInputProvider } from "./valueProvider/actionsInputProvider";

const cache = new TTLCache<ValueDesc[]>();

const value = (description?: string): NodeDesc => ({
  type: "value",
  description,
});

const env: MapNodeDesc = {
  type: "map",
  itemDesc: {
    type: "value",
  },
};

const shell: NodeDesc = {
  type: "value",
  allowedValues: [
    { value: "bash" },
    { value: "pwsh" },
    { value: "python" },
    { value: "sh" },
    { value: "cmd" },
    { value: "powershell" },
  ],
  description:
    "https://help.github.com/en/actions/reference/workflow-syntax-for-github-actions#custom-shell",
};

const defaults: MapNodeDesc = {
  type: "map",
  keys: {
    run: {
      type: "map",
      keys: {
        shell,
        "working-directory": value(),
      },
    },
  },
};

const container = (): NodeDesc => ({
  type: "map",
  keys: {
    image: value(
      "The Docker image to use as the container to run the action. The value can be the Docker Hub image name or a public docker registry name."
    ),
    env,
    ports: {
      type: "sequence",
      itemDesc: value(),
      description: "Sets an array of ports to expose on the container.",
    },
    volumes: {
      type: "sequence",
      itemDesc: value("Pattern: ^[^:]+:[^:]+$"),
      description:
        "Sets an array of volumes for the container to use. You can use volumes to share data between services or other steps in a job. You can specify named Docker volumes, anonymous Docker volumes, or bind mounts on the host.\nTo specify a volume, you specify the source and destination path: <source>:<destinationPath>\nThe <source> is a volume name or an absolute path on the host machine, and <destinationPath> is an absolute path in the container.",
    },
    options: value(
      "Additional Docker container resource options. For a list of options, see https://docs.docker.com/engine/reference/commandline/create/#options."
    ),
  },
  required: ["image"],
});

const runsOn = (context: Context): NodeDesc => ({
  type: "value",
  description:
    "The type of machine to run the job on. The machine can be either a GitHub-hosted runner, or a self-hosted runner.",

  customValueProvider: async () =>
    cache.get("runs-on-labels", context.timeToCacheResponsesInMS, async () => {
      const labels = new Set<string>();
      labels.add("ubuntu-latest");
      labels.add("windows-latest");
      labels.add("macos-latest");
      labels.add("self-hosted");

      if (context?.client?.actions) {
        const runnersResp = await context.client.actions.listSelfHostedRunnersForRepo(
          {
            owner: context.owner,
            repo: context.repository,
          }
        );

        if (runnersResp && runnersResp.data.runners) {
          runnersResp.data.runners.forEach((r) =>
            (r as any)?.labels?.forEach((l: { name: string }) =>
              labels.add(l.name)
            )
          );
        }
      }

      return Array.from(labels.values()).map((x) => ({
        value: x,
      }));
    }),
});

export function _getSchema(context: Context): NodeDesc {
  return {
    type: "map",
    keys: {
      name: {
        type: "value",
        description: `Name of the workflow`,
      },
      env,
      on: {
        type: "oneOf",
        oneOf: [
          // Can be one of the events
          {
            type: "value",
            allowedValues: events,
          },
          // Can be an array of events
          {
            type: "sequence",
            itemDesc: {
              type: "value",
              allowedValues: events,
            },
          },
          // Can be a map of events
          {
            type: "map",
            keys: eventMap,
          },
        ],
      },
      jobs: {
        type: "map",
        itemDesc: {
          type: "map",
          keys: {
            name: value("Optional custom name for this job"),
            env,
            needs: {
              type: "oneOf",
              oneOf: [
                {
                  type: "value",
                  customValueProvider: NeedsCustomValueProvider,
                },
                {
                  type: "sequence",
                  itemDesc: {
                    type: "value",
                    customValueProvider: NeedsCustomValueProvider,
                  },
                },
              ],
            },
            outputs: {
              type: "map",
            },
            defaults,
            if: {
              type: "value",
              isExpression: true,
            },
            "timeout-minutes": value(),
            "continue-on-error": value(),
            container: container(),
            services: {
              type: "map",
              itemDesc: container(),
              description:
                "Additional containers to host services for a job in a workflow. These are useful for creating databases or cache services like redis. The runner on the virtual machine will automatically create a network and manage the life cycle of the service containers.\nWhen you use a service container for a job or your step uses container actions, you don't need to set port information to access the service. Docker automatically exposes all ports between containers on the same network.\nWhen both the job and the action run in a container, you can directly reference the container by its hostname. The hostname is automatically mapped to the service name.\nWhen a step does not use a container action, you must access the service using localhost and bind the ports.",
            },
            "runs-on": {
              type: "oneOf",
              oneOf: [
                runsOn(context),
                {
                  type: "sequence",
                  itemDesc: runsOn(context),
                },
              ],
              description:
                "The type of machine to run the job on. The machine can be either a GitHub-hosted runner, or a self-hosted runner.",
            },
            steps: {
              type: "sequence",
              itemDesc: {
                type: "map",
                keys: {
                  id: value(
                    "A unique identifier for the step. You can use the id to reference the step in contexts. For more information, see https://help.github.com/en/articles/contexts-and-expression-syntax-for-github-actions."
                  ),
                  if: {
                    type: "value",
                    isExpression: true,
                  },
                  name: value("Optional custom name for the step"),
                  uses: value(),
                  run: value(
                    "Runs command-line programs using the operating system's shell. If you do not provide a `name`, the step name will default to the text specified in the `run` command."
                  ),
                  "working-directory": value(),
                  shell,
                  with: {
                    type: "map",
                    customValueProvider: actionsInputProvider(context, cache),
                  },
                  env,
                  "continue-on-error": value(),
                  "timeout-minutes": value(),
                },
              },
            },
            strategy: {
              type: "map",
              keys: {
                matrix: {
                  type: "map",
                  itemDesc: {
                    type: "sequence",
                  },
                  description:
                    "A build matrix is a set of different configurations of the virtual environment. For example you might run a job against more than one supported version of a language, operating system, or tool. Each configuration is a copy of the job that runs and reports a status.\nYou can specify a matrix by supplying an array for the configuration options. For example, if the GitHub virtual environment supports Node.js versions 6, 8, and 10 you could specify an array of those versions in the matrix.\nWhen you define a matrix of operating systems, you must set the required runs-on keyword to the operating system of the current job, rather than hard-coding the operating system name. To access the operating system name, you can use the matrix.os context parameter to set runs-on. For more information, see https://help.github.com/en/articles/contexts-and-expression-syntax-for-github-actions.",
                },
                "fail-fast": value(
                  "When set to true, GitHub cancels all in-progress jobs if any matrix job fails. Default: true"
                ),
                "max-parallel": value(
                  "The maximum number of jobs that can run simultaneously when using a matrix job strategy. By default, GitHub will maximize the number of jobs run in parallel depending on the available runners on GitHub-hosted virtual machines."
                ),
              },
              required: ["matrix"],
            },
          },

          required: ["runs-on", "steps"],
        },
      },
    },

    required: ["on", "jobs"],
  };
}

export async function parse(
  context: Context,
  filename: string,
  input: string
): Promise<WorkflowDocument> {
  return genericParse(
    filename,
    input,
    _getSchema(context),
    _getContextProviderFactory(context, cache)
  );
}

export async function complete(
  context: Context,
  filename: string,
  input: string,
  pos: number
): Promise<CompletionOption[]> {
  return genericComplete(
    filename,
    input,
    pos,
    _getSchema(context),
    _getContextProviderFactory(context, cache)
  );
}

export async function hover(
  context: Context,
  filename: string,
  input: string,
  pos: number
): Promise<Hover | undefined> {
  return genericHover(
    filename,
    input,
    pos,
    _getSchema(context),
    _getContextProviderFactory(context, cache)
  );
}
