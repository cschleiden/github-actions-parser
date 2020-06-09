import { NodeDesc } from "./schema";
import { Node, NodeMapping, Position } from "./tree";

export interface ValidationError {
  pos: Position;
  message: string;
}

function validateNode(
  node: Node,
  nodeDesc: NodeDesc,
  errors: ValidationError[]
): boolean {
  if (!node) {
    return true;
  }

  const reportTypeMismatch = () => {
    errors.push({
      pos: node.pos,
      message: `Unexpected node type ${node.type}, expected ${nodeDesc.type}`,
    });
    return false;
  };

  switch (nodeDesc.type) {
    case "oneOf": {
      return true;
    }

    case "value": {
      if (node.type !== nodeDesc.type) {
        return reportTypeMismatch();
      }

      node.desc = nodeDesc;

      if (
        nodeDesc.allowedValues &&
        typeof node.value === "string" &&
        !nodeDesc.allowedValues.find((x) => x.value === node.value)
      ) {
        errors.push({
          pos: node.pos,
          message: `'${node.value}' is not in the list of allowed values`,
        });
      }

      break;
    }

    case "map": {
      if (node.type === nodeDesc.type) {
        node.desc = nodeDesc;

        const seenKeys = new Map<string, NodeMapping>();

        for (const mapping of node.mappings) {
          seenKeys.set(mapping.key, mapping);

          // Check if we know more about this key
          const mappingDesc = nodeDesc.keys && nodeDesc.keys[mapping.key];
          if (mappingDesc) {
            if (Array.isArray(mappingDesc)) {
            } else {
              validateNode(mapping.value, mappingDesc, errors);
            }
          }
        }

        // Check required keys
        if (nodeDesc.required) {
          for (const missingKey of nodeDesc.required.filter(
            (key) => !seenKeys.has(key)
          )) {
            errors.push({
              pos: node.pos,
              message: `Missing required key '${missingKey}'`,
            });
          }
        }

        if (nodeDesc.keys) {
          for (const [extraKey, mapping] of Array.from(seenKeys).filter(
            ([key]) => !nodeDesc.keys[key]
          )) {
            errors.push({
              pos: node.pos,
              message: `Key '${extraKey}' is not allowed`,
            });
          }
        }
      }
    }
  }

  return true;
}

export function validate(root: Node, schema: NodeDesc): ValidationError[] {
  const errors: ValidationError[] = [];

  validateNode(root, schema, errors);

  return errors;
}
