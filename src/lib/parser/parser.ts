import { Kind, safeLoad, YAMLNode } from "yaml-ast-parser";
import { NodeDesc } from "./schema";
import { Position } from "./types";
import { validate } from "./validator";

export interface Workflow {
  name?: string;
}

export interface WorkflowDocument {
  /** Normalized workflow */
  workflow?: Workflow;

  /** Errors and warnings found during parsing */
  diagnostics: Diagnostic[];

  /** Workflow AST */
  workflowST: YAMLNode;

  /** Mapping of AST nodes to mapped schema descriptions */
  nodeToDesc: Map<YAMLNode, NodeDesc>;

  /** Schema used for parsing and validation */
  schema: NodeDesc;
}

export enum DiagnosticKind {
  Error,
  Warning,
}

export interface Diagnostic {
  kind: DiagnosticKind;

  message: string;

  pos: Position;
}

const kindToType = {
  [Kind.MAP]: "map",
  [Kind.SEQ]: "sequence",
  [Kind.SCALAR]: "value",
};

function walk(node: YAMLNode, desc: NodeDesc) {
  // Check desired type
  if (kindToType[node.kind] !== desc.type) {
    // report error!
  }

  // for (const child of node.mappings)
}

export function parse(input: string, schema: NodeDesc): WorkflowDocument {
  const diagnostics: Diagnostic[] = [];

  const yamlRoot = safeLoad(input);
  const validationResult = validate(yamlRoot, schema);
  diagnostics.push(
    ...validationResult.errors.map(({ pos, message }) => ({
      kind: DiagnosticKind.Error,
      message,
      pos,
    }))
  );

  return {
    workflow: {},
    workflowST: yamlRoot,
    nodeToDesc: validationResult.nodeToDesc,
    diagnostics,
    schema,
  };
}
