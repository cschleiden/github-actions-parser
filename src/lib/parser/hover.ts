import { Hover, Kind, YNode } from "../../types";
import { containsExpression, evaluateExpression } from "../expressions";
import { findNode, getPathFromNode } from "./ast";
import { ContextProviderFactory } from "./complete";
import { parse, Workflow } from "./parser";
import { NodeDesc } from "./schema";

async function doHover(
  node: YNode,
  desc: NodeDesc,
  pos: number,
  workflow: Workflow,
  contextProviderFactory: ContextProviderFactory
): Promise<Hover | undefined> {
  switch (desc.type) {
    case "value": {
      if (node.kind === Kind.SCALAR && containsExpression(node.value)) {
        const result = evaluateExpression(
          node.value,
          await contextProviderFactory.get(workflow, getPathFromNode(node))
        );
        if (result !== undefined) {
          return {
            description: `Expression evaluates to: \`${result}\``,
          };
        }
      }

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
          return doHover(
            node,
            desc.itemDesc,
            pos,
            workflow,
            contextProviderFactory
          );
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
  schema: NodeDesc,
  contextProviderFactory: ContextProviderFactory
): Promise<Hover | undefined> {
  const doc = await parse(input, schema, contextProviderFactory);

  const node = findNode(doc.workflowST, pos) as YNode;
  const desc = doc.nodeToDesc.get(node);
  if (desc) {
    return doHover(node, desc, pos, doc.workflow, contextProviderFactory);
  }
}
