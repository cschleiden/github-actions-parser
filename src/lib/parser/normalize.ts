import { Workflow } from "../workflow";

export function normalizeWorkflow(filename: string, workflow: Workflow) {
  // Name
  workflow.name = workflow.name || filename;

  // On
  if (typeof workflow.on === "string") {
    workflow.on = {
      [workflow.on]: {},
    };
  } else if (Array.isArray(workflow.on)) {
    workflow.on = workflow.on.reduce((o, x) => {
      o[x] = {};
      return o;
    }, {});
  }
}
