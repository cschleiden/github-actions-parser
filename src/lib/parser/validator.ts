import YAML from "yaml";
import { Diagnostic, DiagnosticKind, Position } from "../../types";
import { replaceExpressions } from "../expressions";
import {
  containsExpression,
  iterateExpressions,
} from "../expressions/embedding";
import { ContextProvider } from "../expressions/types";
import { validateExpression } from "../expressions/validator";
import { Workflow } from "../workflow";
import { getPathFromNode } from "./ast";
import { ContextProviderFactory } from "./complete";
import { CustomValue, CustomValueValidation, NodeDesc } from "./schema";

function nodeToString(n: YAML.Node): string {
  if (YAML.isScalar(n)) {
    return "value";
  }

  if (YAML.isMap(n)) {
    return "map";
  }

  if (YAML.isSeq(n)) {
    return "sequence";
  }

  if (YAML.isPair(n)) {
    return "mapping";
  }

  throw new Error("Unexpected node type");
}

function nodePos(n: YAML.Node): Position {
  if (!n.range) {
    throw new Error("Node has no range");
  }

  return [n.range![0], n.range![2]];
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

function reportTypeMismatch(
  diagnostics: Diagnostic[],
  expectedType: string,
  n: YAML.Node
) {
  diagnostics.push({
    pos: nodePos(n),
    message: `Expected ${expectedType}, found ${nodeToString(n)}`,
  });
}

async function validateNode(
  doc: YAML.Document,
  node: YAML.Node,
  parents: (YAML.Node | YAML.Pair<YAML.ParsedNode, YAML.ParsedNode>)[],
  nodeDesc: NodeDesc,
  nodeToDesc: Map<YAML.Node | YAML.Pair, NodeDesc>,
  workflow: Workflow | undefined,
  contextProviderFactory: ContextProviderFactory,
  diagnostics: Diagnostic[]
): Promise<boolean> {
  if (!node) {
    return true;
  }

  switch (nodeDesc.type) {
    case "value": {
      if (!YAML.isScalar(node)) {
        reportTypeMismatch(diagnostics, "value", node);
      }

      const scalarNode = node as YAML.Scalar;

      // Store for later lookup
      nodeToDesc.set(scalarNode, nodeDesc);

      let input = scalarNode.value as string; // TODO: Is value always a string?

      if (nodeDesc.isExpression || containsExpression(input)) {
        const path = getPathFromNode(doc, node);

        const contextProvider = await contextProviderFactory.get(
          workflow,
          path
        );

        // Validate scalar value as expression if it looks like one, or if we always expect one
        // here.
        validateExpressions(
          // Use raw value here to match offsets
          scalarNode.value as string, // TODO: Scalar string
          nodePos(scalarNode)[0],
          diagnostics,
          contextProvider
        );

        if (nodeDesc.supportsExpression) {
          input = replaceExpressions(
            scalarNode.value as string,
            contextProvider
          ); // TODO: Scalar string
        }
      }

      // Value is set using an expression, we cannot check against allowed values
      // In the future we might try to resolve this but for now don't do any additional checking
      if (
        nodeDesc.allowedValues &&
        !nodeDesc.allowedValues.find((x) => x.value === input)
      ) {
        diagnostics.push({
          pos: nodePos(scalarNode),
          message: `'${input}' is not in the list of allowed values`,
        });
      } else if (nodeDesc.customValueProvider) {
        let customValues: CustomValue[] | undefined;

        try {
          customValues = await nodeDesc.customValueProvider(
            nodeDesc,
            workflow,
            getPathFromNode(doc, node)
          );
        } catch (e) {
          diagnostics.push({
            kind: DiagnosticKind.Warning,
            pos: nodePos(scalarNode),
            message: `Could not retrieve values: ${e?.message}`,
          });
        }

        if (customValues && !customValues?.find((x) => x.value === input)) {
          diagnostics.push({
            pos: nodePos(scalarNode),
            message: `'${input}' is not in the list of allowed values`,
          });
        }
      }

      break;
    }

    case "map": {
      if (!YAML.isMap(node)) {
        if (YAML.isScalar(node)) {
          diagnostics.push({
            pos: nodePos(node),
            message: `Unknown key '${node.value}'`,
          });

          return false;
        }

        reportTypeMismatch(diagnostics, "map", node);
        break;
      }

      const mapNode = node as YAML.YAMLMap<YAML.ParsedNode, YAML.ParsedNode>;
      nodeToDesc.set(node, nodeDesc);

      let customValues: CustomValue[] | undefined;
      if (nodeDesc.customValueProvider) {
        try {
          customValues = await nodeDesc.customValueProvider(
            nodeDesc,
            workflow,
            getPathFromNode(doc, node)
          );
        } catch (e) {
          diagnostics.push({
            kind: DiagnosticKind.Warning,
            pos: nodePos(mapNode),
            message: `Could not retrieve values: ${e?.message}`,
          });
        }
      }

      const seenKeys = new Map<
        string,
        YAML.Pair<YAML.ParsedNode, YAML.ParsedNode>
      >();

      for (const mapping of mapNode.items) {
        const key = (mapping.key as YAML.Scalar).value as string; // TODO: Scalar string
        seenKeys.set(key, mapping);

        // Check if we know more about this key
        const mappingDesc = nodeDesc.keys && nodeDesc.keys[key];
        if (mappingDesc) {
          // Validate each mapping

          // Add mapping desc for later lookup (e.g., to complete keys)
          nodeToDesc.set(mapping, mappingDesc);
          await validateNode(
            doc,
            mapping.value!,
            [...parents, mapping],
            mappingDesc,
            nodeToDesc,
            workflow,
            contextProviderFactory,
            diagnostics
          );
        } else if (nodeDesc.itemDesc) {
          await validateNode(
            doc,
            mapping.value!,
            [...parents, mapping],
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
          // Only include required custom values
          ...(customValues || [])
            .filter((x) => x.validation === CustomValueValidation.Required)
            .map((x) => x.value),
        ];

        for (const missingKey of requiredKeys.filter(
          (key) => !seenKeys.has(key)
        )) {
          let pos: Position = nodePos(mapNode);
          if (parents.length > 0) {
            const parent = parents[parents.length - 1];
            if (YAML.isPair(parent)) {
              pos = nodePos(parent.key);
            }
          }

          diagnostics.push({
            pos,
            message: `Missing required key '${missingKey}'`,
          });
        }
      }

      if (!nodeDesc.allowUnknownKeys && (nodeDesc.keys || customValues)) {
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
            pos: nodePos(mappingNode.key),
            message: `Key '${unknownKey}' is not allowed`,
          });
        }
      }

      break;
    }

    case "sequence": {
      if (!YAML.isSeq(node)) {
        reportTypeMismatch(diagnostics, "sequence", node);
      } else {
        nodeToDesc.set(node, nodeDesc);

        const seqNode = node as YAML.YAMLSeq<YAML.ParsedNode>;

        if (nodeDesc.itemDesc) {
          for (const item of seqNode.items) {
            // Record the itemdesc as the desired desc for the item. This might fail in the validateNode call,
            // but is required for auto-complete (e.g., type doesn't match yet, but we still want to be able to
            // suggest values)
            nodeToDesc.set(item, nodeDesc.itemDesc);

            await validateNode(
              doc,
              item,
              [...parents, seqNode],
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
            if (YAML.isScalar(node)) {
              await validateNode(
                doc,
                node,
                parents,
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
            if (YAML.isMap(node)) {
              await validateNode(
                doc,
                node,
                parents,
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
            if (YAML.isSeq(node)) {
              await validateNode(
                doc,
                node,
                parents,
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
          pos: nodePos(node),
          message: `Did not expect '${nodeToString(node)}'`,
        });
      }
    }
  }

  return true;
}

export interface ValidationResult {
  errors: Diagnostic[];

  nodeToDesc: Map<YAML.Node, NodeDesc>;
}

export async function validate(
  doc: YAML.Document,
  schema: NodeDesc,
  workflow: Workflow | undefined,
  contextProviderFactory: ContextProviderFactory
): Promise<ValidationResult> {
  const diagnostics: Diagnostic[] = [];
  const nodeToDesc = new Map<YAML.Node, NodeDesc>();

  await validateNode(
    doc,
    doc.contents!,
    [doc.contents!],
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
