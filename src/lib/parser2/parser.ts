import { Kind, safeLoad, YAMLNode } from "yaml-ast-parser";
import { NodeDesc } from "./schema";
import { buildWorkflowSyntaxTree, Node, Position } from "./tree";
import { validate } from "./validator";
import { workflowSchema } from "./workflowSchema";

export interface Workflow {
  name?: string;
}

export interface WorkflowDocument {
  /** Normalized workflow */
  workflow?: Workflow;

  workflowST: Node;

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
  schema = workflowSchema
): WorkflowDocument {
  const diagnostics: Diagnostic[] = [];

  const addError = (pos: Position, message: string) => {
    diagnostics.push({
      kind: DiagnosticKind.Error,
      message,
      pos,
    });
  };

  const yamlRoot = safeLoad(input);

  const workflowST = buildWorkflowSyntaxTree(yamlRoot);

  const errors = validate(workflowST, schema);
  diagnostics.push(
    ...errors.map(({ pos, message }) => ({
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
    workflowST,
    diagnostics,
  };
}
