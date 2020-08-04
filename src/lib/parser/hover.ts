import { Kind, YNode } from "../../types";
import { findNode } from "./ast";
import { parse } from "./parser";
import { NodeDesc } from "./schema";
import { Hover } from "./types";

function doHover(node: YNode, desc: NodeDesc): Hover | undefined {
  switch (desc.type) {
    case "value": {
      if (desc.allowedValues) {
        const allowedValue = desc.allowedValues.find((x) => node.value);
        if (allowedValue && allowedValue.description) {
          return {
            description: allowedValue.description,
          };
        }
      }

      break;
    }

    case "sequence": {
      if (node.kind !== Kind.SEQ) {
        if (desc.itemDesc) {
          return doHover(node, desc.itemDesc);
        }
      }
    }
  }

  if (desc.description) {
    return {
      description: desc.description,
    };
  }
}

export async function hover(
  input: string,
  pos: number,
  schema: NodeDesc
): Promise<Hover | undefined> {
  const doc = parse(input, schema);

  const node = findNode(doc.workflowST, pos) as YNode;
  const desc = doc.nodeToDesc.get(node);
  if (desc) {
    return doHover(node, desc);
  }
}
