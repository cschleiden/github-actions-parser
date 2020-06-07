import { NodeDesc } from "./schema";
import { Node, NodeMapping } from "./tree";
import { workflowSchema } from "./workflowSchema";

export interface ValidationError {
  startPos: number;
  endPos: number;
  message: string;
}

function validateNode(
  node: Node,
  nodeDesc: NodeDesc,
  errors: ValidationError[]
): boolean {
  const checkNodeType = () => {
    if (node.type !== nodeDesc.type) {
      errors.push({
        startPos: node.startPos,
        endPos: node.endPos,
        message: `Unexpected node type ${node.type}, expected ${nodeDesc.type}`,
      });
      return false;
    }

    return true;
  };

  switch (nodeDesc.type) {
    case "oneOf": {
    }

    case "value": {
      if (checkNodeType()) {
        return false;
      }

      if (
        nodeDesc.allowedValues &&
        typeof node.value === "string" &&
        nodeDesc.allowedValues.indexOf(node.value) === -1
      ) {
        errors.push({
          startPos: node.startPos,
          endPos: node.endPos,
          message: `${node.value} is not in the list of allowed values`,
        });
      }

      break;
    }

    case "map": {
      if (node.type === nodeDesc.type) {
        const seenKeys = new Map<string, NodeMapping>();

        for (const mapping of node.mappings) {
          seenKeys.set(mapping.key, mapping);

          const mappingDesc = nodeDesc.keys && nodeDesc.keys[mapping.key];
          if (mappingDesc) {
            if (Array.isArray(mappingDesc)) {
            } else {
              validateNode(mapping, mappingDesc, errors);
            }
          }
        }

        // Check required keys
        if (nodeDesc.required) {
          for (const missingKey of nodeDesc.required.filter(
            (key) => !seenKeys.has(key)
          )) {
            errors.push({
              startPos: node.startPos,
              endPos: node.endPos,
              message: `Missing required key '${missingKey}'`,
            });
          }
        }

        if (nodeDesc.keys) {
          for (const [extraKey, mapping] of Array.from(seenKeys).filter(
            ([key]) => !nodeDesc.keys[key]
          )) {
            errors.push({
              startPos: mapping.startPos,
              endPos: mapping.endPos,
              message: `Key '${extraKey}' is not allowed`,
            });
          }
        }
      }
    }
  }

  return true;
}

export function validate(root: Node): ValidationError[] {
  const errors: ValidationError[] = [];

  validateNode(root, workflowSchema, errors);

  return errors;
}
