import { Kind, YAMLNode, YNode } from "../../types";
import { WorkflowDocument } from "./parser";
import { NodeDesc } from "./schema";
import { Position } from "./types";

export interface CompletionOption {
  value: string;
  description?: string;
}

function inPos(position: Position, pos: number): boolean {
  return position[0] <= pos && pos <= position[1];
}

function findNode(node: YAMLNode, pos: number): YAMLNode {
  if (!inPos([node.startPosition, node.endPosition], pos)) {
    return null;
  }

  const n: YNode = node as YNode;
  switch (n.kind) {
    case Kind.MAP: {
      for (const mapping of n.mappings) {
        if (inPos([mapping.startPosition, mapping.endPosition], pos)) {
          return findNode(mapping, pos);
        }
      }

      break;
    }

    case Kind.MAPPING: {
      // If the position is within the value, return that, otherwise the mapping node
      const r = node.value && findNode(n.value, pos);
      if (r) {
        return r;
      }

      break;
    }

    case Kind.SEQ: {
      for (const item of n.items) {
        if (typeof item !== "object") {
          return n;
        }

        if (item === null) {
          // New item like `- |` is inserted
          return n;
        }

        if (inPos([item.startPosition, item.endPosition], pos)) {
          const itemNode = findNode(item, pos);
          if (itemNode.kind === Kind.SCALAR) {
            // If the child is a plain value, return the sequence node
            return n;
          }
        }
      }

      break;
    }

    case Kind.SCALAR: {
      return n;
    }

    default:
      throw new Error("unknown");
  }

  return node;
}

async function doComplete(
  node: YNode,
  desc: NodeDesc,
  input: string,
  pos: number,
  doc: WorkflowDocument
): Promise<CompletionOption[]> {
  if (!node) {
    console.error(desc);
    throw new Error("no node");
  }

  switch (desc.type) {
    case "value": {
      let p = pos;
      // TODO: We can't do that.. do it in the seq/map case?
      // TODO: urgs this is ugly.
      while (
        p >= 0 &&
        input[p] !== ":" &&
        input[p] !== "-" &&
        input[p] !== "[" &&
        input[p] !== ","
      ) {
        --p;
      }

      if (p < 0) {
        // Reset for array case
        p = pos;
      }

      const searchInput = input.substring(p + 1, pos + 1).trim();
      if (desc.allowedValues) {
        return desc.allowedValues.filter(
          (x) => !searchInput || x.value.startsWith(searchInput)
        );
      }
      break;
    }

    case "sequence":
      if (desc.itemDesc) {
        return doComplete(node, desc.itemDesc, input, pos, doc);
      }

      break;

    case "map":
      // Check what to complete
      if (node.kind === Kind.MAP) {
        // We should be in a mapping, try to find it
        while (input[pos] !== ":") {
          --pos;
        }

        const mapping = findNode(doc.workflowST, pos) as YNode;
        if (mapping.kind !== Kind.MAPPING) {
          throw new Error("Could not find key node for map");
        }

        const mapDesc = doc.nodeToDesc.get(mapping.parent);
        if (mapDesc.type !== "map") {
          throw new Error("Could not find map node");
        }

        const key = mapping.key.value;
        return doComplete(mapping, mapDesc.keys[key], input, pos, doc);
      }

      if (desc.keys) {
        const c: CompletionOption[] = [];
        for (const key of Object.keys(desc.keys)) {
          c.push({
            value: key,
            description: desc.keys[key].description,
          });
        }

        return c;
      }

      break;
  }
}

export async function complete(
  doc: WorkflowDocument,
  pos: number,
  input: string
): Promise<CompletionOption[]> {
  if (!doc.workflow) {
    return [];
  }

  if (!doc.workflowST || doc.workflowST.kind === Kind.SCALAR) {
    // Empty document, complete top level keys
    //
    // Note: Since this is Actions specific, no support for top-level
    // sequences.
    let inputKey: string = doc.workflowST?.value;

    const schema = doc.nodeToDesc.get(null);
    if (schema.type === "map" && schema.keys) {
      const completionOptions = Object.keys(schema.keys)
        .filter((x) => !inputKey || x.startsWith(inputKey))
        .map((key) => ({
          value: key,
          description: schema.keys[key].description,
        }));
      completionOptions.sort((a, b) => a.value.localeCompare(b.value));
      return completionOptions;
    }

    return [];
  }

  const node = findNode(doc.workflowST, pos) as YNode;
  const desc = doc.nodeToDesc.get(node);
  if (desc) {
    const completionOptions = await doComplete(node, desc, input, pos, doc);
    completionOptions.sort((a, b) => a.value.localeCompare(b.value));
    return completionOptions;
  }

  throw new Error("Could not find schema for node");
}
