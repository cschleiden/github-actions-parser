import { Context, DiagnosticKind } from "../../types";

import { ContextProviderFactory } from "../parser/complete";
import { EditContextProvider } from "./contextProvider";
import { PropertyPath } from "../utils/path";
import { Workflow } from "../workflow";
import { _getSchema } from "./workflowSchema";
import { parse } from "../parser/parser";

const context: Context = {
  client: null,
  owner: "owner",
  repository: "repository",
};
const WorkflowSchema = _getSchema(context);
const ExpressionContextProviderFactory: ContextProviderFactory = {
  get: async (workflow: Workflow, path: PropertyPath) =>
    new EditContextProvider(workflow, path, []),
};

describe("validation", () => {
  const testValidation = async (input: string) => {
    return (
      await parse(
        "workflow.yml",
        input,
        WorkflowSchema,
        ExpressionContextProviderFactory
      )
    ).diagnostics;
  };

  describe("expressions", () => {
    it("in string", async () => {
      expect(
        await testValidation(`on: push
env:
  secret_name: test
  test: 42
jobs:
  first:
    runs-on: [ubuntu-latest]
    steps:
      - name: pass secret value
        run: echo "::set-env name=secret_value::\${{ env[env.secret_name] }}"`)
      ).toEqual([]);
    });
  });

  describe("environments", () => {
    it("as string", async () => {
      expect(
        await testValidation(`on: push
jobs:
  first:
    runs-on: [ubuntu-latest]
    environment: Prod
    steps:
      - run: echo Hello`)
      ).toEqual([]);
    });

    it("as object", async () => {
      expect(
        await testValidation(`on: push
jobs:
  first:
    runs-on: [ubuntu-latest]
    environment:
      name: prod
      url: https://www.github.com
    steps:
      - run: echo Hello`)
      ).toEqual([]);
    });

    it("as invalid object", async () => {
      expect(
        await testValidation(`on: push
jobs:
  first:
    runs-on: [ubuntu-latest]
    environment:
      name: prod
      url2: https://www.github.com
    steps:
      - run: echo Hello`)
      ).toEqual([
        {
          kind: 0,
          message: "Key 'url2' is not allowed",
          pos: [76, 121],
        },
      ]);
    });
  });

  describe("needs", () => {
    it("validates successfully", async () => {
      expect(
        await testValidation(`on: push
jobs:
  build:
    runs-on: [ubuntu-latest]
    steps:
      - run: echo 1
  test:
    runs-on: [ubuntu-latest]
    needs: build
    steps:
      - run: echo 1`)
      ).toEqual([]);
    });

    it("validates missing jobs", async () => {
      expect(
        await testValidation(`on: push
jobs:
  test:
    runs-on: [ubuntu-latest]
    needs: build
    steps:
      - run: echo 1`)
      ).toEqual([
        {
          kind: DiagnosticKind.Error,
          message: "'build' is not in the list of allowed values",
          pos: [63, 68],
        },
      ]);
    });

    it("validates missing some jobs", async () => {
      expect(
        await testValidation(`on: push
jobs:
  build:
    runs-on: [ubuntu-latest]
    steps:
      - run: echo 1
  test:
    runs-on: [ubuntu-latest]
    needs: [build, setup]
    steps:
      - run: echo 1`)
      ).toEqual([
        {
          kind: DiagnosticKind.Error,
          message: "'setup' is not in the list of allowed values",
          pos: [140, 145],
        },
      ]);
    });

    describe("step outputs", () => {
      it("validates referenced step exists", async () => {
        expect(
          await testValidation(`on: push
jobs:
  test:
    runs-on: [ubuntu-latest]
    steps:
      - run: echo 1
        if: \${{ steps.build.outputs.did_warn }}`)
        ).toEqual([
          {
            kind: DiagnosticKind.Error,
            message: "Unknown context access: 'steps.build.outputs.did_warn'",
            pos: [95, 130],
          },
          {
            kind: 0,
            message: "Invalid expression",
            pos: [95, 130],
          },
        ]);
      });

      it("validates dynamic output", async () => {
        expect(
          await testValidation(`on: push
jobs:
  test:
    runs-on: [ubuntu-latest]
    steps:
      - id: build
        run: echo
      - if: \${{ steps.build.outputs.did_warn }}
        run: echo 1`)
        ).toEqual([]);
      });
    });
  });
});
