import { Context } from "../../types";
import { parse } from "./workflowSchema";

const context: Context = {
  client: null,
  owner: "owner",
  repository: "repository",
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

  it("no validation errors for valid workflow with nested if", async () => {
    const result = await parse(
      context,
      "workflow.yml",
      `on: push

jobs:
  prepare:
    runs-on: ubuntu-latest
    steps:
      - id: filter
        run: echo
      - run: echo
        id: requested-change
      - if: \${{ steps.filter.outputs.notAllowed == 'true' && (!steps.requested-change.outputs.result || fromJSON(steps.requested-change.outputs.result).state != 'CHANGES_REQUESTED') }}
        run: echo`
    );

    expect(result.diagnostics).toEqual([]);
  });

  it("no validation errors for valid workflow with if at step level", async () => {
    const result = await parse(
      context,
      "workflow.yml",
      `on:
  schedule:
    - cron: '20 19 * * *' #

env:
  FREEZE: \${{ secrets.FREEZE }}

jobs:
  prepare:
    if: github.repository == 'github/docs'
    runs-on: ubuntu-latest
    steps:
      - if: \${{ env.FREEZE == 'true' }}
        run: echo
      - uses: juliangruber/find-pull-request-action@2fc55e82a6d5d36fe1e7f1848f7e64fd02d99de9
        id: pr
      - if: \${{ steps.pr.outputs.number }}
        name: Check if already labeled
        uses: actions/github-script@626af12fe9a53dc2972b48385e7fe7dec79145c9
        id: has-label
        with:
          script: |
            const { data: labels } = await github.issues.listLabelsOnIssue({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: \${{ steps.pr.outputs.number }}
            })
            if (labels.find(label => label.name === 'automerge')) {
              return 'ok'
            }
      - if: \${{ !steps.has-label.outputs.result }}
        uses: juliangruber/approve-pull-request-action@c530832d4d346c597332e20e03605aa94fa150a8
        with:
          github-token: \${{ secrets.GITHUB_TOKEN }}
          number: \${{ steps.pr.outputs.number }}
      - if: \${{ !steps.has-label.outputs.result }}
        name: Add automerge label
        uses: actions/github-script@626af12fe9a53dc2972b48385e7fe7dec79145c9
        with:
          github-token: \${{ secrets.GITHUB_TOKEN }}
          script: |
            github.issues.addLabels({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: \${{ steps.pr.outputs.number }},
              labels: ['automerge']
            })`
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

  it("no validation errors for dynamic matrix strategies", async () => {
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
      matrix: \${{ fromJSON(needs.build.outputs.webpack-matrix) }}
    steps:
    - run: echo \${{ matrix.foo }}`
    );

    expect(result.diagnostics).toHaveLength(0);
  });

  it("no validation errors when reusing other workflow in a job", async () => {
    const result = await parse(
      context,
      "workflow.yml",
      `name: Deploy
on:
  push:
jobs:
  tests:
    uses: ./.github/workflows/tests.yml
    secrets: inherit
  tests2:
    uses: ./.github/workflows/tests.yml
    secrets:
      NODE_ENV: \${{ secrets.NODE_ENV }}`
    );

    const diagnosticsAsText = JSON.stringify(result.diagnostics);
    expect(diagnosticsAsText).not.toContain("Key 'uses' is not allowed");
    expect(diagnosticsAsText).not.toContain("Key 'secrets' is not allowed");
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
        type: boolean
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

  it("no validation errors when using workflow_run events", async () => {
    const result = await parse(
      context,
      "workflow.yml",
      `name: e2e workflow
on:
  workflow_run:
    workflows: [build]
    types:
      - completed

jobs:
  e2e-tests:
    name: end-to-end tests
    if: \${{ github.event.workflow_run.conclusion == 'success' }}
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v3`
    );

    expect(result.diagnostics).toHaveLength(0);
  });
});
