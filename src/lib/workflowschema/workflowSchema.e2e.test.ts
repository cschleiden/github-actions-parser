import { Context } from "../../types";
import { ContextProviderFactory } from "../parser/complete";
import { PropertyPath } from "../utils/path";
import { Workflow } from "../workflow";
import { EditContextProvider } from "./contextProvider";
import { parse } from "./workflowSchema";

const context: Context = {
  client: null,
  owner: "owner",
  repository: "repository",
};
const ExpressionContextProviderFactory: ContextProviderFactory = {
  get: async (workflow: Workflow, path: PropertyPath) =>
    new EditContextProvider(workflow, path, []),
};

describe("E2E", () => {
  it("no validation errors for valid workflow", async () => {
    const result = await parse(
      context,
      "workflow.yml",
      `on:
  push:
  release:

env:
  WORKFLOW_VALUE: 42

jobs:
  build:
    name: \${{ env.WORKFLOW_VALUE }}

    runs-on: [ubuntu-latest]

    env:
      JOB_VALUE: 23

    steps:
      - run: echo "Hello $FOO"
        env:
          RELEASE_ID: \${{ github.event.release.id }}
          # X: \${{ secrets.REPO_SECRET }}
      - uses: "actions/cache@main"
        with:
          path: '123'`
    );

    expect(result.diagnostics).toEqual([]);
  });

  it("no validation errors for valid workflow", async () => {
    const result = await parse(
      context,
      "workflow.yml",
      `on: push

jobs:
  build:
    runs-on: [ubuntu-latest]
    steps:
    - run: echo "Hello $FOO"
  test:
    runs-on: ubuntu-latest
    needs: build
    steps:
    - run: echo
  deploy:
    runs-on: ubuntu-latest
    needs: [build, test]
    steps:
    - run: echo`
    );

    expect(result.workflow.jobs["build"].needs).toBeUndefined();
    expect(result.workflow.jobs["test"].needs).toEqual(["build"]);
    expect(result.workflow.jobs["deploy"].needs).toEqual(["build", "test"]);
  });
});
