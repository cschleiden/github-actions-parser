import { Diagnostic, DiagnosticKind } from "../../types";

import { complete } from "./complete";
import { parse } from "./parser";
import { NodeDesc } from "./schema";
import { NullCompletion } from "./test/fixtures";

/** | in string denotes cursor position */
const _testComplete = async (input: string, schema: NodeDesc) => {
  const pos = input.indexOf("|");
  input = input.replace("|", "");
  return await complete("workflow.yaml", input, pos, schema, NullCompletion);
};

/** | in string denotes cursor position */
const _completeSimple = async (
  input: string,
  expected: string[],
  schema: NodeDesc
) => {
  const suggestions = await _testComplete(input, schema);

  expect(suggestions.map((x) => x.value)).toEqual(expected);
};

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
          bar: {
            type: "value",
          },
          baz: {
            type: "map",
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
    expr: {
      type: "value",
    },
  },

  required: ["name"],
};

describe("Validation", () => {
  const testValidation = async (
    input: string,
    expected: Diagnostic[],
    s = schema
  ) => {
    const doc = await parse("workflow.yaml", input, s, NullCompletion);

    expect(doc.diagnostics).toEqual(expected);
  };

  it("Unknown top-level key", () =>
    testValidation(`t`, [
      {
        kind: DiagnosticKind.Error,
        pos: [0, 1],
        message: "Unknown key 't'",
      },
    ]));

  it("Reports missing keys", () =>
    testValidation(`type: push`, [
      {
        kind: DiagnosticKind.Error,
        pos: [0, 10],
        message: "Missing required key 'name'",
      },
    ]));

  it("Reports wrong value", () =>
    testValidation(`name: push`, [
      {
        kind: DiagnosticKind.Error,
        pos: [6, 10],
        message: "'push' is not in the list of allowed values",
      },
    ]));

  it("Expected sequence got mapping", () =>
    testValidation("name: test\narray:\n  foo:", [
      {
        kind: DiagnosticKind.Error,
        pos: [20, 24],
        message: "Expected sequence, found map",
      },
    ]));

  it("Incorrect value in sequence", () =>
    testValidation("name: test\narray: [ foo2 ]", [
      {
        kind: DiagnosticKind.Error,
        pos: [20, 24],
        message: "'foo2' is not in the list of allowed values",
      },
    ]));

  it("Incorrect value in sequence using -", () =>
    testValidation("name: test\narray:\n- foo2", [
      {
        kind: DiagnosticKind.Error,
        pos: [20, 24],
        message: "'foo2' is not in the list of allowed values",
      },
    ]));

  it("Expected value got mapping", () =>
    testValidation("name: test\ntype:\n  foo:", [
      {
        kind: DiagnosticKind.Error,
        pos: [19, 23],
        message: "Expected value, found map",
      },
    ]));

  // TODO: CS:
  // it("Unknown secret", () => {
  //   testValidation("expr: ${{ secrets.UNKNOWN }}", [
  //     {
  //       kind: DiagnosticKind.Error,
  //       pos: [19, 23],
  //       message: "Expected value, found map",
  //     },
  //   ]);
  // });

  describe("dynamic", () => {
    const dynamicSchema: NodeDesc = {
      type: "map",
      keys: {
        "runs-on": {
          type: "value",
          customValueProvider: async () => {
            return [
              {
                value: "foo",
                description: "this is foo",
              },
              {
                value: "bar",
                description: "this is bar",
              },
            ];
          },
        },
      },
    };

    it("Valid dynamic value", () =>
      testValidation("runs-on: foo", [], dynamicSchema));

    it("Invalid dynamic value", () =>
      testValidation(
        "runs-on: foo2",
        [
          {
            kind: DiagnosticKind.Error,
            message: "'foo2' is not in the list of allowed values",
            pos: [9, 13],
          },
        ],
        dynamicSchema
      ));
  });
});

