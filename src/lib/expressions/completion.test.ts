import { WorkflowDocument } from "../parser/parser";
import { completeExpression, ExpressionContextCompletion } from "./completion";

const expressionCompletion: ExpressionContextCompletion = {
  completeContext: async (context, doc, path, input) => {
    switch (context) {
      case "env": {
        return [
          {
            value: "FOO",
          },
          {
            value: "BAR_TEST",
          },
        ].filter(
          (x) => !input || (x.value.startsWith(input) && x.value !== input)
        );
      }

      case "secrets": {
        return [
          {
            value: "AWS_TOKEN",
          },
        ].filter(
          (x) => !input || (x.value.startsWith(input) && x.value !== input)
        );
      }
    }

    return [];
  },
};

const testComplete = async (input: string, expected: string[]) => {
  const pos = input.indexOf("|");
  input = input.replace("|", "");
  // const doc = parse(input, WorkflowSchema);
  // return await complete(doc, pos, input);
  const results = (
    await completeExpression(
      input,
      pos >= 0 ? pos : input.length - 1,
      {} as WorkflowDocument,
      [],
      expressionCompletion
    )
  ).map((x) => x.value);

  expect(results).toEqual(expected);
};

describe("auto-complete", () => {
  describe("functions", () => {
    it("toJson", async () => {
      await testComplete("toJs", ["toJson"]);
      await testComplete("1 == toJs", ["toJson"]);
      await testComplete("toJs| == 1", ["toJson"]);
    });
  });

  describe("for contexts", () => {
    it("provides suggestions for github", async () => {
      await testComplete("g|", ["github"]);
    });

    it("provides suggestions for env", async () => {
      await testComplete("env.X", []);
      await testComplete("1 == env.F", ["FOO"]);
      await testComplete("env.", ["FOO", "BAR_TEST"]);
      await testComplete("env.FOO", []);
    });

    it("provides suggestions for secrets", async () => {
      await testComplete("secrets.A", ["AWS_TOKEN"]);
      await testComplete("1 == secrets.F", []);
      await testComplete("toJson(secrets.", ["AWS_TOKEN"]);
    });
  });
});
