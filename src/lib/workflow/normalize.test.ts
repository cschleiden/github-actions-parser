import { Workflow } from "../workflow";
import { normalizeWorkflow } from "./normalize";

const testNormalize = (workflow: any): Workflow => {
  normalizeWorkflow("workflow.yaml", workflow);
  return workflow;
};

describe("normalize name", () => {
  it("no name given", () => {
    expect(testNormalize({ name: undefined }).name).toBe("workflow.yaml");
  });

  it("name given", () => {
    expect(testNormalize({ name: "CI" }).name).toBe("CI");
  });
});

describe("normalize on", () => {
  it("given as string", () => {
    expect(
      testNormalize({
        on: "push",
      }).on
    ).toEqual({
      push: {},
    });
  });

  it("given as array", () => {
    expect(
      testNormalize({
        on: ["push", "pull_request"],
      }).on
    ).toEqual({
      push: {},
      pull_request: {},
    });
  });

  it("given as map", () => {
    expect(
      testNormalize({
        on: {
          push: {},
          pull_request: {},
        },
      }).on
    ).toEqual({
      push: {},
      pull_request: {},
    });
  });

  describe("workflow_dispatch", () => {
    const r = testNormalize({
      on: {
        workflow_dispatch: {
          inputs: {
            foo: {
              required: true,
            },

            bar: {
              default: 42,
            },
          },
        },
      },
    });

    expect(r.on.workflow_dispatch.inputs["foo"].required).toBe(true);
    expect(r.on.workflow_dispatch.inputs["bar"].default).toBe(42);
  });

  describe("repository_dispatch types", () => {
    const r = testNormalize({
      on: {
        repository_dispatch: {
          types: ["a", "b"],
        },
      },
    });

    expect(r.on.repository_dispatch.types).toEqual(["a", "b"]);
  });
});

describe("normalize job", () => {
  it("needs", () => {
    expect(
      testNormalize({
        jobs: {
          test: {
            needs: "build",
          },
        },
      }).jobs.test.needs
    ).toEqual(["build"]);
  });
});
