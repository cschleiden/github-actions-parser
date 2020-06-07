// Adapted from: https://github.com/kachkaev/pseudo-yaml-ast
import { Kind, load, YAMLNode, YAMLSequence } from "yaml-ast-parser";

function isNull(x: any) {
  return x === null;
}

function isUndefined(x: any) {
  return typeof x === "undefined";
}

function hasOwnProp(x: Object, key: string) {
  return x.hasOwnProperty(key);
}

export const loc = Symbol("pseudo-yaml-ast-loc");

const isPrimitive = (v: any) =>
  Number.isNaN(v) || isNull(v) || isUndefined(v) || typeof v === "symbol";

const isPrimitiveNode = (node: YAMLNode) =>
  isPrimitive(node.value) || !hasOwnProp(node, "value");

const isBetween = (start: number, pos: number, end: number) =>
  pos <= end && pos >= start;

type Position = {
  line: number;
  column: number;
};

const getLoc = (input: string, { start = 0, end = 0 }) => {
  const lines = input.split(/\n/);

  const loc = {
    start: {} as Position,
    end: {} as Position,
  };

  let sum = 0;

  for (const i of Object.keys(lines)) {
    const line = lines[i];
    const ls = sum;
    const le = sum + line.length;

    if (isUndefined(loc.start.line) && isBetween(ls, start, le)) {
      loc.start.line = +i + 1;
      loc.start.column = start - ls;
    }

    if (isUndefined(loc.end.line) && isBetween(ls, end, le)) {
      loc.end.line = +i + 1;
      loc.end.column = end - ls;
    }

    sum = le + 1; // +1 because the break is also a char
  }

  return loc;
};

const visitors: {
  [kind: number]: (node: YAMLNode, input: string, ctx: {}) => {};
} = {
  [Kind.MAP]: (node: YAMLNode, input = "", ctx = {}) =>
    Object.assign(walk(node.mappings, input), {
      [loc]: getLoc(input, {
        start: node.startPosition,
        end: node.endPosition,
      }),
    }),
  [Kind.MAPPING]: (node: YAMLNode, input = "", ctx = {}) => {
    const value = walk([node.value], input);

    if (!isPrimitive(value)) {
      value[loc] = getLoc(input, {
        start: node.startPosition,
        end: node.endPosition,
      });
    }

    return Object.assign(ctx, {
      [node.key.value]: value,
    });
  },
  [Kind.SCALAR]: (node: YAMLNode, input = "") => {
    if (isPrimitiveNode(node)) {
      return node.value;
    }

    const _loc = getLoc(input, {
      start: node.startPosition,
      end: node.endPosition,
    });

    const wrappable = (Constructor) => () => {
      const v = new Constructor(node.value);
      v[loc] = _loc;
      return v;
    };

    const object = () => {
      node.value[loc] = _loc;
      return node.value;
    };

    const types = {
      boolean: wrappable(Boolean),
      number: wrappable(Number),
      string: wrappable(String),
      function: object,
      object,
    };

    return types[typeof node.value]();
  },
  [Kind.SEQ]: (node: YAMLSequence, input = "") => {
    const items = walk(node.items, input, []);

    items[loc] = getLoc(input, {
      start: node.startPosition,
      end: node.endPosition,
    });

    return items;
  },
};

const walk = (nodes: YAMLNode[] = [], input: string, ctx = {}) => {
  const onNode = (node: YAMLNode, ctx: {}, fallback) => {
    const visitor = visitors[node.kind];
    return visitor ? visitor(node, input, ctx) : fallback;
  };

  const walkObj = () =>
    nodes.reduce((sum, node) => {
      return onNode(node, sum, sum);
    }, ctx);

  const walkArr = () =>
    nodes.map((node) => onNode(node, ctx, null), ctx).filter(Boolean);

  return Array.isArray(ctx) ? walkArr() : walkObj();
};

export const parseToPseudoAst = (input: string) => walk([load(input)], input);
