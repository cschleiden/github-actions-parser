import {
  Kind,
  YamlMap,
  YAMLMapping,
  YAMLNode,
  YAMLScalar,
  YAMLSequence,
} from "yaml-ast-parser";
import { ParseError } from "./error";

export type Value = string | number | boolean;

type Mapping = {
  type: "mapping";
  key: string;
  value: Node;
};

export type NodeMapping = Mapping & {
  startPos: number;
  endPos: number;
};

export type Node = (
  | Mapping
  | {
      type: "sequence";
      items: Node[] | Value[];
    }
  | {
      type: "map";
      mappings: NodeMapping[];
    }
  | {
      type: "value";
      value: string | number;
    }
) & {
  startPos: number;
  endPos: number;
};

function transform(yamlNode: YAMLNode): Node {
  switch (yamlNode.kind) {
    case Kind.SCALAR: {
      const yamlScalar = yamlNode as YAMLScalar;
      return {
        startPos: yamlScalar.startPosition,
        endPos: yamlScalar.endPosition,
        type: "value",
        value: yamlScalar.value,
      };
    }

    case Kind.MAP: {
      const yamlMap = yamlNode as YamlMap;
      return {
        startPos: yamlMap.startPosition,
        endPos: yamlMap.endPosition,
        type: "map",
        mappings: yamlNode.mappings.map(transform),
      };
    }

    case Kind.SEQ: {
      const yamlSeq = yamlNode as YAMLSequence;
      return {
        startPos: yamlSeq.startPosition,
        endPos: yamlSeq.endPosition,
        type: "sequence",
        items: yamlSeq.items.map(transform),
      };
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

      return {
        startPos: yamlMapping.startPosition,
        endPos: yamlMapping.endPosition,
        type: "mapping",
        key: yamlMapping.key.value,
        value: transform(yamlMapping.value),
      };
    }
  }
}

export function buildWorkflowSyntaxTree(yamlRoot: YAMLNode): Node {
  return transform(yamlRoot);
}
