import { Octokit } from "@octokit/rest";
import { CompletionOption, Hover } from "../../types";
import { complete as genericComplete } from "../parser/complete";
import { hover as genericHover } from "../parser/hover";
import { parse as genericParse, WorkflowDocument } from "../parser/parser";
import {
  MapNodeDesc,
  NodeDesc,
  NodeDescMap,
  ValueDesc,
} from "../parser/schema";
import { mergeDeep } from "../utils/deepMerge";
import { _getContextProviderFactory } from "./contextCompletion";

const value = (description?: string): NodeDesc => ({
  type: "value",
  description,
});

const _events: [string, string, ([string, string] | string)[]][] = [
  [
    "check_run",
    "Runs your workflow anytime the check_run event occurs. More than one activity type triggers this event. For information about the REST API, see https://developer.github.com/v3/checks/runs.",
    ["created", "rerequested", "completed", "requested_action"],
  ],
  [
    "check_suite",
    "Runs your workflow anytime the check_suite event occurs. More than one activity type triggers this event. For information about the REST API, see https://developer.github.com/v3/checks/suites/.",
    ["completed", "requested", "rerequested"],
  ],
  [
    "create",
    "Runs your workflow anytime someone creates a branch or tag, which triggers the create event. For information about the REST API, see https://developer.github.com/v3/git/refs/#create-a-reference.",
    [],
  ],
  [
    "delete",
    "Runs your workflow anytime someone deletes a branch or tag, which triggers the delete event. For information about the REST API, see https://developer.github.com/v3/git/refs/#delete-a-reference.",
    [],
  ],
  [
    "deployment",
    "Runs your workflow anytime someone creates a deployment, which triggers the deployment event. Deployments created with a commit SHA may not have a Git ref. For information about the REST API, see https://developer.github.com/v3/repos/deployments/.",
    [],
  ],
  [
    "deployment_status",
    "Runs your workflow anytime a third party provides a deployment status, which triggers the deployment_status event. Deployments created with a commit SHA may not have a Git ref. For information about the REST API, see https://developer.github.com/v3/repos/deployments/#create-a-deployment-status.",
    [],
  ],
  [
    "fork",
    "Runs your workflow anytime when someone forks a repository, which triggers the fork event. For information about the REST API, see https://developer.github.com/v3/repos/forks/#create-a-fork.",
    [],
  ],
  [
    "gollum",
    "Runs your workflow when someone creates or updates a Wiki page, which triggers the gollum event.",
    [],
  ],
  [
    "issue_comment",
    "Runs your workflow anytime the issue_comment event occurs. More than one activity type triggers this event. For information about the REST API, see https://developer.github.com/v3/issues/comments/.",
    [],
  ],
  [
    "issues",
    "Runs your workflow anytime the issues event occurs. More than one activity type triggers this event. For information about the REST API, see https://developer.github.com/v3/issues.",
    [
      ["opened", ""],
      ["edited", ""],
      ["deleted", ""],
      ["transferred", ""],
      ["pinned", ""],
      ["unpinned", ""],
      ["closed", ""],
      ["reopened", ""],
      ["assigned", ""],
      ["unassigned", ""],
      ["labeled", ""],
      ["unlabeled", ""],
      ["locked", ""],
      ["unlocked", ""],
      ["milestoned", ""],
      ["demilestoned", ""],
    ],
  ],
  [
    "label",
    "Runs your workflow anytime the label event occurs. More than one activity type triggers this event. For information about the REST API, see https://developer.github.com/v3/issues/labels/.",
    ["created", "edited", "deleted"],
  ],
  [
    "member",
    "Runs your workflow anytime the member event occurs. More than one activity type triggers this event. For information about the REST API, see https://developer.github.com/v3/repos/collaborators/.",
    ["added", "edited", "deleted"],
  ],
  [
    "milestone",
    "Runs your workflow anytime the milestone event occurs. More than one activity type triggers this event. For information about the REST API, see https://developer.github.com/v3/issues/milestones/.",
    ["created", "closed", "opened", "edited", "deleted"],
  ],
  [
    "page_build",
    "Runs your workflow anytime someone pushes to a GitHub Pages-enabled branch, which triggers the page_build event. For information about the REST API, see https://developer.github.com/v3/repos/pages/.",
    [],
  ],
  [
    "project",
    "Runs your workflow anytime the project event occurs. More than one activity type triggers this event. For information about the REST API, see https://developer.github.com/v3/projects/.",
    ["created", "updated", "closed", "reopened", "edited", "deleted"],
  ],
  [
    "project_card",
    "Runs your workflow anytime the project_card event occurs. More than one activity type triggers this event. For information about the REST API, see https://developer.github.com/v3/projects/cards.",
    ["created", "moved", "converted", "edited", "deleted"],
  ],
  [
    "project_column",
    "Runs your workflow anytime the project_column event occurs. More than one activity type triggers this event. For information about the REST API, see https://developer.github.com/v3/projects/columns.",
    ["created", "updated", "moved", "deleted"],
  ],
  [
    "public",
    "Runs your workflow anytime someone makes a private repository public, which triggers the public event. For information about the REST API, see https://developer.github.com/v3/repos/#edit.",
    [],
  ],
  [
    "pull_request",
    "Runs your workflow anytime the pull_request event occurs. More than one activity type triggers this event. For information about the REST API, see https://developer.github.com/v3/pulls.\nNote: Workflows do not run on private base repositories when you open a pull request from a forked repository.\nWhen you create a pull request from a forked repository to the base repository, GitHub sends the pull_request event to the base repository and no pull request events occur on the forked repository.\nWorkflows don't run on forked repositories by default. You must enable GitHub Actions in the Actions tab of the forked repository.\nThe permissions for the GITHUB_TOKEN in forked repositories is read-only. For more information about the GITHUB_TOKEN, see https://help.github.com/en/articles/virtual-environments-for-github-actions.",
    [
      ["assigned", ""],
      ["unassigned", ""],
      ["labeled", ""],
      ["unlabeled", ""],
      ["opened", ""],
      ["edited", ""],
      ["closed", ""],
      ["reopened", ""],
      ["synchronize", ""],
      ["ready_for_review", ""],
      ["locked", ""],
      ["unlocked", ""],
      ["review_requested", ""],
      ["review_request_removed", ""],
    ],
  ],
  [
    "pull_request_review",
    "Runs your workflow anytime the pull_request_review event occurs. More than one activity type triggers this event. For information about the REST API, see https://developer.github.com/v3/pulls/reviews.\nNote: Workflows do not run on private base repositories when you open a pull request from a forked repository.\nWhen you create a pull request from a forked repository to the base repository, GitHub sends the pull_request event to the base repository and no pull request events occur on the forked repository.\nWorkflows don't run on forked repositories by default. You must enable GitHub Actions in the Actions tab of the forked repository.\nThe permissions for the GITHUB_TOKEN in forked repositories is read-only. For more information about the GITHUB_TOKEN, see https://help.github.com/en/articles/virtual-environments-for-github-actions.",
    ["submitted", "edited", "dismissed"],
  ],
  [
    "pull_request_review_comment",
    "Runs your workflow anytime a comment on a pull request's unified diff is modified, which triggers the pull_request_review_comment event. More than one activity type triggers this event. For information about the REST API, see https://developer.github.com/v3/pulls/comments.\nNote: Workflows do not run on private base repositories when you open a pull request from a forked repository.\nWhen you create a pull request from a forked repository to the base repository, GitHub sends the pull_request event to the base repository and no pull request events occur on the forked repository.\nWorkflows don't run on forked repositories by default. You must enable GitHub Actions in the Actions tab of the forked repository.\nThe permissions for the GITHUB_TOKEN in forked repositories is read-only. For more information about the GITHUB_TOKEN, see https://help.github.com/en/articles/virtual-environments-for-github-actions.",
    ["created", "edited", "deleted"],
  ],
  [
    "push",
    "Runs your workflow when someone pushes to a repository branch, which triggers the push event.\nNote: The webhook payload available to GitHub Actions does not include the added, removed, and modified attributes in the commit object. You can retrieve the full commit object using the REST API. For more information, see https://developer.github.com/v3/repos/commits/#get-a-single-commit.",
    [],
  ],
  ["registry_package", "", []],
  [
    "release",
    "Runs your workflow anytime the release event occurs. More than one activity type triggers this event. For information about the REST API, see https://developer.github.com/v3/repos/releases/.",
    ["published", "unpublished", "created", "edited", "deleted", "prereleased"],
  ],
  ["repository_dispatch", "", []],
  [
    "schedule",
    "You can schedule a workflow to run at specific UTC times using POSIX cron syntax (https://pubs.opengroup.org/onlinepubs/9699919799/utilities/crontab.html#tag_20_25_07). Scheduled workflows run on the latest commit on the default or base branch. The shortest interval you can run scheduled workflows is once every 5 minutes.\nNote: GitHub Actions does not support the non-standard syntax @yearly, @monthly, @weekly, @daily, @hourly, and @reboot.\nYou can use crontab guru (https://crontab.guru/). to help generate your cron syntax and confirm what time it will run. To help you get started, there is also a list of crontab guru examples (https://crontab.guru/examples.html).",
    [],
  ],
  [
    "status",
    "Runs your workflow anytime the status of a Git commit changes, which triggers the status event. For information about the REST API, see https://developer.github.com/v3/repos/statuses/.",
    [],
  ],
  [
    "watch",
    "Runs your workflow anytime the watch event occurs. More than one activity type triggers this event. For information about the REST API, see https://developer.github.com/v3/activity/starring/.",
    [],
  ],
  ["workflow_dispatch", "", []],
];

