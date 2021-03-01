import { ContextProvider } from "./types";
import { completeExpression } from "./completion";

const contextProvider: ContextProvider = {
  get: (context) => {
    switch (context) {
      case "env": {
        return {
          FOO: "",
          BAR_TEST: "",
        };
      }

      case "secrets": {
        return { AWS_TOKEN: true };
      }
    }

    return [];
  },
};

const testComplete = async (input: string, expected: string[]) => {
  const pos = input.indexOf("|");
  input = input.replace("|", "");

  const results = (
    await completeExpression(
      input,
      pos >= 0 ? pos : input.length - 1,
      contextProvider
    )
  ).map((x) => x.value);

  expect(results).toEqual(expected);
};

describe("auto-complete", () => {
  describe("functions", () => {
    it("toJSON", async () => {
      await testComplete("toJS", ["toJSON"]);
      await testComplete("1 == toJS", ["toJSON"]);
      await testComplete("toJS| == 1", ["toJSON"]);
    });
  });

  describe("for contexts", () => {
    it("provides suggestions for github", async () => {
      await testComplete("g|", ["github"]);
    });

    it("provides suggestions for env", async () => {
      await testComplete("env.X", []);
      await testComplete("1 == env.F", ["FOO"]);
      await testComplete("env.", ["BAR_TEST", "FOO"]);
      await testComplete("env.FOO", []);
    });

    it("provides suggestions for secrets", async () => {
      await testComplete("secrets.A", ["AWS_TOKEN"]);
      await testComplete("1 == secrets.F", []);
      await testComplete("toJSON(secrets.", ["AWS_TOKEN"]);
    });
  });
});
