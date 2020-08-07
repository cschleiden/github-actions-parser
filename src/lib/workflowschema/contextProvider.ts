import { evaluateExpression, isExpression } from "../expressions";
import { ContextProvider } from "../expressions/types";
import { Workflow } from "../parser/parser";
import { iteratePath, PropertyPath } from "../utils/path";

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
        // TODO: CS: Need to derive this from the events the workflow is listening on, and then present
        // the intersection of the payloads...
        return {
          event_name: "push",
          event: {
            action: "hello",
          },
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
                if (isExpression(value)) {
                  newEnv[key] = evaluateExpression(value, {
                    get: (context) => {
                      if (context === "env") {
                        return env;
                      }

                      return this.get(context);
                    },
                  });
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

      case "secrets":
        return this.secrets.reduce((s, name) => {
          s[name] = "***";
          return s;
        }, {});
    }
  }
}
