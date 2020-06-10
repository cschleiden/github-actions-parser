import { complete } from "./complete";
import { DiagnosticKind, parse } from "./parser";
import { NodeDesc } from "./schema";

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
  },

  required: ["name"],
};

describe("Validation", () => {
  it("Unknown top-level key", () => {
    const doc = parse(`t`, schema);

    expect(doc.diagnostics).toEqual([
      {
        kind: DiagnosticKind.Error,
        pos: [0, 1],
        message: "Unknown key 't'",
      },
    ]);
  });

  it("Reports missing keys", () => {
    const doc = parse(`type: push`, schema);

    expect(doc.diagnostics).toEqual([
      {
        kind: DiagnosticKind.Error,
        pos: [0, 10],
        message: "Missing required key 'name'",
      },
    ]);
  });

  it("Reports wrong value", () => {
    const doc = parse(`name: push`, schema);

    expect(doc.diagnostics).toEqual([
      {
        kind: DiagnosticKind.Error,
        pos: [6, 10],
        message: "'push' is not in the list of allowed values",
      },
    ]);
  });
});

describe("Completion", () => {
  const testComplete = (input: string) => {
    const pos = input.indexOf("|");
    input = input.replace("|", "");
    const doc = parse(input, schema);
    return complete(doc, pos, input);
  };

  const completeSimple = (input: string, expected: string[]) => {
    const suggestions = testComplete(input);

    expect(suggestions.map((x) => x.value)).toEqual(expected);
  };

  describe("map", () => {
    it("completes top level keys", () => {
      completeSimple("|", ["name", "type"]);
      completeSimple("n|", ["name"]);
    });

    it("completes value", () => {
      completeSimple("name: |", ["test", "foo"]);
      completeSimple("name: t|", ["test"]);
      completeSimple("name: t|\ntype: 42", ["test"]);
      completeSimple("type: 42\nname: fo|", ["foo"]);
    });
  });
});
