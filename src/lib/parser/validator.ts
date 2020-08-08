import {
  Kind,
  YamlMap,
  YAMLMapping,
  YAMLNode,
  YAMLScalar,
} from "yaml-ast-parser";
import { Position, YNode } from "../../types";
import { containsExpression } from "../expressions";
import { ContextProvider } from "../expressions/types";
import { validateExpression } from "../expressions/validator";
import { getPathFromNode } from "./ast";
import { ContextProviderFactory } from "./complete";
import { Workflow } from "./parser";
import { CustomValue, CustomValueValidation, NodeDesc } from "./schema";

export interface ValidationError {
  pos: Position;
  message: string;
}

function kindToString(kind: Kind): string {
  switch (kind) {
    case Kind.SCALAR:
      return "value";

    case Kind.MAPPING:
      return "mapping";

    case Kind.MAP:
      return "map";

    case Kind.SEQ:
      return "sequence";
  }
}

function validateExpressions(
  input: string,
  posOffset: number,
  errors: ValidationError[],
  contextProvider: ContextProvider
) {
  // TODO: CS: Need to find all expressions in input and then validate them separately
  validateExpression(input, posOffset, errors, contextProvider);
}

async function validateNode(
  node: YAMLNode,
  nodeDesc: NodeDesc,
  nodeToDesc: Map<YAMLNode, NodeDesc>,
  workflow: Workflow,
  contextProviderFactory: ContextProviderFactory,
  errors: ValidationError[]
): Promise<boolean> {
  if (!node) {
    return true;
  }

  const n = node as YNode;

  const reportTypeMismatch = (expectedType: string, actualKind: Kind) => {
    errors.push({
      pos: [n.startPosition, n.endPosition],
      message: `Expected ${expectedType}, found ${kindToString(actualKind)}`,
    });
  };

  switch (nodeDesc.type) {
    case "value": {
      if (n.kind !== Kind.SCALAR) {
        reportTypeMismatch("value", n.kind);
      }

      const scalarNode = node as YAMLScalar;

      nodeToDesc.set(scalarNode, nodeDesc);

      if (
        nodeDesc.allowedValues &&
        !nodeDesc.allowedValues.find((x) => x.value === scalarNode.value)
      ) {
        errors.push({
          pos: [scalarNode.startPosition, scalarNode.endPosition],
          message: `'${node.value}' is not in the list of allowed values`,
        });
      } else if (nodeDesc.customValueProvider) {
        const customValues = await nodeDesc.customValueProvider(
          nodeDesc,
          workflow,
          getPathFromNode(n)
        );
        if (!customValues.find((x) => x.value === scalarNode.value)) {
          errors.push({
            pos: [scalarNode.startPosition, scalarNode.endPosition],
            message: `'${node.value}' is not in the list of allowed values`,
          });
        }
      }

      const input = scalarNode.value;
      if (nodeDesc.isExpression || containsExpression(input)) {
        // Validate scalar value as expression if it looks like one, or if we always expect one
        // here.
        const path = getPathFromNode(n);
        validateExpressions(
          scalarNode.value,
          n.startPosition,
          errors,
          await contextProviderFactory.get(workflow, path)
        );
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

        reportTypeMismatch("map", n.kind);
      }

      const mapNode = node as YamlMap;
      nodeToDesc.set(node, nodeDesc);

      let customValues: CustomValue[] | undefined;
      if (nodeDesc.customValueProvider) {
        customValues = await nodeDesc.customValueProvider(
          nodeDesc,
          workflow,
          getPathFromNode(n)
        );
      }

      const seenKeys = new Map<string, YAMLMapping>();

      for (const mapping of mapNode.mappings) {
        const key = mapping.key.value;
        seenKeys.set(key, mapping);

        // Check if we know more about this key
        const mappingDesc = nodeDesc.keys && nodeDesc.keys[key];
        if (mappingDesc) {
          // Validate each mapping

          // Add mapping desc for later lookup (e.g., to complete keys)
          nodeToDesc.set(mapping, mappingDesc);
          await validateNode(
            mapping.value,
            mappingDesc,
            nodeToDesc,
            workflow,
            contextProviderFactory,
            errors
          );
        } else if (nodeDesc.itemDesc) {
          await validateNode(
            mapping.value,
            nodeDesc.itemDesc,
            nodeToDesc,
            workflow,
            contextProviderFactory,
            errors
          );
        }
      }

      // Check required keys
      if (nodeDesc.required || customValues) {
        const requiredKeys = [
          ...(nodeDesc.required || []),
          ...(customValues || [])
            .filter((x) => x.validation === CustomValueValidation.Required)
            .map((x) => x.value),
        ];

        for (const missingKey of requiredKeys.filter(
          (key) => !seenKeys.has(key)
        )) {
          let pos: Position = [mapNode.startPosition, mapNode.endPosition];
          if (mapNode.parent) {
            pos = [mapNode.parent.startPosition, mapNode.parent.endPosition];
          }

          errors.push({
            pos,
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

      break;
    }

    case "sequence": {
      if (n.kind !== Kind.SEQ) {
        reportTypeMismatch("sequence", n.kind);
      } else {
        nodeToDesc.set(node, nodeDesc);

        if (nodeDesc.itemDesc) {
          for (const item of n.items) {
            // Record the itemdesc as the desired desc for the item. This might fail in the validateNode call,
            // but is required for auto-complete (e.g., type doesn't match yet, but we still want to be able to
            // suggest values)
            nodeToDesc.set(item, nodeDesc.itemDesc);

            await validateNode(
              item,
              nodeDesc.itemDesc,
              nodeToDesc,
              workflow,
              contextProviderFactory,
              errors
            );
          }
        }
      }

      break;
    }

    case "oneOf": {
      let foundMatchingNode = false;

      for (const nDesc of nodeDesc.oneOf) {
        switch (nDesc.type) {
          case "value":
            if (node.kind === Kind.SCALAR) {
              await validateNode(
                node,
                nDesc,
                nodeToDesc,
                workflow,
                contextProviderFactory,
                errors
              );
              foundMatchingNode = true;
            }
            break;

          case "map":
            if (node.kind === Kind.MAP) {
              await validateNode(
                node,
                nDesc,
                nodeToDesc,
                workflow,
                contextProviderFactory,
                errors
              );
              foundMatchingNode = true;
            }
            break;

          case "sequence":
            if (node.kind === Kind.SEQ) {
              await validateNode(
                node,
                nDesc,
                nodeToDesc,
                workflow,
                contextProviderFactory,
                errors
              );
              foundMatchingNode = true;
            }
            break;
        }
      }

      if (!foundMatchingNode) {
        errors.push({
          pos: [node.startPosition, node.endPosition],
          message: `Did not expect '${kindToString(n.kind)}'`,
        });
      }
    }
  }

  return true;
}

export interface ValidationResult {
  errors: ValidationError[];

  nodeToDesc: Map<YAMLNode, NodeDesc>;
}

export async function validate(
  root: YAMLNode,
  schema: NodeDesc,
  workflow: Workflow,
  contextProviderFactory: ContextProviderFactory
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const nodeToDesc = new Map<YAMLNode, NodeDesc>();
  nodeToDesc.set(null, schema);

  await validateNode(
    root,
    schema,
    nodeToDesc,
    workflow,
    contextProviderFactory,
    errors
  );

  return {
    errors,
    nodeToDesc,
  };
}