describe("Completion", () => {
  const completeSimple = (input: string, expected: string[]) =>
    _completeSimple(input, expected, schema);

  describe("map", () => {
    describe("completes top level keys", () => {
      it("empty file", () =>
        completeSimple("|", [
          "array",
          "arrayMap",
          "expr",
          "level",
          "name",
          "type",
        ]));

      it("partial match in empty file", () => completeSimple("n|", ["name"]));
      it("one other key", () =>
        completeSimple("name: test\n|", [
          "array",
          "arrayMap",
          "expr",
          "level",
          "type",
        ]));
      it("partial match with one other key", () =>
        completeSimple("name: test\nt|", ["type"]));
      it("between existing keys", () =>
        completeSimple("name: test\n\n|\nlevel:\n  steps: 1", [
          "array",
          "arrayMap",
          "expr",
          "type",
        ]));
    });

    it("completes nested keys", async () => {
      await completeSimple("level:\n  |", ["doors", "steps"]);
    });

    describe("completes value", () => {
      it("value", () => {
        return completeSimple("name: |", ["foo", "test"]);
      });
      it("partial value", () => completeSimple("name: t|", ["test"]));
      it("partial value before other one", () =>
        completeSimple("name: t|\ntype: 42", ["test"]));
      it("partial value after other one", () =>
        completeSimple("type: 42\nname: fo|", ["foo"]));
    });

    it("completes value in nested map", async () => {
      await completeSimple("level:\n  steps: |", ["1", "42"]);
      await completeSimple("level:\n  steps: | ", ["1", "42"]);
      await completeSimple("level:\n  steps: 4| ", ["42"]);
      await completeSimple("level:\n  steps: | \nname: foo", ["1", "42"]);
      await completeSimple("level:\n  steps: |   \nname: foo", ["1", "42"]);
      await completeSimple("level:\n  steps: 4|   \nname: foo", ["42"]);
      await completeSimple("level:\n  steps: 5| \nname: foo", []);
    });
  });

  describe("sequence", () => {
    // describe("square", () => {
    //   it("completes value items", async () => {
    //     await completeSimple("array: [ | ]", ["bar", "foo"]);
    //     await completeSimple("array: [ b| ]", ["bar"]);

    //     await completeSimple("array: [ foo, b| ]", ["bar"]);
    //     await completeSimple("array: [ foo, | ]", ["bar"]);
    //   });
    // });

    describe("dash", () => {
      it("completes value items", async () => {
        await completeSimple("array:\n- |", ["bar", "foo"]);
        await completeSimple("array:\n- b|", ["bar"]);

        await completeSimple("array:\n- b|\n- foo", ["bar"]);
        await completeSimple("array:\n- foo\n- b|", ["bar"]);
      });

      describe("completes map items", () => {
        it("with space", () =>
          completeSimple("arrayMap:\n- |", ["bar", "baz", "foo"]));
        it("without space", () =>
          completeSimple("arrayMap:\n-|", ["bar", "baz", "foo"]));

        it("with partial input", () =>
          completeSimple("arrayMap:\n- f|", ["foo"]));

        it("with existing key", () =>
          completeSimple("arrayMap:\n- foo: test\n  |", ["bar", "baz"]));
        it("with existing key and partial input", () =>
          completeSimple("arrayMap:\n- baz: test\n  ba|", ["bar"]));
      });
    });
  });
});

// Simple test schema
const valueNode: NodeDesc = {
  type: "value",
  allowedValues: [
    {
      value: "foo",
    },
    {
      value: "var",
    },
    {
      value: "123",
    },
  ],
};

const nestedValueNode: NodeDesc = {
  type: "value",
  allowedValues: [
    {
      value: "1",
    },
    {
      value: "2",
    },
  ],
};

const oneOfSchema: NodeDesc = {
  type: "map",
  keys: {
    on: {
      type: "oneOf",

      oneOf: [
        {
          type: "sequence",
          itemDesc: valueNode,
        },
        valueNode,
        {
          type: "map",
          keys: {
            foo: nestedValueNode,
            bar: nestedValueNode,
          },
        },
      ],
    },
    on2: {
      type: "oneOf",
      oneOf: [
        valueNode,
        {
          type: "sequence",
          itemDesc: valueNode,
        },
      ],
    },
    number: {
      type: "value",
    },
  },
};

