import { Context } from "../../../types";
import { WorkflowCodeAction } from "../../parser/schema";

export const codeActionResolvers: {
  [kind: string]: (
    context: Context,
    codeAction: WorkflowCodeAction
  ) => Promise<WorkflowCodeAction | undefined>;
} = {};

export async function resolveCodeAction(
  context: Context,
  codeAction: WorkflowCodeAction
): Promise<WorkflowCodeAction | undefined> {
  if (codeActionResolvers[codeAction.data.kind]) {
    return codeActionResolvers[codeAction.data.kind](context, codeAction);
  }

  return undefined;
}
