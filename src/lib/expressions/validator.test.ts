import { ValidationError } from "../parser/validator";
import { ContextProvider } from "./types";
import { validateExpression } from "./validator";

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

const testValidation = async (input: string, expected: string[]) => {
  const errors: ValidationError[] = [];
  validateExpression(input, errors, contextProvider);
  expect(errors.map((x) => x.message)).toEqual(expected);
};

describe("validation", () => {
  describe("parsing error", () => {
    it("unknown operator", async () => {
      await testValidation("1 === 4", ["Invalid expression"]);
    });
  });

  describe("for contexts", () => {
    it("unknown context", async () => {
      await testValidation("foo.test", ["Invalid expression"]);
    });

    it("unknown context acesss", async () => {
      await testValidation("github.test", [
        "Unknown context access: 'github.test'",
      ]);
    });
  });
});
