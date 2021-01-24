import { Diagnostic, DiagnosticKind, Position } from "../../types";
import { YAMLNode, safeLoad } from "yaml-ast-parser";

import { ContextProviderFactory } from "./complete";
import { NodeDesc } from "./schema";
import { Workflow } from "../workflow";
import { load as jsYamlLoad } from "js-yaml";
import { normalizeWorkflow } from "../workflow/normalize";
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
  let workflow: Workflow | undefined;

  try {
    workflow = jsYamlLoad(input);
  } catch {
    // Ignore error here, will be reported below
  }

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
  if (yamlRoot) {
    if (yamlRoot.errors.length > 0) {
      diagnostics.push(
        ...yamlRoot.errors.map((e) => ({
          kind: e.isWarning ? DiagnosticKind.Warning : DiagnosticKind.Error,
          message: e.reason,
          pos: [e.mark.position, e.mark.position + 1] as Position,
        }))
      );
    }
  } else {
    diagnostics.push({
      message: "Could not parse input",
      pos: [0, input?.length || 0],
      kind: DiagnosticKind.Error,
    });
  }

  const validationResult = await validate(
    yamlRoot,
    schema,
    workflow,
    contextProviderFactory
  );
  diagnostics.push(...validationResult.errors);

  return {
    workflow,
    workflowST: yamlRoot,
    nodeToDesc: validationResult.nodeToDesc,
    diagnostics,
  };
}
