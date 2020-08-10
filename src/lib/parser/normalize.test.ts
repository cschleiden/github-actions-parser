import { Workflow } from "../workflow";
import { normalizeWorkflow } from "./normalize";

const testNormalize = (workflow: any): Workflow => {
  normalizeWorkflow("workflow.yaml", workflow);
  return workflow;
};

describe("normalize name", () => {
  it("no name given", () => {
    expect(testNormalize({ name: undefined })).toEqual({
      name: "workflow.yaml",
    });
  });

  it("name given", () => {
    expect(testNormalize({ name: "CI" })).toEqual({
      name: "CI",
    });
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
});
