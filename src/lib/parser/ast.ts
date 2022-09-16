import YAML from "yaml";
import { Position } from "../../types";

import { PropertyPath } from "../utils/path";

export const DUMMY_KEY = "dummy";

export function inPos(position: Position, pos: number): boolean {
  return position[0] <= pos && pos <= position[1];
}

YAML.Document;

export function findNode(node: YAML.Node, pos: number): YAML.Node | null {
  let result: YAML.Node | null = null;

  YAML.visit(node, () => {});

  return result;
}

export function getPathFromNode(node: YAML.Node | null): PropertyPath {
  // Build up node path
  const nodePath: YAML.Node[] = [];
  let x = node;
  while (x) {
    // Add in reverse
    nodePath.unshift(x);
    x = x.parent as YNode;
  }

  const path: PropertyPath = ["$"];
  while (nodePath.length) {
    const x = nodePath.shift();

    switch (x?.kind) {
      case Kind.MAPPING:
        if (x.key) {
          path.push(x.key.value);
        }

        if (x.value) {
          nodePath.unshift(x.value as YNode);
        }
        break;

      case Kind.SEQ:
        // Check next node to determine index
        if (nodePath.length && x.items) {
          const idx = x.items.indexOf(nodePath[0]);
          if (idx !== -1) {
            // Previous entry has to be a property. Note: this might be problematic with nested sequences,
            // but that's not currently supported.
            const propertyName: string = path[path.length - 1] as string;
            path[path.length - 1] = [propertyName, idx];
          }
        }
        break;
    }
  }

  return path;
}
