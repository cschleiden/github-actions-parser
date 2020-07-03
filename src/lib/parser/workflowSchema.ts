import { NodeDesc, NodeDescMap, ValueDesc, ValueNodeDesc } from "./schema";

export const events: ValueDesc[] = [
  {
    value: "push",
    description: "Whenever code is pushed",
  },
  {
    value: "pull_request",
  },
];

const tagBranchPathFilters: NodeDescMap = {
  branches: {
    type: "sequence",
    itemDesc: {
      type: "value",
      // TODO: Suggest branches from the repo?
    },
  },
  "branches-ignore": {
    type: "sequence",
    itemDesc: {
      type: "value",
      // TODO: Suggest branches from the repo?
    },
  },
};

function typeEventNode(types: ValueDesc[]): { types: NodeDesc } {
  return {
    types: {
      type: "sequence",
      itemDesc: {
        type: "value",
        allowedValues: types,
      },
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
        {
          value: "assigned",
          description: "Reviewer was assigned",
        },
        { value: "unassigned", description: "Reviewer was unassigned" },
        // "labeled",
        // "unlabeled",
        // "opened",
        // "edited",
        // "closed",
        // "reopened",
        // "synchronize",
        // "ready_for_review",
        // "locked",
        // "unlocked",
        // "review_requested",
        // "review_request_removed",
      ]),
    },
  },
};

const runsOn: ValueNodeDesc = {
  type: "value",
  allowedValues: [
    {
      value: "ubuntu-latest",
    },
    { value: "windows-latest" },
  ],
};

export const WorkflowSchema: NodeDesc = {
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
          itemDesc: {
            type: "value",
            allowedValues: events,
          },
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
      itemDesc: {
        type: "map",
        keys: {
          "runs-on": {
            type: "oneOf",
            oneOf: [
              runsOn,
              {
                type: "sequence",
                itemDesc: runsOn,
              },
            ],
          },
          steps: {
            type: "sequence",
            itemDesc: {
              type: "map",
              keys: {
                name: {
                  type: "value",
                },
                runs: {
                  type: "value",
                },
              },
            },
          },
        },

        required: ["runs-on", "steps"],
      },
    },
  },

  required: ["on", "jobs"],
};
