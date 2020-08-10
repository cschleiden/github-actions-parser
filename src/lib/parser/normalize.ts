import { Job, Workflow } from "../workflow";

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

  // Jobs
  if (!workflow.jobs) {
    workflow.jobs = {};
  }

  for (const jobId of Object.keys(workflow.jobs)) {
    normalizeJob(workflow.jobs[jobId]);
  }
}

function normalizeJob(job: Job) {
  if (!Array.isArray(job.steps)) {
    job.steps = [];
  }

  for (const step of job.steps) {
    if ("uses" in step && typeof step.uses === "string") {
    }
  }
}

function parseUses(uses: string) {}
