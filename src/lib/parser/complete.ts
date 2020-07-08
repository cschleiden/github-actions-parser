import { Kind, YAMLNode, YNode } from "../../types";
import { parse, WorkflowDocument } from "./parser";
import { MapNodeDesc, NodeDesc } from "./schema";
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

      // TODO: What to do here..
      if (node.key) {
        if (
          inPos([n.key.startPosition, n.key.endPosition], pos) ||
          node.key.value === "dummy"
        ) {
          return node.parent;
        }
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

async function completeMapKeys(
  node: YNode | null,
  mapDesc: MapNodeDesc,
  line: string,
  partialInput: string
): Promise<CompletionOption[]> {
  const existingKeys = new Set(
    node?.mappings?.filter((x) => !!x.key).map((x) => x.key.value) || []
  );

  const completionOptions = Object.keys(mapDesc.keys)
    .filter((x) => !existingKeys.has(x))
    .filter((x) => !partialInput || x.startsWith(partialInput))
    .map((key) => ({
      value: key,
      description: mapDesc.keys[key].description,
    }));
  completionOptions.sort((a, b) => a.value.localeCompare(b.value));
  return completionOptions;
}

async function doComplete(
  node: YNode,
  desc: NodeDesc,
  input: string,
  partialInput: string,
  pos: number,
  doc: WorkflowDocument
): Promise<CompletionOption[]> {
  if (!node) {
    console.error(desc);
    throw new Error("no node");
  }

  // console.log(desc);

  switch (desc.type) {
    case "value": {
      let p = pos;
      // TODO: We can't do that.. do it in the seq/map case?
      // TODO: urgs this is ugly. maybe get the line first? Would prevent this from running across the whole
      // document
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
      // console.log("searchInput", searchInput);

      // Are there any existing items?
      let existingValues: string[] | undefined;
      if (node.kind === Kind.SEQ) {
        existingValues = node.items
          .filter((x) => !!x && x.kind === Kind.SCALAR)
          .map((x) => x.value);
      }

      if (desc.customSuggester) {
        return desc.customSuggester(desc, searchInput, existingValues);
      }

      if (desc.allowedValues) {
        return desc.allowedValues
          .filter((x) => !searchInput || x.value.startsWith(searchInput))
          .filter(
            (x) => !existingValues || existingValues.indexOf(x.value) === -1
          );
      }
      break;
    }

    case "sequence": {
      if (desc.itemDesc) {
        return doComplete(node, desc.itemDesc, input, partialInput, pos, doc);
      }

      break;
    }

    case "map": {
      // Check what to complete
      if (node.kind === Kind.MAP) {
        // We should be in a mapping, try to find it
        const mapping = findNode(doc.workflowST, pos) as YNode;
        if (mapping.kind === Kind.MAPPING) {
          const mapDesc = doc.nodeToDesc.get(mapping.parent);
          if (mapDesc.type !== "map") {
            throw new Error("Could not find map node");
          }

          const key = mapping.key.value;
          return doComplete(
            mapping,
            mapDesc.keys[key],
            input,
            partialInput,
            pos,
            doc
          );
        }
      }

      return completeMapKeys(node, desc, input, partialInput);
    }

    case "oneOf": {
      // Generate
      const validTypes = getValidOneOfTypes(node, pos, input);

      const result = [];

      for (const one of desc.oneOf.filter((one) => validTypes.has(one.type))) {
        const c = await doComplete(node, one, input, partialInput, pos, doc);
        result.push(...c);
      }

      return result;
    }
  }

  throw new Error(`Unknown node desc ${desc.type}`);
}

function getValidOneOfTypes(node: YNode, pos: number, input: string) {
  const validTypes = new Set<NodeDesc["type"]>();

  switch (node.kind) {
    case Kind.SCALAR: {
      validTypes.add("value");
      break;
    }

    // case Kind.MAP:
    //   break;

    case Kind.MAPPING: {
      const line = getCurrentLine(pos, input);
      if (line.indexOf(":") >= 0) {
        validTypes.add("value");
      }
      break;
    }

    case Kind.SEQ: {
      validTypes.add("sequence");
      break;
    }
  }

  return validTypes;
}

function getCurrentLine(pos: number, input: string) {
  let s = pos;
  while (s > 0 && input[s] !== "\n") {
    --s;

    if (input[s] === "\n") {
      ++s;
      break;
    }
  }

  return input.substring(s, pos + 1).trim();
}

export function _transform(
  input: string,
  pos: number
): [string, number, string] {
  // TODO: Optimize this...
  const lines = input.split("\n");
  const posLine = input
    .substring(0, pos)
    .split("")
    .filter((x) => x === "\n").length;

  const line = lines[posLine];
  let partialInput = line.trim();

  const colon = line.indexOf(":");
  if (colon === -1) {
    const trimmedLine = line.trim();
    if (trimmedLine === "" || trimmedLine === "-") {
      // Node in sequence or empty line
      let spacer = "";
      if (trimmedLine === "-" && !trimmedLine.endsWith(" ")) {
        spacer = " ";
      }

      lines[posLine] = line + spacer + "dummy:";

      // Adjust pos by one to prevent a sequence node being marked as active
      pos = pos + 1;
    } else {
      // Add `:` to end of line
      lines[posLine] = line + ":";
    }

    if (trimmedLine.startsWith("-")) {
      partialInput = trimmedLine.substring(trimmedLine.indexOf("-") + 1).trim();
    }
  } else {
    partialInput = (pos > colon
      ? line.substring(colon + 1)
      : line.substring(0, colon)
    ).trim();
    pos = pos - 1;
  }

  // console.log(`partialInput '${partialInput}'`);
  return [lines.join("\n"), pos, partialInput];
}

export async function complete(
  doc: WorkflowDocument,
  pos: number,
  input: string
): Promise<CompletionOption[]> {
  if (!doc.workflow) {
    return [];
  }

  // Need to parse again with fixed text
  const [newInput, newPos, partialInput] = _transform(input, pos);
  const newDoc = parse(newInput, doc.schema);

  const node = findNode(newDoc.workflowST, newPos) as YNode;
  const desc = newDoc.nodeToDesc.get(node);
  if (desc) {
    // Complete using original position
    let completionOptions = await doComplete(
      node,
      desc,
      input,
      partialInput,
      newPos,
      newDoc
    );
    completionOptions = completionOptions || [];
    completionOptions.sort((a, b) => a.value.localeCompare(b.value));
    return completionOptions;
  }

  throw new Error("Could not find schema for node");
}
