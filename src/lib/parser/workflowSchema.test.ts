import { complete } from "./complete";
import { parse } from "./parser";
import { WorkflowSchema } from "./workflowSchema";

describe("Completion", () => {
  /** | in string denotes cursor position */
  const testComplete = async (input: string) => {
    const pos = input.indexOf("|");
    input = input.replace("|", "");
    const doc = parse(input, WorkflowSchema);
    return await complete(doc, pos, input);
  };

  /** | in string denotes cursor position */
  const completeSimple = async (input: string, expected: string[]) => {
    const suggestions = await testComplete(input);

    expect(suggestions.map((x) => x.value)).toEqual(expected);
  };

  describe("map", () => {
    it("completes top level keys", async () => {
      await completeSimple("|", ["jobs", "name", "on"]);
      await completeSimple("n|", ["name"]);

      await completeSimple("name: workflow\n|", ["jobs", "on"]);
    });

    it("complete top level key in workflow", () =>
      completeSimple(
        "name: test\non:\n  pull_request:\n    types:\n    - assigned\n|",
        ["jobs"]
      ));
  });

  describe("on", () => {
    it("value", async () => {
      await completeSimple("on: |", ["pull_request", "push"]);
    });

    it("map", async () => {
      await completeSimple("on:\n  |", ["public", "pull_request", "push"]);
    });

    it("sequence", async () => {
      await completeSimple("on:\n  - |", ["pull_request", "push"]);
    });
  });

  describe("jobs", () => {
    it("foo", async () => {
      await completeSimple("jobs:\n  build:\n    |", ["runs-on", "steps"]);
    });
  });
});
