import { YAMLNode } from "yaml-ast-parser";
import { PropertyPath } from "../utils/path";
import { WorkflowDocument } from "./parser";
import { CompletionOption } from "./types";

export type NodeDescMap = { [key: string]: NodeDesc };

type OneOfNodeDesc = {
  type: "oneOf";

  oneOf: NodeDesc[];
};

export type MapNodeDesc = {
  type: "map";

  /**
   * Map of key to Node or Node array.
   */
  keys?: NodeDescMap;

  /**
   * Alternatively, specify a template to validate children against
   */
  itemDesc?: NodeDesc;

  required?: string[];
};

type SequenceNodeDesc = {
  type: "sequence";

  itemDesc?: NodeDesc;
};

export type ValueDesc = {
  value: string;
  description?: string;
};

export type ValueNodeDesc = {
  type: "value";

  /** Allowed values */
  allowedValues?: ValueDesc[];

  /** If the node allows omitting ${{ }} to enter an expression */
  isExpression?: boolean;
};

export type NodeDesc = (
  | ValueNodeDesc
  | SequenceNodeDesc
  | MapNodeDesc
  | OneOfNodeDesc
) & {
  /** Description for this node, can contain markdown */
  description?: string;

  /**
   * Custom suggester
   *
   * @param desc
   * @param doc
   * @param path
   * @param input
   * @param existingItems
   */
  customSuggester?: (
    desc: NodeDesc,
    doc: WorkflowDocument,
    path: PropertyPath,
    input?: string,
    existingItems?: string[]
  ) => Promise<CompletionOption[]>;
  customValidator?: (
    node: YAMLNode,
    reportError: (message: string) => void
  ) => void;
};
