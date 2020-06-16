import { Kind, safeLoad, YAMLNode } from "yaml-ast-parser";
import { NodeDesc } from "./schema";
import { Position } from "./types";
import { validate } from "./validator";
import { WorkflowSchema } from "./workflowSchema";

export interface Workflow {
  name?: string;
}

export interface WorkflowDocument {
  /** Normalized workflow */
  workflow?: Workflow;

  workflowST: YAMLNode;

  nodeToDesc: Map<YAMLNode, NodeDesc>;

  diagnostics: Diagnostic[];
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

export function parse(
  input: string,
  schema = WorkflowSchema
): WorkflowDocument {
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

  // Parsing:
  // - Parse into yaml AST
  //  -> Return any errors that prevent successful parsing
  // - Transform into workflow AST
  // - Validate with schema
  // - Transform into workflow structure and return.

  // Suggest completion items:
  // - Parse into yaml AST
  // - Transform into workflow AST
  // - Find node for current input position
  // - Suggest values using schema, based on tree
  //  - Future: do we need the runtime model for anything? Env, secrets, labels?
  //  - Somehow tie in expressions..., maybe separate auto-complete logic?

  return {
    workflow: {},
    workflowST: yamlRoot,
    nodeToDesc: validationResult.nodeToDesc,
    diagnostics,
  };
}