export const events: ValueDesc[] = _events.map(([value, description]) => ({
  value,
  description,
}));

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
  tags: {
    type: "sequence",
    itemDesc: {
      type: "value",
      // TODO: Suggest tags from the repo?
    },
  },
  "tags-ignore": {
    type: "sequence",
    itemDesc: {
      type: "value",
      // TODO: Suggest tags from the repo?
    },
  },
  paths: {
    type: "sequence",
    itemDesc: {
      type: "value",
    },
  },
  "paths-ignore": {
    type: "sequence",
    itemDesc: {
      type: "value",
    },
  },
};

export const eventMap: NodeDescMap = mergeDeep(
  {},
  // Add all events to map
  _events.reduce(
    (map, [event, description, types]) => ({
      ...map,
      [event]: {
        type: "map",
        description: description,
        keys:
          (types.length > 0 && {
            types: {
              type: "sequence",
              itemDesc: {
                type: "value",
                allowedValues: types.map((type) => ({
                  value: Array.isArray(type) ? type[0] : type,
                  description: Array.isArray(type) ? type[1] : undefined,
                })),
              },
            },
          }) ||
          undefined,
      },
    }),
    {}
  ),
  // Override specific ones with special properties
  {
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
      },
    },
    schedule: {
      type: "map",
      keys: {
        cron: {
          type: "value",
          // TODO: Validate cron
          customValidator: (node, x) => {},
        },
      },
    },
    workflow_dispatch: {
      type: "map",
      description: "Event that can be manually triggered",
      keys: {
        inputs: {
          type: "map",
          itemDesc: {
            type: "map",
            keys: {
              required: {
                type: "value",
              },
              description: {
                type: "value",
              },
              default: {
                type: "value",
              },
            },
          },
        },
      },
    },
  }
);

