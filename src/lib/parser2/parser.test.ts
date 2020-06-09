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

  describe("map", () => {
    it("completes top level key", () => {
      const suggestions = testComplete(`|`);

      expect(suggestions).toEqual([
        {
          value: "name",
        },
        {
          value: "type",
        },
      ]);
    });

    it("completes top level key", () => {
      const suggestions = testComplete(`n|`);

      expect(suggestions).toEqual([
        {
          value: "name",
        },
      ]);
    });

    it("completes value", () => {
      const suggestions = testComplete(`name: |`);

      expect(suggestions).toEqual([
        {
          value: "test",
        },
        {
          value: "foo",
        },
      ]);
    });

    it("completes partial value", () => {
      const suggestions = testComplete(`name: t|`);

      expect(suggestions).toEqual([
        {
          value: "test",
        },
      ]);
    });
  });
});
