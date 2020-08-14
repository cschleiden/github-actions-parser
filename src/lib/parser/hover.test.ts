import { hover } from "./hover";
import { NullCompletion } from "./test/fixtures";

const dynamicSchema: NodeDesc = {
  type: "map",
  keys: {
    static: {
      type: "value",
    },
    dynamic: {
      type: "map",
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

describe("Async custom completion", () => {
  /** | in string denotes cursor position */
  const testHover = async (input: string) => {
    const pos = input.indexOf("|");
    input = input.replace("|", "");
    return await hover(
      "workflow.yml",
      input,
      pos,
      dynamicSchema,
      NullCompletion
    );
  };

  /** | in string denotes cursor position */
  const hoverSimple = async (input: string, expected: string) => {
    const result = await testHover(input);

    expect(result?.description).toEqual(expected);
  };

  it("Dynamically generated map key", async () => {
    await hoverSimple(`dynamic:\n  fo|o: 123`, "this is foo");
    await hoverSimple(`dynamic:\n  bar: hello\n  fo|o: 123`, "this is foo");
    await hoverSimple(`dynamic:\n  b|ar: hello\n  foo: 123`, "this is bar");
  });
});
