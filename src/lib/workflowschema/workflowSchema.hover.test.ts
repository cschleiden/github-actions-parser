import { ContextProviderFactory } from "../parser/complete";
import { hover } from "../parser/hover";
import { Context, _getSchema } from "./workflowSchema";

const context: Context = {
  client: null,
  owner: "owner",
  repository: "repository",
};
const WorkflowSchema = _getSchema(context);

const NullCompletion: ContextProviderFactory = {
  get: async () => ({
    get: async (context: string) => {
      switch (context) {
        case "secrets": {
          return {
            AZURE_KEY: "",
          };
        }
      }

      return {};
    },
  }),
};

describe("Hover", () => {
  /** | in string denotes cursor position */
  const testHover = async (input: string) => {
    const pos = input.indexOf("|");
    input = input.replace("|", "");
    return await hover(input, pos, WorkflowSchema, NullCompletion);
  };

  /** | in string denotes cursor position */
  const hoverSimple = async (input: string, expected: string) => {
    const hover = await testHover(input);

    expect(hover).not.toBeUndefined();
    expect(hover.description).toEqual(expected);
  };

  describe("values", () => {
    it("description for event", () =>
      hoverSimple(
        "on: check|_run",
        "Runs your workflow anytime the check_run event occurs. More than one activity type triggers this event. " +
          "For information about the REST API, see https://developer.github.com/v3/checks/runs."
      ));

    it("description for inline sequence", () =>
      hoverSimple(
        "on: [ push, check|_run ]",
        "Runs your workflow anytime the check_run event occurs. More than one activity type triggers this event. " +
          "For information about the REST API, see https://developer.github.com/v3/checks/runs."
      ));

    it("description for event in sequence", () =>
      hoverSimple(
        "on:\n  - check|_run",
        "Runs your workflow anytime the check_run event occurs. More than one activity type triggers this event. " +
          "For information about the REST API, see https://developer.github.com/v3/checks/runs."
      ));
  });
});
