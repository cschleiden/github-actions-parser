import { CustomValue, CustomValueValidation } from "../../parser/schema";
import { TTLCache } from "../../utils/cache";
import { actionsInputProvider } from "./actionsInputProvider";
import { parse } from "../workflowSchema";
import { PropertyPath } from "../../utils/path";

interface getContentResponse {
  status: number;
  data?: {
    content?: string;
  };
}

const mockGetContent = (
  responses: getContentResponse[]
): jest.Mock<Promise<getContentResponse>> => {
  let fn = jest.fn<Promise<getContentResponse>>();
  for (const resp of responses) {
    fn = fn.mockReturnValueOnce(Promise.resolve(resp));
  }
  return fn;
};

const parseWorkflow = async (workflowYaml: string) =>
  await parse(
    {
      client: null as any,
      owner: "dummy",
      repository: "dummy",
    },
    "workflow.yml",
    workflowYaml
  ).then((d) => d.workflow);

const testActionsInput = async (
  usesString: string,
  getContent: jest.Mock<Promise<getContentResponse>>,
  expected: CustomValue[] | undefined
) => {
  const workflow = await parseWorkflow(`on:
  push:

jobs:
  test:
    name: Test
    runs-on: ubuntu-latest
    steps:
      - uses: ${usesString}
        with:
          path: '123'`);
  const path: PropertyPath = ["$", "jobs", "test", ["steps", 0], "with"];

  const context = {
    client: {
      repos: {
        getContent: getContent,
      },
    } as any,
    owner: "dummy",
    repository: "dummy",
  };
  expect(
    await actionsInputProvider(context, new TTLCache())(
      null as any,
      workflow,
      path
    )
  ).toEqual(expected);
};

describe("actionsInputProvider", () => {
  const yamlContent = Buffer.from(
    `
name: Test
description: Yaml for Test
author: kzrnm
inputs:
  description_default:
    description: Foo value
    default: foo
  description_default_required:
    description: Bar value
    default: bar
    required: true
  description_required:
    description: anything
    required: true
  default_required:
    default: baz
    required: true
  required:
    required: true
  default:
    default: foobar
runs:
  using: node16
  main: index.js
branding:
  icon: tag
  color: red`
  ).toString("base64");

  const expected: CustomValue[] = [
    {
      value: "description_default",
      description: "Foo value \n\nrequired: `false` \n\ndefault:`foo`",
      validation: CustomValueValidation.None,
    },
    {
      value: "description_default_required",
      description: "Bar value \n\nrequired: `true` \n\ndefault:`bar`",
      validation: CustomValueValidation.Required,
    },
    {
      value: "description_required",
      description: "anything \n\nrequired: `true` \n\n",
      validation: CustomValueValidation.Required,
    },
    {
      value: "default_required",
      description: " \n\nrequired: `true` \n\ndefault:`baz`",
      validation: CustomValueValidation.Required,
    },
    {
      value: "required",
      description: " \n\nrequired: `true` \n\n",
      validation: CustomValueValidation.Required,
    },
    {
      value: "default",
      description: " \n\nrequired: `false` \n\ndefault:`foobar`",
      validation: CustomValueValidation.None,
    },
  ];

  describe("action.yml", () => {
    const responses = [
      {
        status: 200,
        data: {
          content: yamlContent,
        },
      },
    ];

    it("root action", async () => {
      const getContent = mockGetContent(responses);
      await testActionsInput("ownerName/RepoName@main", getContent, expected);

      expect(getContent).toHaveBeenCalledTimes(1);
      expect(getContent).toHaveBeenCalledWith({
        owner: "ownerName",
        repo: "RepoName",
        ref: "main",
        path: "action.yml",
      });
    });
    it("subdirectory action", async () => {
      const getContent = mockGetContent(responses);
      await testActionsInput(
        "ownerName/RepoName/DirSub@main",
        getContent,
        expected
      );

      expect(getContent).toHaveBeenCalledTimes(1);
      expect(getContent).toHaveBeenCalledWith({
        owner: "ownerName",
        repo: "RepoName",
        ref: "main",
        path: "DirSub/action.yml",
      });
    });
  });

  describe("action.yaml", () => {
    const responses = [
      {
        status: 404,
        data: {
          content: Buffer.from("error").toString("base64"),
        },
      },
      {
        status: 200,
        data: {
          content: yamlContent,
        },
      },
    ];

    it("root action", async () => {
      const getContent = mockGetContent(responses);
      await testActionsInput("ownerName/RepoName@main", getContent, expected);

      expect(getContent).toHaveBeenCalledTimes(2);
      expect(getContent).toHaveBeenCalledWith({
        owner: "ownerName",
        repo: "RepoName",
        ref: "main",
        path: "action.yml",
      });
      expect(getContent).toHaveBeenLastCalledWith({
        owner: "ownerName",
        repo: "RepoName",
        ref: "main",
        path: "action.yaml",
      });
    });
    it("subdirectory action", async () => {
      const getContent = mockGetContent(responses);
      await testActionsInput(
        "ownerName/RepoName/DirSub@main",
        getContent,
        expected
      );

      expect(getContent).toHaveBeenCalledTimes(2);
      expect(getContent).toHaveBeenCalledWith({
        owner: "ownerName",
        repo: "RepoName",
        ref: "main",
        path: "DirSub/action.yml",
      });
      expect(getContent).toHaveBeenLastCalledWith({
        owner: "ownerName",
        repo: "RepoName",
        ref: "main",
        path: "DirSub/action.yaml",
      });
    });
  });
});
