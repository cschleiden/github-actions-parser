import { safeLoad } from "yaml-ast-parser";
import { buildWorkflowSyntaxTree, Node } from "./tree";

describe("Transforms YAML AST to Workflow ST", () => {
  it("mapping", () => {
    expect(buildWorkflowSyntaxTree(safeLoad(`name: Matrix`))).toEqual({
      startPos: 0,
      endPos: 12,
      type: "map",
      mappings: [
        {
          type: "mapping",
          startPos: 0,
          endPos: 12,
          key: "name",
          value: {
            endPos: 12,
            startPos: 6,
            type: "value",
            value: "Matrix",
          },
        },
      ],
    } as Node);
  });
});
