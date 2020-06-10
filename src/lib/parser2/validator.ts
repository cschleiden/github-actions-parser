import {
  Kind,
  YAMLMap,
  YAMLMapping,
  YAMLNode,
  YAMLScalar,
} from "yaml-ast-parser";
import { YNode } from "../../types";
import { NodeDesc } from "./schema";
import { Position } from "./types";

export interface ValidationError {
  pos: Position;
  message: string;
}

function validateNode(
  node: YAMLNode,
  nodeDesc: NodeDesc,
  nodeToDesc: Map<YAMLNode, NodeDesc>,
  errors: ValidationError[]
): boolean {
  if (!node) {
    return true;
  }

  const n = node as YNode;

  const reportTypeMismatch = (expectedKind: Kind) => {
    errors.push({
      pos: [node.startPosition, node.endPosition],
      message: `Unexpected node of kind '${node.key}', expected ${expectedKind}`,
    });
    return false;
  };

  switch (nodeDesc.type) {
    // case "oneOf": {
    //   return true;
    // }

    case "value": {
      if (node.kind !== Kind.SCALAR) {
        reportTypeMismatch(Kind.SCALAR);
      }

      const scalarNode = node as YAMLScalar;

      nodeToDesc.set(scalarNode, nodeDesc);

      if (
        nodeDesc.allowedValues &&
        typeof scalarNode.value === "string" &&
        !nodeDesc.allowedValues.find((x) => x.value === scalarNode.value)
      ) {
        errors.push({
          pos: [scalarNode.startPosition, scalarNode.endPosition],
          message: `'${node.value}' is not in the list of allowed values`,
        });
      }

      break;
    }

    case "map": {
      if (n.kind !== Kind.MAP) {
        if (n.kind === Kind.SCALAR) {
          errors.push({
            pos: [n.startPosition, n.endPosition],
            message: `Unknown key '${n.value}'`,
          });
          return false;
        }

        reportTypeMismatch(Kind.MAP);
      }

      const mapNode = node as YAMLMap;

      nodeToDesc.set(node, nodeDesc);

      const seenKeys = new Map<string, YAMLMapping>();

      for (const mapping of mapNode.mappings) {
        const key = mapping.key.value;
        seenKeys.set(key, mapping);

        // Check if we know more about this key
        const mappingDesc = nodeDesc.keys && nodeDesc.keys[key];
        if (mappingDesc) {
          if (Array.isArray(mappingDesc)) {
            // Check if it satisfies one of the definitions
          } else {
            validateNode(mapping.value, mappingDesc, nodeToDesc, errors);
          }
        }
      }

      // Check required keys
      if (nodeDesc.required) {
        for (const missingKey of nodeDesc.required.filter(
          (key) => !seenKeys.has(key)
        )) {
          errors.push({
            pos: [node.startPosition, node.endPosition],
            message: `Missing required key '${missingKey}'`,
          });
        }
      }

      if (nodeDesc.keys) {
        for (const [extraKey, mapping] of Array.from(seenKeys).filter(
          ([key]) => !nodeDesc.keys[key]
        )) {
          errors.push({
            pos: [node.startPosition, node.endPosition],
            message: `Key '${extraKey}' is not allowed`,
          });
        }
      }
    }
  }

  return true;
}

export interface ValidationResult {
  errors: ValidationError[];

  nodeToDesc: Map<YAMLNode, NodeDesc>;
}

export function validate(root: YAMLNode, schema: NodeDesc): ValidationResult {
  const errors: ValidationError[] = [];
  const nodeToDesc = new Map<YAMLNode, NodeDesc>();
  nodeToDesc.set(null, schema);

  validateNode(root, schema, nodeToDesc, errors);

  return {
    errors,
    nodeToDesc,
  };
}
