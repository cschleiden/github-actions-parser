import { PropertyPath } from "../utils/path";
import { Workflow } from "./parser";

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
   * Custom value provider, used for auto-complete and validation
   *
   * @param desc Description for node to provide value for
   * @param workflow Workflow if it could be parsed
   * @param path Path in the workflow
   */
  customValueProvider?: CustomValueProvider;
};

export enum CustomValueValidation {
  /** Default, no special handling */
  None = 0,

  /**
   * Value/key must be provided
   *
   * This is mostly used for requiring certain keys to be provided
   **/
  Required = 1,
}

export interface CustomValue {
  value: string;

  description?: string;

  validation?: CustomValueValidation;
}

export type CustomValueProvider = (
  desc: NodeDesc,
  workflow: Workflow | undefined,
  path: PropertyPath
) => Promise<CustomValue[]>;
