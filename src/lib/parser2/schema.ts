export type NodeDescMap = { [key: string]: NodeDesc };

type OneOfNodeDesc = {
  type: "oneOf";

  oneOf: NodeDesc[];
};

type MapNodeDesc = {
  type: "map";

  /**
   * Map of key to Node or Node array.
   */
  keys?: { [key: string]: NodeDesc };

  required?: string[];
};

type SequenceNodeDesc = {
  type: "sequence";

  allowedValues?: string[];

  itemDesc?: NodeDesc;
};

type AllowedValue = {
  value: string;
  description?: string;
};

type ValueNodeDesc = {
  type: "value";

  /** Allowed values */
  allowedValues?: AllowedValue[];
};

export type NodeDesc = (
  | ValueNodeDesc
  | SequenceNodeDesc
  | MapNodeDesc
  | OneOfNodeDesc
) & {
  /** Description for this node, can contain markdown */
  description?: string;

  customSuggester?: (node: Node, input?: string) => string[];
  customValidator?: (
    node: Node,
    reportError: (message: string) => void
  ) => void;
};

// export function suggestValue(
//   node: Node,
//   desc: NodeDesc,
//   input?: string
// ): string[] {
//   if (desc.customSuggester) {
//     return desc.customSuggester(node, input);
//   }

//   switch (desc.type) {
//     case "sequence": {
//       if (desc.type !== node.type) {
//         throw new Error();
//       }

//       if (desc.allowedValues) {
//         const existingItems = new Set(node.items?.map(x => x.value) || []);
//         return desc.allowedValues.filter(x => !existingItems.has(x)).filter((x) => (!input || x.startsWith(input)) && );
//       }

//       return [];
//     }

//     case "map": {
//       // Delegate to node if oneof?
//     }
//   }
// }
