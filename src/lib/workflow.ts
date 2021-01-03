import { IssueActivities, PullRequestActivities } from "./events/activities";

/** Generic map */
export type KeyValueMap = { [key: string]: string | number | boolean };

export interface OnTypes<T extends string> {
  types?: T[];
}

export interface OnBranches {
  branches?: string[];
  "branches-ignore"?: string[];
}

export interface OnTags {
  tags?: string[];
  "tags-ignore"?: string[];
}

export interface OnPaths {
  paths?: string[];
  "paths-ignore"?: string[];
}

export type On =
  | string
  | string[]
  | {
      issues?: null | OnTypes<IssueActivities>;
      push?: null | (OnBranches & OnPaths);
      pull_request?:
        | null
        | (OnBranches & OnTypes<PullRequestActivities> & OnPaths);
    };

export interface RunStep {
  run: string;

  "working-directory"?: string;

  shell?: any;
}

export type Expression = string;

export interface RemoteUses {
  type: "remote";
  owner: string;
  repository: string;
  ref: string;
  subdirectory?: string;
}

export interface DockerUses {
  type: "docker";
}

export interface LocalUses {
  type: "local";
}

export type Uses = RemoteUses | DockerUses | LocalUses;

export interface UsesStep {
  uses: Uses;
}

export type Step = {
  id?: string;

  /** Skips this step if evaluates to falsy */
  if?: Expression;

  /** Optional custom name for a step */
  name?: string | Expression;

  with?: KeyValueMap;

  env?: EnvMap;

  "continue-on-error"?: boolean;

  "timeout-minutes"?: number;
} & (RunStep | UsesStep);

export interface Defaults {
  shell?: string;

  "working-directory"?: string;
}

export interface Container {
  image: string;

  env: EnvMap;

  ports?: number[];

  volumes?: string[];

  options: string;
}

export interface Job {
  name?: string;

  needs?: string[];

  "runs-on": string[];

  outputs?: { [outputId: string]: string };

  env?: EnvMap;

  defaults?: Defaults;

  if?: Expression;

  steps: Step[];

  "timeout-minutes"?: number;

  strategy?: Strategy;

  "continue-on-error"?: boolean;

  container?: Container;

  services?: { [id: string]: Container };
}

export type MatrixValues = string[] | number[];

export interface Strategy {
  matrix: { [key: string]: MatrixValues };

  "fail-fast"?: boolean;

  "max-parallel"?: number;
}

export type EnvMap = KeyValueMap;

export type JobMap = { [jobId: string]: Job };

/**
 * A normalized workflow
 *
 * For example, `on` can be represented via a scalar, a sequence, or a map in YAML. This
 * workflow type is normalized so `on` is always a map of event_type to it's options.
 */
export interface Workflow {
  name?: string;

  on: {
    workflow_dispatch?: {
      inputs?: {
        [inputName: string]: {
          required?: boolean;
          description?: string;
          default?: string;
        };
      };
    };

    [eventName: string]: {};
  };

  jobs: JobMap;
}
