import YAML from "yaml";
import { Diagnostic, DiagnosticKind } from "../../types";
import { Workflow } from "../workflow";
import { normalizeWorkflow } from "../workflow/normalize";
import { ContextProviderFactory } from "./complete";
import { NodeDesc } from "./schema";
import { validate } from "./validator";

export interface WorkflowDocument {
  /** Normalized workflow */
  workflow?: Workflow;

  /** Errors and warnings found during parsing */
  diagnostics: Diagnostic[];

  /** Workflow AST */
  workflowST: YAML.Document;

  /** Mapping of AST nodes to mapped schema descriptions */
  nodeToDesc: Map<YAML.Node, NodeDesc>;
}

export async function parse(
  filename: string,
  input: string,
  schema: NodeDesc,
  contextProviderFactory: ContextProviderFactory
): Promise<WorkflowDocument> {
  const diagnostics: Diagnostic[] = [];

  // First, parse workflow
  let workflow: Workflow | undefined;

  try {
    workflow = YAML.parse(input);
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
  const yamlDoc = YAML.parseDocument(input);
  if (yamlDoc) {
    if (yamlDoc.errors.length > 0) {
      diagnostics.push(
        ...yamlDoc.errors.map((e) => ({
          kind:
            e.name === "YAMLWarning"
              ? DiagnosticKind.Warning
              : DiagnosticKind.Error,
          message: e.message,
          pos: e.pos,
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
    yamlDoc,
    schema,
    workflow,
    contextProviderFactory
  );
  diagnostics.push(...validationResult.errors);

  return {
    workflow,
    workflowST: yamlDoc,
    nodeToDesc: validationResult.nodeToDesc,
    diagnostics,
  };
}
