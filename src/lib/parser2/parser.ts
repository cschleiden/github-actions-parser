import { Kind, safeLoad, YAMLNode } from "yaml-ast-parser";
import { NodeDesc } from "./schema";
import { buildWorkflowSyntaxTree } from "./tree";
import { validate } from "./validator";

export interface Workflow {
  name?: string;
}

export interface WorkflowDocument {
  workflow?: Workflow;

  diagnostics: Diagnostic[];
}

export enum DiagnosticKind {
  Error,
  Warning,
}

export interface Diagnostic {
  kind: DiagnosticKind;

  message: string;

  start: number;
  end: number;
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

export function parse(input: string): WorkflowDocument {
  const workflowDoc: WorkflowDocument = {
    diagnostics: [],
  };

  const addError = (start: number, end: number, message: string) => {
    workflowDoc.diagnostics.push({
      kind: DiagnosticKind.Error,
      message,
      start,
      end,
    });
  };

  const yamlRoot = safeLoad(input);

  const workflowST = buildWorkflowSyntaxTree(yamlRoot);

  const errors = validate(workflowST);
  workflowDoc.diagnostics.push(
    ...errors.map(({ startPos, endPos, message }) => ({
      kind: DiagnosticKind.Error,
      message,
      start: startPos,
      end: endPos,
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

  return workflowDoc;
}

export interface CompletionOption {
  value: string;
}

export function autoComplete(
  input: string,
  offset: number
): CompletionOption[] {
  return [];
}
