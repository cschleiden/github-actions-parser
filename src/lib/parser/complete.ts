import YAML from "yaml";
import { CompletionOption } from "../../types";
import { completeExpression, inExpression } from "../expressions/completion";
import { expressionMarker, iterateExpressions } from "../expressions/embedding";
import { DUMMY_KEY, findNode, getPathFromNode } from "./ast";
import { parse, WorkflowDocument } from "./parser";
import { CustomValue, MapNodeDesc, NodeDesc } from "./schema";

import { ContextProvider } from "../expressions/types";
import { PropertyPath } from "../utils/path";
import { Workflow } from "../workflow";

export interface ContextProviderFactory {
  get(
    workflow: Workflow | undefined,
    path: PropertyPath
  ): Promise<ContextProvider>;
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
  node: YAML.Node | null,
  mapDesc: MapNodeDesc,
  line: string,
  partialInput: string
): Promise<CompletionOption[]> {
  const existingKeys = new Set<string>(
    node?.mappings?.filter((x) => !!x.key).map((x) => x.key.value) || []
  );

  let options: CompletionOption[] = [];

  if (mapDesc.customValueProvider) {
    try {
      const customValues = await mapDesc.customValueProvider(
        mapDesc,
        doc.workflow,
        getPathFromNode(doc, node)
      );
      if (customValues) {
        options.push(...customValues);
      }
    } catch (e) {
      // Log, but ignore custom values in case of error
      console.error(e);
    }
  }

  if (mapDesc.keys) {
    options.push(
      ...Object.keys(mapDesc.keys).map((key) => ({
        value: key,
        description: mapDesc.keys![key].description,
      }))
    );
  }

  return filterAndSortCompletionOptions(partialInput, options, existingKeys);
}

async function doComplete(
  node: YAML.Node,
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
      searchInput = searchInput !== DUMMY_KEY ? searchInput : "";

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
        let customValues: CustomValue[] | undefined;

        try {
          customValues = await desc.customValueProvider(
            desc,
            doc.workflow,
            getPathFromNode(node)
          );
        } catch (e) {
          // Log, but ignore custom values in case of error
          console.error(e);
        }

        return filterAndSortCompletionOptions(
          searchInput,
          customValues || [],
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
          doc.workflow!,
          contextProviderFactory,
          desc.isExpression
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
          const mapDesc = doc.nodeToDesc.get(mapping.parent) as MapNodeDesc;
          if (mapDesc.type !== "map") {
            throw new Error("Could not find map node");
          }

          const key = mapping.key.value;
          return doComplete(
            mapping,
            mapDesc.keys![key],
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

      const result: CompletionOption[] = [];

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

function getCurrentLine(
  pos: number,
  input: string,
  trim = true
): [string, number] {
  let s = pos;
  while (s > 0 && input[s] !== "\n") {
    --s;

    if (input[s] === "\n") {
      ++s;
      break;
    }
  }

  const line = input.substring(s, pos + 1);
  return [trim ? line.trim() : line, pos - s];
}

async function expressionComplete(
  node: YNode,
  pos: number,
  path: PropertyPath,
  workflow: Workflow,
  contextProviderFactory: ContextProviderFactory,
  isExpression = false
): Promise<CompletionOption[]> {
  const input = `${node.value}`;
  const inputPos = pos - node.startPosition;

  // Determine expression
  let expression = input;
  let expressionPos = inputPos;
  if (!isExpression) {
    let expressionFound = false;
    iterateExpressions(input, (exp, start, length) => {
      if (start <= inputPos && inputPos <= start + length) {
        expressionFound = true;
        expression = exp;
        expressionPos = inputPos - start;
      }
    });

    // Check for partial expression
    if (!expressionFound) {
      const startPos = input.indexOf("${{");
      if (startPos === -1) {
        return [];
      }

      expression = input.substr(startPos + 3);
      expressionPos = inputPos - startPos - 3;
    }
  }

  expression = expression.replace(expressionMarker, "$1");

  const contextProvider = await contextProviderFactory.get(workflow, path);
  return completeExpression(expression, expressionPos, contextProvider);
}

function _transform(input: string, pos: number): [string, number, string] {
  // TODO: Optimize this...
  const lines = input.split("\n");
  const lineNo = input
    .substring(0, pos)
    .split("")
    .filter((x) => x === "\n").length;
  const linePos =
    pos - lines.slice(0, lineNo).reduce((p, l) => p + l.length + 1, 0);
  const line = lines[lineNo];

  let partialInput = line.trim();
  // Special case for Actions, if this line contains an expression marker, do _not_ transform. This is
  // an ugly fix for auto-completion in multi-line YAML strings. At this point in the process, we cannot
  // determine if a line is in such a multi-line string.
  if (partialInput.indexOf("${{") === -1) {
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

        lines[lineNo] =
          line.substring(0, linePos) +
          spacer +
          DUMMY_KEY +
          (trimmedLine === "-" ? "" : ":") +
          line.substring(linePos);

        // Adjust pos by one to prevent a sequence node being marked as active
        pos++;
      } else if (!trimmedLine.startsWith("-")) {
        // Add `:` to end of line
        lines[lineNo] = line + ":";
      }

      if (trimmedLine.startsWith("-")) {
        partialInput = trimmedLine
          .substring(trimmedLine.indexOf("-") + 1)
          .trim();
      }
    } else {
      partialInput = (
        pos > colon ? line.substring(colon + 1) : line.substring(0, colon)
      ).trim();
      pos = pos - 1;
    }
  }
  // console.log(`partialInput '${partialInput}'`);
  return [lines.join("\n"), pos, partialInput];
}

export async function complete(
  filename: string,
  input: string,
  pos: number,
  schema: NodeDesc,
  contextProviderFactory: ContextProviderFactory
): Promise<CompletionOption[]> {
  // Fix the input to work around YAML parsing issues
  const [newInput, newPos, partialInput] = _transform(input, pos);

  // Parse with fixed text
  const doc = await parse(filename, newInput, schema, contextProviderFactory);
  if (!doc.workflow) {
    return [];
  }

  const node = findNode(doc.workflowST, newPos) as YNode;
  const desc = doc.nodeToDesc.get(node);
  if (desc) {
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
