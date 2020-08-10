import { Diagnostic, DiagnosticKind } from "../../types";
import { parse } from "./parser";
import { CustomValueValidation, NodeDesc } from "./schema";
import { NullCompletion } from "./test/fixtures";

// Simple test schema
const schema: NodeDesc = {
  type: "map",
  keys: {
    dynamic: {
      type: "map",
      customValueProvider: async () => {
        return [
          {
            value: "foo",
            validation: CustomValueValidation.Required,
          },
          {
            value: "bar",
          },
        ];
      },
    },
  },
};

describe("Dynamic validation", () => {
  const testValidation = async (
    input: string,
    expected: Diagnostic[],
    s = schema
  ) => {
    const doc = await parse("workflow.yml", input, s, NullCompletion);

    expect(doc.diagnostics).toEqual(expected);
  };

  it("Missing required key", () =>
    testValidation(
      `dynamic:\n  bar: test`,
      [
        {
          kind: DiagnosticKind.Error,
          pos: [0, 7],
          message: "Missing required key 'foo'",
        },
      ],
      schema
    ));

  it("Omitting optional key", () =>
    testValidation(`dynamic:\n  foo: test`, [], schema));
});
