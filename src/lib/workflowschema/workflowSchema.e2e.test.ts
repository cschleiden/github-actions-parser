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
  it("no validation errors for valid workflow 1", async () => {
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

  it("no validation errors for valid workflow with dependencies", async () => {
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

  it("no validation errors for dynamic matrix stratgies", async () => {
    const result = await parse(
      context,
      "workflow.yml",
      `on: push

jobs:
  build:
    runs-on: [ubuntu-latest]
    outputs:
      webpack-matrix: \${{ steps.set-matrix.outputs.webpack-matrix }}
    steps:
    - name: Determine matrixes
      id: set-matrix
      run: echo 'could set a matrix'
  test:
    runs-on: ubuntu-latest
    needs: build
    strategy:
      matrix: \${{ fromJson(needs.build.outputs.webpack-matrix) }}
    steps:
    - run: echo \${{ matrix.foo }}`
    );

    expect(result.diagnostics).toHaveLength(0);
  });

  it("supports workflow_dispatch inputs", async () => {
    const result = await parse(
      context,
      "workflow.yml",
      `name: "Update dependencies"
on:
  workflow_dispatch:
    inputs:
      force:
        description: 'Also create pull request if only developer dependencies changed'
        default: 'false'
  schedule:
    - cron: '37 4 * * 6'

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout
      uses: actions/checkout@v2
    - name: Update dependencies
      run: yarn upgrade --latest
    - name: Build
      run: make
    - name: Detect changes in distributed code
      if: \${{ github.event.inputs.force != 'true' }}
      id: changes
      run: |
        if [[ $(git status --porcelain ./dist) != "" ]]; then
          echo "::set-output name=dist::true"
        fi
    - name: Create Pull Request
      if: \${{ github.event.inputs.force == 'true' }}
      uses: peter-evans/create-pull-request@v3
      with:
        commit-message: "Update dependencies"
        branch: yarn-upgrade-latest
        delete-branch: true
        title: "Update dependencies"
        body: "Automatically created by the 'Update Dependencies' workflow"`
    );

    expect(result.diagnostics).toHaveLength(0);
    expect(result.workflow.jobs["update"].needs).toBeUndefined();
  });
});
