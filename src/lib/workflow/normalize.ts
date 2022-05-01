import { DUMMY_KEY } from "../parser/ast";
import { Expression, Job, MatrixInvocations, Workflow } from "../workflow";
import { parseUses } from "./uses";

function toArray(input: string | string[]): string[] {
  if (Array.isArray(input)) {
    return input;
  }

  return [input];
}

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

  for (const jobId of Object.keys(workflow.jobs).filter(
    (x) => x !== DUMMY_KEY
  )) {
    normalizeJob(workflow.jobs[jobId]);
  }
}

function normalizeJob(job: Job) {
  // Strategy
  if (job.strategy?.matrix) {
    // TODO: Should switch to build up the workflow using the AST instead of parsing and transforming in place
    job.strategy.matrix = normalizeMatrix(job.strategy.matrix as any);
  }

  // Steps
  if (!Array.isArray(job.steps)) {
    job.steps = [];
  }

  job.steps = job.steps.filter((x) => typeof x === "object");

  for (const step of job.steps) {
    // Uses
    if (step && "uses" in step && typeof step.uses === "string") {
      step.uses = parseUses(step.uses);
    }
  }

  // Other properties
  job.needs = job.needs && toArray(job.needs);
  job["timeout-minutes"] = job["timeout-minutes"] || 360;
}

export function normalizeMatrix(
  matrix:
    | {
        // @ts-ignore
        include?: Object[];
        // @ts-ignore
        exclude?: Object[];

        [key: string]: (string | number | boolean)[];
      }
    | Expression
): MatrixInvocations | Expression {
  if (typeof matrix === "string") {
    // Expression
    return matrix;
  }

  const explicitMatrixKeys = Object.keys(matrix).filter(
    (x) => x !== "include" && x !== "exclude"
  );

  const matrixValues: {
    [inputKey: string]: (string | number | boolean)[];
  } = {};
  for (const explicitMatrixKey of explicitMatrixKeys) {
    matrixValues[explicitMatrixKey] = matrix[explicitMatrixKey];
  }

  let invocations = crossProduct(matrixValues);

  // Process excludes, this has to happen before the includes (see
  // https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions#example-excluding-configurations-from-a-matrix)
  if (matrix["exclude"]) {
    // Iterate over all values, remove matching pairs
    for (const toExclude of matrix.exclude) {
      invocations = invocations.filter((x) => !deepEqual(x, toExclude));
    }
  }

  if (matrix["include"]) {
    for (const toInclude of matrix.include) {
      // Find an existing entry to extend
      const idx = invocations.findIndex((x) => leftEqual(x, toInclude));
      if (idx !== -1) {
        invocations.splice(idx, 1, toInclude as any);
      } else {
        invocations.push(toInclude as any);
      }
    }
  }

  return invocations;
}

function leftEqual(a: Object, b: Object) {
  const keysA = Object.keys(a);

  return keysA.every((keyA) => a[keyA] === b[keyA]);
}

function deepEqual(a: Object, b: Object) {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  return (
    keysB.length === keysA.length && keysA.every((keyA) => a[keyA] === b[keyA])
  );
}

export function crossProduct(inputs: {
  [inputKey: string]: (string | number | boolean)[];
}): { [key: string]: string | number | boolean }[] {
  let result: { [key: string]: string | number | boolean }[] = [];

  for (const inputKey of Object.keys(inputs)) {
    if (result.length === 0) {
      // Add first iteration
      result.push(
        ...inputs[inputKey].map((x) => ({
          [inputKey]: x,
        }))
      );
    } else {
      let newResult: { [key: string]: string | number | boolean }[] = [];

      // Add to existing values
      for (const inputValue of inputs[inputKey]) {
        for (const r of result) {
          newResult.push({
            ...r,
            [inputKey]: inputValue,
          });
        }
      }

      result = newResult;
    }
  }

  return result;
}
