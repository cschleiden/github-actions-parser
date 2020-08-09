import { getEventPayload } from "../events/eventPayload";
import { replaceExpressions } from "../expressions";
import { containsExpression } from "../expressions/embedding";
import { ContextProvider } from "../expressions/types";
import { Workflow } from "../parser/parser";
import { iteratePath, PropertyPath } from "../utils/path";

function getEvent(workflow: Workflow) {
  if (workflow && workflow.on) {
    return getEventPayload(Object.keys(workflow.on));
  }

  // Default to push, since it's one of the most common payloads
  return getEventPayload(["push"]);
}

export class EditContextProvider implements ContextProvider {
  constructor(
    private workflow: Workflow,
    private path: PropertyPath,
    private secrets: string[]
  ) {}

  get(
    context:
      | "github"
      | "env"
      | "job"
      | "steps"
      | "runner"
      | "secrets"
      | "strategy"
      | "matrix"
      | "needs"
  ): Object {
    switch (context) {
      case "github":
        return {
          event: getEvent(this.workflow),
          event_path: "",
          workflow: this.workflow?.name || "workflow.yaml",
          job: "",
          run_id: "42",
          run_number: "23",
          actor: "monalisa",
          repository: "repository",
          repository_owner: "repository_owner",
          event_name:
            (this.workflow?.on && Object.keys(this.workflow.on)[0]) || "push",
          sha: "6113728f27ae82c7b1a177c8d03f9e96e0adf246",
          ref: "main",
          head_ref: "refs/heads/branch",
          base_ref: "refs/heads/main",
          token: "***",
          workspace: "",
          action: "",
          action_path: "",
        };

      case "env":
        let env = {};

        if (this.workflow) {
          iteratePath(this.path, this.workflow, (x) => {
            if (x["env"]) {
              const newEnv = {
                ...x["env"],
              };

              for (const key of Object.keys(newEnv)) {
                const value = newEnv[key];
                if (containsExpression(value)) {
                  try {
                    newEnv[key] = replaceExpressions(value, {
                      get: (context) => {
                        if (context === "env") {
                          return env;
                        }

                        return this.get(context);
                      },
                    });
                  } catch (e) {
                    // This is best effort, leave the expression as value
                  }
                }
              }

              env = {
                ...env,
                ...newEnv,
              };
            }
          });
        }

        return env;

      case "runner": {
        return {
          os: "macOS",
          temp: "/tmp",
          tool_cache: "/tmp/cache",
        };
      }

      case "job": {
        return {
          status: "success",
          // TODO: CS: Other job parameters
        };
      }

      case "needs": {
        // TOOD: CS: This needs a properly parsed workflow,
        return {
          /*
          <job id>.result
          <job id>.outputs {
            <outputname>
          }
          */
        };
      }

      case "matrix": {
        return {};
      }

      case "steps": {
        // TODO: CS: Previous steps
        return {};
      }

      case "secrets":
        return this.secrets.reduce((s, name) => {
          s[name] = "***";
          return s;
        }, {});
    }
  }
}