const env: MapNodeDesc = {
  type: "map",
  itemDesc: {
    type: "value",
  },
};

const runsOn = (context: Context): NodeDesc => ({
  type: "value",
  description:
    "The type of machine to run the job on. The machine can be either a GitHub-hosted runner, or a self-hosted runner.",

  customSuggester: async (_, input, existingItems) => {
    return [
      { value: "ubuntu-latest" },
      { value: "windows-latest" },
      { value: "macos-latest" },
      { value: "self-hosted" },
    ];
  },
});

export interface Context {
  /** Octokit client to use for dynamic auto completion */
  client: Octokit;

  /** Repository owner */
  owner: string;

  /** Repository name */
  repository: string;

  /** Is the repository owned by an organization? */
  ownerIsOrg?: boolean;
}

export function _getSchema(context: Context): NodeDesc {
  return {
    type: "map",
    keys: {
      name: {
        type: "value",
        description: `Name of the workflow`,
      },
      env,
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
            env,
            if: {
              type: "value",
              isExpression: true,
            },
            "runs-on": {
              type: "oneOf",
              oneOf: [
                runsOn(context),
                {
                  type: "sequence",
                  itemDesc: runsOn(context),
                },
              ],
            },
            steps: {
              type: "sequence",
              itemDesc: {
                type: "map",
                keys: {
                  id: value(
                    "A unique identifier for the step. You can use the id to reference the step in contexts. For more information, see https://help.github.com/en/articles/contexts-and-expression-syntax-for-github-actions."
                  ),
                  if: {
                    type: "value",
                    isExpression: true,
                  },
                  name: value(),
                  uses: value(),
                  run: value(),
                  "working-directory": value(),
                  shell: value(),
                  with: {
                    type: "map",
                  },
                  env,
                  "continue-on-error": value(),
                  "timeout-minutes": value(),
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
}

export async function parse(
  context: Context,
  input: string
): Promise<WorkflowDocument> {
  return genericParse(
    input,
    _getSchema(context),
    _getContextProviderFactory(context)
  );
}

export async function complete(
  context: Context,
  input: string,
  pos: number
): Promise<CompletionOption[]> {
  return genericComplete(
    input,
    pos,
    _getSchema(context),
    _getContextProviderFactory(context)
  );
}

export async function hover(
  context: Context,
  input: string,
  pos: number
): Promise<Hover | undefined> {
  return genericHover(
    input,
    pos,
    _getSchema(context),
    _getContextProviderFactory(context)
  );
}
