import { completeExpression } from "./completion";
import { IExpressionContext } from "./evaluator";

const testContext: IExpressionContext = {
  contexts: {
    env: {
      FOO: 42,
      BAR_TEST: "hello",
    },
    secrets: {
      AWS_TOKEN: "12",
    },
  },
} as any;

const testComplete = async (input: string, expected: string[]) => {
  const pos = input.indexOf("|");
  input = input.replace("|", "");
  // const doc = parse(input, WorkflowSchema);
  // return await complete(doc, pos, input);
  const results = (
    await completeExpression(
      input,
      pos >= 0 ? pos : input.length - 1,
      testContext
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

    it("provides suggestions for secrets", () => {
      testComplete("secrets.A", ["AWS_TOKEN"]);
      testComplete("1 == secrets.F", []);
      testComplete("toJson(secrets.", ["AWS_TOKEN"]);
    });
  });
});
