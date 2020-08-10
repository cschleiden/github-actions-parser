import { Hover, Kind, YNode } from "../../types";
import { replaceExpressions } from "../expressions";
import { containsExpression } from "../expressions/embedding";
import { Workflow } from "../workflow";
import { findNode, getPathFromNode, inPos } from "./ast";
import { ContextProviderFactory } from "./complete";
import { parse } from "./parser";
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
      // Expressions
      if (node.kind === Kind.SCALAR && containsExpression(node.value)) {
        const result = replaceExpressions(
          node.value,
          await contextProviderFactory.get(workflow, getPathFromNode(node))
        );
        if (result !== undefined) {
          return {
            description: `Evaluates to: \`${result}\``,
          };
        }
      }

      // Allowed values
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

      break;
    }

    case "map": {
      if (node.kind === Kind.MAP) {
        const mapping = node.mappings?.find((m) =>
          inPos([m.startPosition, m.endPosition], pos)
        );
        if (mapping) {
          const key = mapping.key?.value;
          if (key && desc.keys?.[key]?.description) {
            return {
              description: desc.keys[key].description,
            };
          }
        }
      }
      break;
    }
  }

  if (desc.description) {
    return {
      description: desc.description,
    };
  }
}

export async function hover(
  filename: string,
  input: string,
  pos: number,
  schema: NodeDesc,
  contextProviderFactory: ContextProviderFactory
): Promise<Hover | undefined> {
  const doc = await parse(filename, input, schema, contextProviderFactory);

  const node = findNode(doc.workflowST, pos) as YNode;
  const desc = doc.nodeToDesc.get(node);
  if (desc) {
    return doHover(node, desc, pos, doc.workflow, contextProviderFactory);
  }
}
