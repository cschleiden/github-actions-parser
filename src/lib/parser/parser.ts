import { safeLoad as jsYamlSafeLoad } from "js-yaml";
import { Kind, safeLoad, YAMLNode } from "yaml-ast-parser";
import { Position } from "../../types";
import { ContextProviderFactory } from "./complete";
import { NodeDesc } from "./schema";
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

export async function parse(
  input: string,
  schema: NodeDesc,
  contextProviderFactory: ContextProviderFactory
): Promise<WorkflowDocument> {
  const diagnostics: Diagnostic[] = [];

  // TODO: CS: Get this from the AST
  let workflow = {} as Workflow;
  try {
    workflow = jsYamlSafeLoad(input);
  } catch {
    // Ignore..
  }

  const yamlRoot = safeLoad(input);
  const validationResult = await validate(
    yamlRoot,
    schema,
    workflow,
    contextProviderFactory
  );
  diagnostics.push(
    ...validationResult.errors.map(({ pos, message }) => ({
      kind: DiagnosticKind.Error,
      message,
      pos,
    }))
  );

  return {
    workflow,
    workflowST: yamlRoot,
    nodeToDesc: validationResult.nodeToDesc,
    diagnostics,
    schema,
  };
}
