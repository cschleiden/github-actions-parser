import { safeLoad as jsYamlSafeLoad } from "js-yaml";
import { safeLoad, YAMLNode } from "yaml-ast-parser";
import { Diagnostic, DiagnosticKind } from "../../types";
import { Workflow } from "../workflow";
import { ContextProviderFactory } from "./complete";
import { normalizeWorkflow } from "./normalize";
import { NodeDesc } from "./schema";
import { validate } from "./validator";

export interface WorkflowDocument {
  /** Normalized workflow */
  workflow?: Workflow;

  /** Errors and warnings found during parsing */
  diagnostics: Diagnostic[];

  /** Workflow AST */
  workflowST: YAMLNode;

  /** Mapping of AST nodes to mapped schema descriptions */
  nodeToDesc: Map<YAMLNode, NodeDesc>;
}

export async function parse(
  filename: string,
  input: string,
  schema: NodeDesc,
  contextProviderFactory: ContextProviderFactory
): Promise<WorkflowDocument> {
  const diagnostics: Diagnostic[] = [];

  // First, parse workflow using js-yaml
  let workflow = jsYamlSafeLoad(input);

  // Normalize the resulting JSON object, e.g., make sure options that can be specified in
  // multiple ways in the YAML (scalar/sequence/map) are always represented in the same way.
  if (typeof workflow === "object") {
    normalizeWorkflow(filename, workflow);
  } else {
    // Workflow couldn't be parsed correctly, set to undefined since we cannot reason about it anyway
    workflow = undefined;
  }

  // Second, parse again using yaml-ast-parser. The resulting AST is used for validation, auto-completion
  // and other evaluations.
  //
  // Long term it's obviously wasteful to parse the input twice and the workflow JSON should be derived
  // from the AST, but for now this is the easiest option.
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
  };
}
