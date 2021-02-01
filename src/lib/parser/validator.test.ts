import { CustomValueValidation, NodeDesc } from "./schema";
import { Diagnostic, DiagnosticKind } from "../../types";

import { NullCompletion } from "./test/fixtures";
import { parse } from "./parser";

// Simple test schema
const schema: NodeDesc = {
  type: "map",
  keys: {
    static: {
      type: "map",
      keys: {
        foo: {
          type: "value",
        },
        bar: {
          type: "value",
        },
      },
    },
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
    withUnknownKeys: {
      type: "map",
      keys: {
        known: {
          type: "value",
        },
      },
      allowUnknownKeys: true,
      itemDesc: {
        type: "sequence",
      },
    },
  },
};

describe("map keys", () => {
  const testValidation = async (
    input: string,
    expected: Diagnostic[],
    s = schema
  ) => {
    const doc = await parse("workflow.yml", input, s, NullCompletion);
    expect(doc.diagnostics).toEqual(expected);
  };

  it("unknown keys", () =>
    testValidation("withUnknownKeys:\n  known: 12\n  foo: [1,2]", []));

  it("unknown keys checked with itemDesc", () =>
    testValidation("withUnknownKeys:\n  known: 12\n  foo: false", [
      {
        kind: 0,
        message: "Expected sequence, found value",
        pos: [36, 41],
      },
    ]));

  it("known keys checked against their schema", () =>
    testValidation("withUnknownKeys:\n  known: [1]", [
      {
        kind: 0,
        message: "Expected value, found sequence",
        pos: [26, 29],
      },
    ]));
});

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

  it("Reports unknown key at correct location", () =>
    testValidation(
      `static:
  foo: 42
  unknown: 23`,
      [
        {
          kind: DiagnosticKind.Error,
          pos: [20, 27],
          message: "Key 'unknown' is not allowed",
        },
      ],
      schema
    ));
});
