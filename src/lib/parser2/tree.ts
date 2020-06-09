import {
  Kind,
  YamlMap,
  YAMLMapping,
  YAMLNode,
  YAMLScalar,
  YAMLSequence,
} from "yaml-ast-parser";
import { ParseError } from "./error";
import { NodeDesc } from "./schema";

export type Position = [number, number];

export type Value = string | number | boolean;

type Mapping = {
  type: "mapping";
  key: string;
  value: Node;
};

type AddMeta<T> = T & NodeMeta;

export type NodeMapping = AddMeta<Mapping>;

type Sequence = {
  type: "sequence";
  items: Node[] | Value[];
};

export type NodeSequence = AddMeta<Sequence>;

type Map = {
  type: "map";
  mappings: NodeMapping[];
};

export type NodeMap = AddMeta<Map>;

type NodeMeta = {
  pos: Position;

  parent?: Node;
  desc?: NodeDesc;
};

export type Node = AddMeta<
  | Mapping
  | Sequence
  | Map
  | {
      type: "value";
      value: string | number;
    }
>;

function transform(yamlNode: YAMLNode, parent: Node = undefined): Node {
  switch (yamlNode.kind) {
    case Kind.SCALAR: {
      const yamlScalar = yamlNode as YAMLScalar;
      return {
        pos: [yamlScalar.startPosition, yamlScalar.endPosition],
        parent,
        type: "value",
        value: yamlScalar.value,
      };
    }

    case Kind.MAP: {
      const yamlMap = yamlNode as YamlMap;
      const mapNode: NodeMap = {
        pos: [yamlMap.startPosition, yamlMap.endPosition],
        parent,
        type: "map",
        mappings: [],
      };

      mapNode.mappings = yamlMap.mappings.map(
        (x) => transform(x, mapNode) as NodeMapping
      );

      return mapNode;
    }

    case Kind.SEQ: {
      const yamlSeq = yamlNode as YAMLSequence;
      const sequenceNode: NodeSequence = {
        pos: [yamlSeq.startPosition, yamlSeq.endPosition],
        parent,
        type: "sequence",
        items: [],
      };
      sequenceNode.items = yamlSeq.items.map((x) => transform(x, sequenceNode));

      return sequenceNode;
    }

    case Kind.MAPPING: {
      const yamlMapping = yamlNode as YAMLMapping;
      if (!yamlMapping.key || yamlMapping.key.kind !== Kind.SCALAR) {
        throw new ParseError(
          "Only scalar keys supported",
          yamlMapping.startPosition,
          yamlMapping.endPosition
        );
      }

      const mapping: NodeMapping = {
        pos: [yamlMapping.startPosition, yamlMapping.endPosition],
        parent,
        type: "mapping",
        key: yamlMapping.key.value,
        value: undefined,
      };

      if (yamlMapping.value) {
        mapping.value = transform(yamlMapping.value, mapping);
      }

      return mapping;
    }
  }
}

export function buildWorkflowSyntaxTree(yamlRoot: YAMLNode): Node {
  return transform(yamlRoot);
}
