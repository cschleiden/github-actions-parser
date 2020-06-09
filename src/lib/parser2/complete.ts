import { WorkflowDocument } from "./parser";
import { Node, Position } from "./tree";

export interface CompletionOption {
  value: string;
  description?: string;
}

function inPos(position: Position, pos: number): boolean {
  return position[0] <= pos && pos <= position[1];
}

function findNode(node: Node, pos: number): Node {
  if (!inPos(node.pos, pos)) {
    return null;
  }

  switch (node.type) {
    case "map": {
      for (const mapping of node.mappings) {
        if (inPos(mapping.pos, pos)) {
          return findNode(mapping, pos);
        }
      }

      break;
    }

    case "mapping": {
      // If the position is within the value, return that, otherwise the mapping node
      const r = node.value && findNode(node.value, pos);
      if (r) {
        return r;
      }

      break;
    }

    case "sequence": {
      for (const item of node.items) {
        if (typeof item !== "object") {
          return node;
        }

        if (inPos(item.pos, pos)) {
          return findNode(item, pos);
        }
      }

      break;
    }
  }

  return node;
}

export function complete(
  doc: WorkflowDocument,
  pos: number,
  input: string
): CompletionOption[] {
  if (!doc.workflow) {
    return [];
  }

  const node = findNode(doc.workflowST, pos);
  if (!node) {
    return [];
  }

  if (node.desc) {
    switch (node.desc.type) {
      case "value": {
        const searchInput = input.substr(input.lastIndexOf(":") + 1).trim();

        if (node.desc.allowedValues) {
          return node.desc.allowedValues.filter(
            (x) => !searchInput || x.value.startsWith(searchInput)
          );
        }
        break;
      }

      case "map":
        if (node.desc.customSuggester) {
          // TODO
        }

        console.log("hey");
        if (node.desc.keys) {
          const c: CompletionOption[] = [];
          for (const key of Object.keys(node.desc.keys)) {
            console.log(key, node.desc, 123);
            c.push({
              value: key,
              description: node.desc.keys[key].description,
            });
          }

          return c;
        }

        break;
    }
  }

  console.log(node);
}
