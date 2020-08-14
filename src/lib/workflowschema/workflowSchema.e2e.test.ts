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
  it("completes top level keys", async () => {
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
});
