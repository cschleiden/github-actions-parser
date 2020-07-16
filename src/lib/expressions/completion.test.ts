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

const testComplete = (input: string) => {
  const pos = input.indexOf("|");
  input = input.replace("|", "");
  // const doc = parse(input, WorkflowSchema);
  // return await complete(doc, pos, input);
  return completeExpression(
    input,
    pos >= 0 ? pos : input.length - 1,
    testContext
  ).map((x) => x.value);
};

describe("auto-complete", () => {
  describe("functions", () => {
    it("toJson", () => {
      expect(testComplete("toJs")).toEqual(["toJson"]);
      expect(testComplete("1 == toJs")).toEqual(["toJson"]);
      expect(testComplete("toJs| == 1")).toEqual(["toJson"]);
    });
  });

  describe("for contexts", () => {
    it("provides suggestions for github", () => {
      expect(testComplete("g|")).toEqual(["github"]);
    });

    it("provides suggestions for env", () => {
      expect(testComplete("env.X")).toEqual([]);
      expect(testComplete("1 == env.F")).toEqual(["FOO"]);
      expect(testComplete("env.")).toEqual(["FOO", "BAR_TEST"]);
      expect(testComplete("env.FOO")).toEqual([]);
    });

    it("provides suggestions for secrets", () => {
      expect(testComplete("secrets.A")).toEqual(["AWS_TOKEN"]);
      expect(testComplete("1 == secrets.F")).toEqual([]);
      expect(testComplete("toJson(secrets.")).toEqual(["AWS_TOKEN"]);
    });
  });
});
