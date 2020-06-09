import { NodeDesc, NodeDescMap } from "./schema";

export const events = ["push", "pull_request"];

const tagBranchPathFilters: NodeDescMap = {
  branches: {
    type: "sequence",
    customSuggester: () => ["default", "brancha", "branchb"],
  },
  "branches-ignore": {
    type: "sequence",
  },
};

function typeEventNode(types: string[]): { types: NodeDesc } {
  return {
    types: {
      type: "sequence",
      allowedValues: types,
    },
  };
}

export const eventMap: NodeDescMap = {
  public: {
    type: "map",
  },
  push: {
    type: "map",
    keys: {
      ...tagBranchPathFilters,
    },
  },
  pull_request: {
    type: "map",
    keys: {
      ...tagBranchPathFilters,
      ...typeEventNode([
        "assigned",
        "unassigned",
        "labeled",
        "unlabeled",
        "opened",
        "edited",
        "closed",
        "reopened",
        "synchronize",
        "ready_for_review",
        "locked",
        "unlocked",
        "review_requested",
        "review_request_removed",
      ]),
    },
  },
};

export const workflowSchema: NodeDesc = {
  type: "map",
  keys: {
    name: {
      type: "value",
      description: `Name of the workflow`,
    },
    on: {
      type: "oneOf",
      oneOf: [
        // Can be one of the events
        {
          type: "value",
          allowedValues: events,
        },
        // Can be an array of events
        {
          type: "sequence",
          allowedValues: events,
        },
        // Can be a map of events
        {
          type: "map",
          keys: eventMap,
        },
      ],
    },
    jobs: {
      type: "map",
      keys: {
        steps: {
          type: "sequence",
          itemDesc: {
            type: "map",
          },
        },
      },

      required: ["runs-on", "steps"],
    },
  },

  required: ["on", "jobs"],
};
