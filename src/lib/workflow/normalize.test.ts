import { Workflow } from "../workflow";
import { crossProduct, normalizeMatrix, normalizeWorkflow } from "./normalize";

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

describe("cross-product", () => {
  it("built with mixed inputs", () => {
    expect(
      crossProduct({
        a: [1, 2],
        b: [3],
        c: ["4", "5"],
      })
    ).toEqual([
      {
        a: 1,
        b: 3,
        c: "4",
      },
      {
        a: 2,
        b: 3,
        c: "4",
      },
      {
        a: 1,
        b: 3,
        c: "5",
      },
      {
        a: 2,
        b: 3,
        c: "5",
      },
    ]);
  });
});

describe("normalizeMatrix", () => {
  it("supports exclude", () => {
    expect(
      normalizeMatrix({
        a: [1, 2],
        b: ["test"],
        exclude: [
          {
            a: 2,
            b: "test",
          },
        ],
      } as any)
    ).toEqual([
      {
        a: 1,
        b: "test",
      },
    ]);
  });

  it("supports include", () => {
    expect(
      normalizeMatrix({
        a: [1, 2],
        b: ["test"],
        include: [
          {
            a: 3,
            b: "test2",
          },
        ],
      } as any)
    ).toEqual([
      {
        a: 1,
        b: "test",
      },
      {
        a: 2,
        b: "test",
      },
      {
        a: 3,
        b: "test2",
      },
    ]);
  });

  it("include/exclude mix", () => {
    expect(
      normalizeMatrix({
        a: [1, 2],
        b: ["test"],
        exclude: [
          {
            a: 2,
            b: "test",
          },
        ],
        include: [
          {
            a: 1,
            b: "test",
            experimental: true,
          },
          {
            a: 3,
          },
        ],
      } as any)
    ).toEqual([
      {
        a: 1,
        b: "test",
        experimental: true,
      },
      {
        a: 3,
      },
    ]);
  });
});
