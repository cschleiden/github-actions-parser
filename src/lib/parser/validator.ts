import { CustomValue, CustomValueValidation, NodeDesc } from "./schema";
import { Diagnostic, DiagnosticKind, Position, YNode } from "../../types";
import {
  Kind,
  YAMLMapping,
  YAMLNode,
  YAMLScalar,
  YamlMap,
} from "yaml-ast-parser";
import {
  containsExpression,
  iterateExpressions,
} from "../expressions/embedding";

import { ContextProvider } from "../expressions/types";
import { ContextProviderFactory } from "./complete";
import { Workflow } from "../workflow";
import { getPathFromNode } from "./ast";
import { validateExpression } from "../expressions/validator";

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

    default:
      throw new Error("Unexpected node kind");
  }
}

function validateExpressions(
  input: string,
  posOffset: number,
  errors: Diagnostic[],
  contextProvider: ContextProvider
) {
  iterateExpressions(input, (expr, pos) => {
    validateExpression(expr, posOffset + pos, errors, contextProvider);
  });
}

async function validateNode(
  node: YAMLNode,
  nodeDesc: NodeDesc,
  nodeToDesc: Map<YAMLNode, NodeDesc>,
  workflow: Workflow | undefined,
  contextProviderFactory: ContextProviderFactory,
  diagnostics: Diagnostic[]
): Promise<boolean> {
  if (!node) {
    return true;
  }

  const n = node as YNode;

  const reportTypeMismatch = (expectedType: string, actualKind: Kind) => {
    diagnostics.push({
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
        diagnostics.push({
          pos: [scalarNode.startPosition, scalarNode.endPosition],
          message: `'${node.value}' is not in the list of allowed values`,
        });
      } else if (nodeDesc.customValueProvider) {
        let customValues: CustomValue[] | undefined;

        try {
          customValues = await nodeDesc.customValueProvider(
            nodeDesc,
            workflow,
            getPathFromNode(n)
          );
        } catch (e) {
          diagnostics.push({
            kind: DiagnosticKind.Warning,
            pos: [scalarNode.startPosition, scalarNode.endPosition],
            message: `Could not retrieve values: ${e?.message}`,
          });
        }

        if (!customValues?.find((x) => x.value === scalarNode.value)) {
          diagnostics.push({
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
          // Use raw value here to match offsets
          scalarNode.rawValue,
          n.startPosition,
          diagnostics,
          await contextProviderFactory.get(workflow, path)
        );
      }

      break;
    }

    case "map": {
      if (n.kind !== Kind.MAP) {
        if (n.kind === Kind.SCALAR) {
          diagnostics.push({
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
        try {
          customValues = await nodeDesc.customValueProvider(
            nodeDesc,
            workflow,
            getPathFromNode(n)
          );
        } catch (e) {
          diagnostics.push({
            kind: DiagnosticKind.Warning,
            pos: [mapNode.startPosition, mapNode.endPosition],
            message: `Could not retrieve values: ${e?.message}`,
          });
        }
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
            diagnostics
          );
        } else if (nodeDesc.itemDesc) {
          await validateNode(
            mapping.value,
            nodeDesc.itemDesc,
            nodeToDesc,
            workflow,
            contextProviderFactory,
            diagnostics
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
          if (mapNode.parent && mapNode.parent.key) {
            pos = [
              mapNode.parent.key.startPosition,
              mapNode.parent.key.endPosition,
            ];
          }

          diagnostics.push({
            pos,
            message: `Missing required key '${missingKey}'`,
          });
        }
      }

      if (nodeDesc.keys || customValues) {
        // Calculate list of allowed keys from schema and dynamic values
        const allowedKeys = new Set<string>([
          ...((nodeDesc.keys && Object.keys(nodeDesc.keys)) || []),
          ...(customValues || []).map((x) => x.value),
        ]);

        // Compare allowed and seen keys
        const unknownKeys = Array.from(seenKeys).filter(
          ([key]) => !allowedKeys.has(key)
        );
        for (const [unknownKey, mappingNode] of unknownKeys) {
          diagnostics.push({
            pos: [mappingNode.key.startPosition, mappingNode.key.endPosition],
            message: `Key '${unknownKey}' is not allowed`,
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
              diagnostics
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
                diagnostics
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
                diagnostics
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
                diagnostics
              );
              foundMatchingNode = true;
            }
            break;
        }
      }

      if (!foundMatchingNode) {
        diagnostics.push({
          pos: [node.startPosition, node.endPosition],
          message: `Did not expect '${kindToString(n.kind)}'`,
        });
      }
    }
  }

  return true;
}

export interface ValidationResult {
  errors: Diagnostic[];

  nodeToDesc: Map<YAMLNode, NodeDesc>;
}

export async function validate(
  root: YAMLNode,
  schema: NodeDesc,
  workflow: Workflow | undefined,
  contextProviderFactory: ContextProviderFactory
): Promise<ValidationResult> {
  const diagnostics: Diagnostic[] = [];
  const nodeToDesc = new Map<YAMLNode, NodeDesc>();
  // nodeToDesc.set(null, schema);

  await validateNode(
    root,
    schema,
    nodeToDesc,
    workflow,
    contextProviderFactory,
    diagnostics
  );

  return {
    errors: diagnostics.map((x) => ({
      ...x,
      kind: x.kind || DiagnosticKind.Error,
    })),
    nodeToDesc,
  };
}
