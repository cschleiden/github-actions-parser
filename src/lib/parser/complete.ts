import { YAMLNode } from "yaml-ast-parser";
import { CompletionOption, Kind, YNode } from "../../types";
import { completeExpression, inExpression } from "../expressions/completion";
import { ContextProvider } from "../expressions/types";
import { PropertyPath } from "../utils/path";
import { findNode, getPathFromNode } from "./ast";
import { parse, Workflow, WorkflowDocument } from "./parser";
import { MapNodeDesc, NodeDesc } from "./schema";

export interface ContextProviderFactory {
  get(workflow: Workflow, path: PropertyPath): Promise<ContextProvider>;
}

function filterAndSortCompletionOptions(
  partialInput: string,
  options: CompletionOption[],
  existingValues?: Set<string>
) {
  options = options
    .filter((x) => !existingValues || !existingValues.has(x.value))
    .filter((x) => !partialInput || x.value.startsWith(partialInput));
  options.sort((a, b) => a.value.localeCompare(b.value));
  return options;
}

async function completeMapKeys(
  doc: WorkflowDocument,
  node: YNode | null,
  mapDesc: MapNodeDesc,
  line: string,
  partialInput: string
): Promise<CompletionOption[]> {
  const existingKeys = new Set<string>(
    node?.mappings?.filter((x) => !!x.key).map((x) => x.key.value) || []
  );

  let options: CompletionOption[] = [];

  if ((mapDesc as NodeDesc).customValueProvider) {
    options.push(
      ...(await (mapDesc as NodeDesc).customValueProvider(
        mapDesc,
        doc.workflow,
        getPathFromNode(node)
      ))
    );
  }

  options.push(
    ...Object.keys(mapDesc.keys).map((key) => ({
      value: key,
      description: mapDesc.keys[key].description,
    }))
  );

  return filterAndSortCompletionOptions(partialInput, options, existingKeys);
}

async function doComplete(
  node: YNode,
  desc: NodeDesc,
  input: string,
  partialInput: string,
  pos: number,
  doc: WorkflowDocument,
  contextProviderFactory: ContextProviderFactory
): Promise<CompletionOption[]> {
  if (!node) {
    console.error(desc);
    throw new Error("no node");
  }

  // console.log(desc);

  switch (desc.type) {
    case "value": {
      let searchInput = node.value || "";
      searchInput = searchInput !== "dummy" ? searchInput : "";

      const parent = node.parent as YNode;

      // Are we in a sequence?
      let existingItems: YAMLNode[] = [];
      if (parent.kind === Kind.SEQ) {
        existingItems = parent.items;
      } else if (node.kind === Kind.SEQ) {
        // Is the current node a sequence? Could happen if we are trying to auto-complete and have an empty input
        existingItems = node.items;
      }
      const existingValues = new Set<string>(
        existingItems
          .filter((x) => !!x && x.kind === Kind.SCALAR)
          .map((x) => x.value)
      );

      // Does the value node has auto-complete information?
      if (desc.customValueProvider) {
        return filterAndSortCompletionOptions(
          searchInput,
          await desc.customValueProvider(
            desc,
            doc.workflow,
            getPathFromNode(node)
          ),
          new Set<string>(existingValues)
        );
      } else if (desc.allowedValues) {
        return filterAndSortCompletionOptions(
          searchInput,
          desc.allowedValues,
          existingValues
        );
      } else if (
        desc.isExpression ||
        inExpression(node.value, pos - node.startPosition)
      ) {
        return expressionComplete(
          node,
          pos,
          getPathFromNode(node),
          doc.workflow,
          contextProviderFactory,
          true
        );
      }

      break;
    }

    case "sequence": {
      if (desc.itemDesc) {
        return doComplete(
          node,
          desc.itemDesc,
          input,
          partialInput,
          pos,
          doc,
          contextProviderFactory
        );
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
            doc,
            contextProviderFactory
          );
        }
      }

      return completeMapKeys(doc, node, desc, input, partialInput);
    }

    case "oneOf": {
      const validTypes = getValidOneOfTypes(node, pos, input);

      const result = [];

      for (const one of desc.oneOf.filter((one) => validTypes.has(one.type))) {
        const c = await doComplete(
          node,
          one,
          input,
          partialInput,
          pos,
          doc,
          contextProviderFactory
        );
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
      const [line] = getCurrentLine(pos, input);
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

function getCurrentLine(pos: number, input: string): [string, number] {
  let s = pos;
  while (s > 0 && input[s] !== "\n") {
    --s;

    if (input[s] === "\n") {
      ++s;
      break;
    }
  }

  return [input.substring(s, pos + 1).trim(), pos - s];
}

async function expressionComplete(
  node: YNode,
  pos: number,
  path: PropertyPath,
  workflow: Workflow,
  contextProviderFactory: ContextProviderFactory,
  delimiterOptional = false
): Promise<CompletionOption[]> {
  const line = node.value;
  const linePos = pos - node.startPosition;

  const startPos = line.indexOf("${{");
  const endPos = line.indexOf("}}");
  if (
    delimiterOptional ||
    (startPos !== -1 &&
      startPos < linePos &&
      (endPos === -1 || endPos > linePos))
  ) {
    const expressionLine = line.replace(/\$\{\{(.*)(\}\})?/, "$1");
    const expressionPos = linePos - line.indexOf(expressionLine);

    const contextProvider = await contextProviderFactory.get(workflow, path);
    return completeExpression(expressionLine, expressionPos, contextProvider);
  }

  return [];
}

function _transform(input: string, pos: number): [string, number, string] {
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
      if (trimmedLine === "-" && !line.endsWith(" ")) {
        spacer = " ";
        pos++;
      }

      lines[posLine] =
        line + spacer + "dummy" + (trimmedLine === "-" ? "" : ":");

      // Adjust pos by one to prevent a sequence node being marked as active
      pos++;
    } else if (!trimmedLine.startsWith("-")) {
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
  input: string,
  pos: number,
  schema: NodeDesc,
  contextProviderFactory: ContextProviderFactory
): Promise<CompletionOption[]> {
  // Fix the input to work around YAML parsing issues
  const [newInput, newPos, partialInput] = _transform(input, pos);

  // Need to parse again with fixed text
  const doc = await parse(newInput, schema, contextProviderFactory);

  const node = findNode(doc.workflowST, newPos) as YNode;
  const desc = doc.nodeToDesc.get(node);
  if (desc) {
    // Complete using original position
    let completionOptions = await doComplete(
      node,
      desc,
      input,
      partialInput,
      newPos,
      doc,
      contextProviderFactory
    );
    completionOptions = completionOptions || [];
    completionOptions.sort((a, b) => a.value.localeCompare(b.value));
    return completionOptions;
  }

  // No desc found, check if we are in a scalar node with an expression?
  if (node.kind === Kind.SCALAR) {
    return expressionComplete(
      node,
      pos,
      getPathFromNode(node),
      doc.workflow,
      contextProviderFactory
    );
  }

  throw new Error("Could not find schema for node");
}
