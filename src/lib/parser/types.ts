export type Position = [number, number];

export interface CompletionOption {
  /** Auto complete value */
  value: string;

  /** Optional description for this completion option */
  description?: string;
}

export interface Hover {
  /** Description for the hover, might be formatted with markdown */
  description: string;
}
