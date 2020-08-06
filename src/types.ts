import { YAMLException } from "yaml-ast-parser";

//
// Improved YAML AST types
//

export enum Kind {
  SCALAR = 0,
  MAPPING = 1,
  MAP = 2,
  SEQ = 3,
  ANCHOR_REF = 4,
  INCLUDE_REF = 5,
}
export interface YAMLDocument {
  startPosition: number;
  endPosition: number;
  errors: YAMLException[];
}

export interface YAMLNode extends YAMLDocument {
  startPosition: number;
  endPosition: number;
  kind: Kind;
  anchorId?: string;
  valueObject?: any;
  parent: YAMLNode;
  errors: YAMLException[];
  value?: any;
  key?: any;
  mappings?: any;
}

export interface YAMLAnchorReference extends YAMLNode {
  kind: Kind.ANCHOR_REF;

  referencesAnchor: string;
  value: YAMLNode;
}

export interface YAMLScalar extends YAMLNode {
  kind: Kind.SCALAR;

  value: string;
  doubleQuoted?: boolean;
  singleQuoted?: boolean;
  plainScalar?: boolean;
  rawValue: string;
}

export interface YAMLMapping extends YAMLNode {
  kind: Kind.MAPPING;

  key: YAMLScalar;
  value: YAMLNode;
}

export interface YAMLSequence extends YAMLNode {
  kind: Kind.SEQ;

  items: YAMLNode[];
}

export interface YAMLMap extends YAMLNode {
  kind: Kind.MAP;

  mappings: YAMLMapping[];
}

export type YNode = YAMLMap | YAMLMapping | YAMLSequence | YAMLScalar;

//
// Custom types
//

export type Position = [number, number];

export interface CompletionOption {
  /** Auto complete value */
  value: string;

  /** Optional description for this completion option */
  description?: string;
}

export interface Hover {
  /** Description for the hover, might be formatted with markdown */
  description: string;
}
