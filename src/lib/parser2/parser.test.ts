import { complete } from "./complete";
import { Diagnostic, DiagnosticKind, parse } from "./parser";
import { NodeDesc } from "./schema";

// Simple test schema
const schema: NodeDesc = {
  type: "map",
  keys: {
    name: {
      type: "value",
      allowedValues: [
        {
          value: "test",
        },
        { value: "foo" },
      ],
    },
    type: {
      type: "value",
    },
    array: {
      type: "sequence",
      itemDesc: {
        type: "value",
        allowedValues: [
          {
            value: "foo",
          },
          {
            value: "bar",
          },
        ],
      },
    },
    arrayMap: {
      type: "sequence",
      itemDesc: {
        type: "map",
        keys: {
          foo: {
            type: "value",
          },
        },
      },
    },
    level: {
      type: "map",
      keys: {
        steps: {
          type: "value",
          allowedValues: [
            {
              value: "1",
            },
            {
              value: "42",
            },
          ],
        },
        doors: {
          type: "value",
        },
      },
    },
  },

  required: ["name"],
};

describe("Validation", () => {
  const testValidation = (input: string, expected: Diagnostic[]) => {
    const doc = parse(input, schema);

    expect(doc.diagnostics).toEqual(expected);
  };

  it("Unknown top-level key", () => {
    testValidation(`t`, [
      {
        kind: DiagnosticKind.Error,
        pos: [0, 1],
        message: "Unknown key 't'",
      },
    ]);
  });

  it("Reports missing keys", () => {
    testValidation(`type: push`, [
      {
        kind: DiagnosticKind.Error,
        pos: [0, 10],
        message: "Missing required key 'name'",
      },
    ]);
  });

  it("Reports wrong value", () => {
    testValidation(`name: push`, [
      {
        kind: DiagnosticKind.Error,
        pos: [6, 10],
        message: "'push' is not in the list of allowed values",
      },
    ]);
  });

  it("Expected sequence got mapping", () => {
    testValidation("name: test\narray:\n  foo:", [
      {
        kind: DiagnosticKind.Error,
        pos: [20, 24],
        message: "Expected sequence, found map",
      },
    ]);
  });

  it("Expected value got mapping", () => {
    testValidation("name: test\ntype:\n  foo:", [
      {
        kind: DiagnosticKind.Error,
        pos: [19, 23],
        message: "Expected value, found map",
      },
    ]);
  });
});

describe("Completion", () => {
  /** | in string denotes cursor position */
  const testComplete = (input: string) => {
    const pos = input.indexOf("|");
    input = input.replace("|", "");
    const doc = parse(input, schema);
    return complete(doc, pos, input);
  };

  /** | in string denotes cursor position */
  const completeSimple = (input: string, expected: string[]) => {
    const suggestions = testComplete(input);

    expect(suggestions.map((x) => x.value)).toEqual(expected);
  };

  describe("map", () => {
    it("completes top level keys", () => {
      completeSimple("|", ["array", "arrayMap", "level", "name", "type"]);
      completeSimple("n|", ["name"]);
    });

    it("completes value", () => {
      completeSimple("name: |", ["foo", "test"]);
      completeSimple("name: t|", ["test"]);
      completeSimple("name: t|\ntype: 42", ["test"]);
      completeSimple("type: 42\nname: fo|", ["foo"]);
    });

    it("completes value in nested map", () => {
      completeSimple("level:\n  steps: |", ["1", "42"]);
      completeSimple("level:\n  steps: | ", ["1", "42"]);
      completeSimple("level:\n  steps: 4| ", ["42"]);
      completeSimple("level:\n  steps: |\nname: foo", ["1", "42"]);
      completeSimple("level:\n  steps: |   \nname: foo", ["1", "42"]);
      completeSimple("level:\n  steps: 4|   \nname: foo", ["42"]);
      completeSimple("level:\n  steps: 5| \nname: foo", []);
    });
  });

  describe("sequence", () => {
    describe("square", () => {
      it("completes value items", () => {
        completeSimple("array: [ | ]", ["bar", "foo"]);
        completeSimple("array: [ b| ]", ["bar"]);

        completeSimple("array: [ foo, b| ]", ["bar"]);
      });
    });

    describe("dash", () => {
      it("completes value items", () => {
        completeSimple("array:\n- |", ["bar", "foo"]);
        completeSimple("array:\n- b|", ["bar"]);

        completeSimple("array:\n- b|\n- foo", ["bar"]);
        completeSimple("array:\n- foo\n- b|", ["bar"]);
      });

      it("completes map items", () => {
        completeSimple("arrayMap:\n- |", ["foo"]);
        completeSimple("arrayMap:\n-|", ["foo"]);
      });
    });
  });
});