describe("OneOf", () => {
  const testValidation = async (input: string, expected: Diagnostic[]) => {
    const doc = await parse("workflow.yml", input, oneOfSchema, NullCompletion);

    expect(doc.diagnostics).toEqual(expected);
  };

  describe("validation", () => {
    it("Unknown keys", async () => {
      await testValidation(`on: foo2`, [
        {
          kind: DiagnosticKind.Error,
          pos: [4, 8],
          message: `'foo2' is not in the list of allowed values`,
        },
      ]);
      await testValidation(`on:\n  foo2:\n`, [
        {
          kind: DiagnosticKind.Error,
          pos: [6, 10],
          message: `Key 'foo2' is not allowed`,
        },
      ]);
      await testValidation(`on: [ foo2 ]`, [
        {
          kind: DiagnosticKind.Error,
          pos: [6, 10],
          message: `'foo2' is not in the list of allowed values`,
        },
      ]);
      await testValidation(`on:\n- foo2`, [
        {
          kind: DiagnosticKind.Error,
          pos: [6, 10],
          message: `'foo2' is not in the list of allowed values`,
        },
      ]);
    });

    it("Incorrect node", () => {
      testValidation(`on2:\n  foo:\n`, [
        {
          kind: DiagnosticKind.Error,
          pos: [7, 11],
          message: `Did not expect 'map'`,
        },
      ]);
    });

    it("Allowed keys", () => {
      testValidation(`on: foo`, []);
      testValidation(`on:\n  foo:\n`, []);
      testValidation(`on: [ foo ]`, []);
      testValidation(`on:\n- foo`, []);
    });
  });

  describe("completion", () => {
    const completeSimple = (input: string, expected: string[]) =>
      _completeSimple(input, expected, oneOfSchema);

    it("oneOf map with key", () => {
      return completeSimple("on|: ", ["on2"]);
    });

    it("oneOf as value", () => {
      return completeSimple("on: |", ["123", "foo", "var"]);
    });

    it("oneOf as key", () => {
      return completeSimple("on:\n  |", ["bar", "foo"]);
    });

    it("oneOf as sequence", () => {
      return completeSimple("on:\n  - |", ["123", "foo", "var"]);
    });

    it("oneOf as inline sequence", () => {
      return completeSimple("on: [ | ]", ["123", "foo", "var"]);
    });

    it("oneOf as inline sequence with other values", () => {
      return completeSimple("on: [ 123, | ]", ["foo", "var"]);
    });
  });
});

const pathSuggester = async (_, workflow, path) => {
  return [
    {
      value: path.join("."),
    },
  ];
};

const dynamicSchema: NodeDesc = {
  type: "map",
  keys: {
    static: {
      type: "value",
    },
    dynamic: {
      type: "value",
      customValueProvider: async () => {
        return [
          {
            value: "foo",
            description: "this is foo",
          },
          {
            value: "bar",
            description: "this is bar",
          },
        ];
      },
    },
    path: {
      type: "map",
      keys: {
        value: {
          type: "value",
          customValueProvider: pathSuggester,
        },
        seq: {
          type: "sequence",
          itemDesc: {
            type: "map",
            keys: {
              foo: {
                type: "value",
                customValueProvider: pathSuggester,
              },
            },
            customValueProvider: pathSuggester,
          },
          customValueProvider: pathSuggester,
        },
      },
    },
    dynSeq: {
      type: "sequence",
      itemDesc: {
        type: "value",
        customValueProvider: async (desc, doc, path) => {
          return [{ value: "foo" }, { value: "bar" }];
        },
      },
    },
  },
};

describe("Async custom completion", () => {
  /** | in string denotes cursor position */
  const testComplete = async (input: string) => {
    const pos = input.indexOf("|");
    input = input.replace("|", "");
    return await complete(
      "workflow.yml",
      input,
      pos,
      dynamicSchema,
      NullCompletion
    );
  };

  /** | in string denotes cursor position */
  const completeSimple = async (input: string, expected: string[]) => {
    const suggestions = await testComplete(input);

    expect(suggestions.map((x) => x.value)).toEqual(expected);
  };

  it("Dynamically completes value", async () => {
    await completeSimple("dynamic: |", ["bar", "foo"]);
    await completeSimple("dynamic: ba|", ["bar"]);
  });

  describe("Dynamically completes sequence", () => {
    it("empty sequence, [", () =>
      completeSimple("dynSeq: [ | ]", ["bar", "foo"]));
    it("existing value, [", () =>
      completeSimple("dynSeq: [ bar, | ]", ["foo"]));
    it("empty sequence, -", () =>
      completeSimple("dynSeq:\n- |", ["bar", "foo"]));
    it("existing value before, -", () =>
      completeSimple("dynSeq:\n- bar\n- |", ["foo"]));
    it("existing value after, -", () =>
      completeSimple("dynSeq:\n- |\n- bar", ["foo"]));
    it("partial input, -", () => completeSimple("dynSeq:\n- fo|", ["foo"]));
  });

  describe("Path based completion", () => {
    it("map", () => completeSimple("path:\n  value: |", ["$.path.value"]));

    it("sequence", () =>
      completeSimple("path:\n  seq:\n    - test\n    - |", [
        "$.path.seq",
        "foo",
      ]));

    it("map in sequence", () =>
      completeSimple("path:\n  seq:\n    - test\n    - foo: |", [
        "$.path.seq,1.foo",
      ]));
  });
});
