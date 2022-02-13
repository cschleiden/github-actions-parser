import { Context } from "../../types";
import { ContextProviderFactory } from "../parser/complete";
import { EditContextProvider } from "./contextProvider";
import { PropertyPath } from "../utils/path";
import { Workflow } from "../workflow";
import { _getSchema } from "./workflowSchema";
import { hover } from "../parser/hover";

const context: Context = {
  client: null,
  owner: "owner",
  repository: "repository",
};
const WorkflowSchema = _getSchema(context);
const ExpressionContextProviderFactory: ContextProviderFactory = {
  get: async (workflow: Workflow, path: PropertyPath) =>
    new EditContextProvider(workflow, path, []),
};

describe("Hover", () => {
  /** | in string denotes cursor position */
  const testHover = async (input: string) => {
    const pos = input.indexOf("|");
    input = input.replace("|", "");
    return await hover(
      "workflow.yml",
      input,
      pos,
      WorkflowSchema,
      ExpressionContextProviderFactory
    );
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

  describe("keys", () => {
    it("description for event using map", () =>
      hoverSimple(
        "on:\n  check|_run:",
        "Runs your workflow anytime the check_run event occurs. More than one activity type triggers this event. " +
          "For information about the REST API, see https://developer.github.com/v3/checks/runs."
      ));

    it("description for event using map", () =>
      hoverSimple(
        "on: push\njobs:\n  build:\n    runs|-on: ubuntu-latest",
        "The type of machine to run the job on. The machine can be either a GitHub-hosted runner, or a self-hosted runner."
      ));

    it("description for job using environment", () =>
      hoverSimple(
        "on: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    environmen|t: prod",
        "The environment that the job references. All environment protection rules must pass before a job referencing the environment is sent to a runner. For more information, see [Environments](https://docs.github.com/en/free-pro-team@latest/actions/reference/environments).\n\nYou can provide the environment as only the environment `name`, or as an environment object with the `name` and `url`."
      ));
  });

  describe("expressions", () => {
    it("evaluates simple expressions", () =>
      hoverSimple(
        `env:
  WF_VALUE: 42
jobs:
  build:
    name: \${{ env.WF|_VALUE }}`,
        "Evaluates to: `42`"
      ));

    it("evaluates multiple expressions", () =>
      hoverSimple(
        `env:
  WF_VALUE: 42
  WF2: 23
jobs:
  build:
    name: \${{ env.WF|_VALUE }} -- \${{ env.WF2 }}`,
        "Evaluates to: `42 -- 23`"
      ));

    it("evaluates complex expressions", () =>
      hoverSimple(
        `env:
  WF_VALUE: 42
  WF2: 23
jobs:
  build:
    name: \${{ env.WF|_VALUE == env.WF2 }}`,
        "Evaluates to: `false`"
      ));

    it("evaluates expression with referencing env variables", () =>
      hoverSimple(
        `on:\n  push:\n
env:
  WF_VALUE: 42
  WF2: \${{ github.event.ref }}
jobs:
  build:
    name: \${{ env.W|F2 }}`,
        "Evaluates to: `refs/tags/simple-tag`"
      ));

    it("evaluates workflow_dispatch default inputs", () =>
      hoverSimple(
        `on:
  workflow_dispatch:
    inputs:
      bar:
        type: number
        default: 42
jobs:
  build:
    steps:
      - run: echo \${{ github.event.inputs.b|ar }}`,
        "Evaluates to: `echo 42`"
      ));

    it("evaluates workflow_dispatch inputs", () =>
      hoverSimple(
        `on:
  workflow_dispatch:
    inputs:
      foo:
jobs:
  build:
    steps:
      - run: echo \${{ github.event.inputs.fo|o }}`,
        "Evaluates to: `echo <provided input>`"
      ));

    it("evaluates steps context", () =>
      hoverSimple(
        `on: push
jobs:
  build:
    steps:
      - run: echo 123
      - run: echo \${{ steps['1'].ou|tcome }}`,
        "Evaluates to: `echo success`"
      ));
  });
});
