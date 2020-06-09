import { safeLoad } from "yaml-ast-parser";
import { buildWorkflowSyntaxTree, Node } from "./tree";

describe("Transforms YAML AST to Workflow ST", () => {
  it("mapping", () => {
    expect(buildWorkflowSyntaxTree(safeLoad(`name: Matrix`))).toEqual({
      pos: [0, 12],
      type: "map",
      parent: undefined,
      mappings: [
        expect.objectContaining({
          type: "mapping",
          pos: [0, 12],
          key: "name",
          value: expect.objectContaining({
            pos: [6, 12],
            type: "value",
            value: "Matrix",
          }),
        }),
      ],
    } as Node);
  });
});
