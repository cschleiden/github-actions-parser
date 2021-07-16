import { ContextProviderFactory, complete } from "../parser/complete";

import { Context } from "../../types";
import { EditContextProvider } from "./contextProvider";
import { PropertyPath } from "../utils/path";
import { Workflow } from "../workflow";
import { _getSchema } from "./workflowSchema";
import { events } from "./schema/events";

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

describe("Completion", () => {
  /** | in string denotes cursor position */
  const testComplete = async (input: string) => {
    const pos = input.indexOf("|");
    input = input.replace("|", "");
    return await complete(
      "workflow.yaml",
      input,
      pos,
      WorkflowSchema,
      ExpressionContextProviderFactory
    );
  };

  /** | in string denotes cursor position */
  const completeSimple = async (input: string, expected: string[]) => {
    const suggestions = await testComplete(input);

    expect(suggestions.map((x) => x.value)).toEqual(expected);
  };

  describe("map", () => {
    it("completes top level keys", async () => {
      await completeSimple("|", ["defaults", "env", "jobs", "name", "on"]);
      await completeSimple("n|", ["name"]);

      await completeSimple("name: workflow\n|", [
        "defaults",
        "env",
        "jobs",
        "on",
      ]);
    });

    it("complete top level key in workflow", () =>
      completeSimple(
        "name: test\non:\n  pull_request:\n    types:\n    - assigned\n|",
        ["defaults", "env", "jobs"]
      ));

    it("complete top level key in workflow with trailing whitespace", () =>
      completeSimple(
        "name: test\non:\n  pull_request:\n    types:\n    - assigned\n|     ",
        ["defaults", "env", "jobs"]
      ));
  });

  describe("on", () => {
    it("value", async () => {
      await completeSimple(
        "on: |\n\n",
        events.map((x) => x.value)
      );
    });

    it("value with other keys", async () => {
      await completeSimple(
        "on: |\n\njobs:",
        events.map((x) => x.value)
      );
    });

    it("value with partial input", async () => {
      await completeSimple("on: check_r|", ["check_run"]);
    });

    it("map", async () => {
      await completeSimple(
        "on:\n  |",
        events.map((x) => x.value)
      );
    });

    it("map with partial input", async () => {
      await completeSimple("on:\n  check_|", ["check_run", "check_suite"]);
    });

    it("sequence", async () => {
      await completeSimple(
        "on:\n  - |",
        events.map((x) => x.value)
      );
    });

    it("types", async () => {
      await completeSimple("on:\n  issues:\n    types:\n      - |", [
        "assigned",
        "closed",
        "deleted",
        "demilestoned",
        "edited",
        "labeled",
        "locked",
        "milestoned",
        "opened",
        "pinned",
        "reopened",
        "transferred",
        "unassigned",
        "unlabeled",
        "unlocked",
        "unpinned",
      ]);
    });

    it("event keys", async () => {
      await completeSimple("on:\n  pull_request:\n    |\n", [
        "branches",
        "branches-ignore",
        "paths",
        "paths-ignore",
        "tags",
        "tags-ignore",
        "types",
      ]);
    });
  });

  describe("job", () => {
    it("completes top-level keys", async () => {
      await completeSimple("jobs:\n  build:\n    |", [
        "container",
        "continue-on-error",
        "defaults",
        "env",
        "environment",
        "if",
        "name",
        "needs",
        "outputs",
        "runs-on",
        "services",
        "steps",
        "strategy",
        "timeout-minutes",
      ]);
    });

    it("completes top-level keys with existing", async () => {
      await completeSimple(
        "jobs:\n  build:\n    runs-on: ubuntu-latest\n    |",
        [
          "container",
          "continue-on-error",
          "defaults",
          "env",
          "environment",
          "if",
          "name",
          "needs",
          "outputs",
          "services",
          "steps",
          "strategy",
          "timeout-minutes",
        ]
      );
    });

    it("complete steps ", async () => {
      await completeSimple(
        "jobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - |",
        [
          "continue-on-error",
          "env",
          "id",
          "if",
          "name",
          "run",
          "shell",
          "timeout-minutes",
          "uses",
          "with",
          "working-directory",
        ]
      );
    });
  });

  describe("expressions", () => {
    it("context", async () => {
      await completeSimple("jobs:\n  build:\n    name: ${{ g|", ["github"]);
      await completeSimple("jobs:\n  build:\n    name: ${{ g| == 1", [
        "github",
      ]);
      await completeSimple("jobs:\n  build:\n    name: ${{ 1 == git|", [
        "github",
      ]);
    });

    it("expression completion in string", async () => {
      await completeSimple(
        "jobs:\n  build:\n    name: This is a string${{ g|",
        ["github"]
      );
    });

    it("expression completion in multi-line string", async () => {
      let input = `jobs:
  build:
    name: |
      This is a multi-line
      string\${{ g@`;
      const pos = input.indexOf("@");
      input = input.replace("@", "");
      const suggestions = await complete(
        "workflow.yaml",
        input,
        pos,
        WorkflowSchema,
        ExpressionContextProviderFactory
      );

      expect(suggestions.map((x) => x.value)).toEqual(["github"]);
    });

    it("if", async () => {
      // `if` is always an expression
      await completeSimple("jobs:\n  build:\n    if: g|", ["github"]);
    });

    describe("contexts", () => {
      describe("multi-level", () => {
        it("github.event.action", () =>
          completeSimple(`name: \${{ github.event.r| }}`, [
            "ref",
            "repository",
          ]));
      });

      describe("env", () => {
        it("job", async () => {
          await completeSimple(
            "env:\n  foo: 42\njobs:\n  build:\n    env:\n      bar: 23\n      name: ${{ env.| }}",
            ["bar", "foo", "name"]
          );
        });

        it("env in step", async () => {
          await completeSimple(
            `env:
  foo: 42
jobs:
  build:
    env:
      bar: 23
    steps:
    - run: echo "hello"
      name: \${{ env.|  }}
      env:
        step: 65`,
            ["bar", "foo", "step"]
          );
        });
      });
    });
  });

  describe("jobs", () => {
    test("empty option for job map", async () => {
      await completeSimple(
        `on: push
jobs:
  |`,
        []
      );
    });
  });
});
