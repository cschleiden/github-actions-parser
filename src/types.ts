import { Octokit } from "@octokit/rest";

//
// Custom types
//

export interface Context {
  /** Octokit client to use for dynamic auto completion */
  client: Octokit;

  /** Repository owner */
  owner: string;

  /** Repository name */
  repository: string;

  /** Is the repository owned by an organization? */
  ownerIsOrg?: boolean;

  /**
   * Are org features enabled, i.e., is the client authenticated for making org calls, which
   * means does it have the admin:org scope
   */
  orgFeaturesEnabled?: boolean;

  /**
   * Dynamic auto-completion/validations are cached for a certain time to speed up successive
   * operations.
   *
   * Setting this to a low number will greatly increase the number of API calls and duration
   * parsing/validation/auto-completion will take.
   *
   * @default 10 * 60 * 1000 = 10 minutes
   **/
  timeToCacheResponsesInMS?: number;
}

export type Position = [number, number];

export interface CompletionOption {
  /** Auto complete value */
  value: string;

  /** Optional description for this completion option */
  description?: string;
}

export enum DiagnosticKind {
  Error,
  Warning,
  Information,
}

export interface Diagnostic {
  /** Defaults to error */
  kind?: DiagnosticKind;

  message: string;

  pos: Position;
}

export interface Hover {
  /** Description for the hover, might be formatted with markdown */
  description: string;
}
