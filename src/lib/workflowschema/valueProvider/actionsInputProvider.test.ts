import { Context } from "../../../types";
import { getActionYamlContent } from "./actionsInputProvider";

interface getContentResponse {
  status: number;
  data?: {
    content?: string;
  };
}

const mockContext = (
  getContent: jest.Mock<Promise<getContentResponse>>
): Context => {
  return {
    client: {
      repos: {
        getContent: getContent,
      },
    } as any,
    owner: "dummy",
    repository: "test",
  };
};

describe("getActionYamlContent", () => {
  describe("action.yml", () => {
    it("root action", async () => {
      const getContent = jest
        .fn<Promise<getContentResponse>>()
        .mockReturnValueOnce(
          Promise.resolve({
            status: 200,
            data: {
              content: Buffer.from("hello").toString("base64"),
            },
          })
        );
      const context = mockContext(getContent);
      expect(
        await getActionYamlContent(context, {
          type: "remote",
          owner: "github0",
          repository: "repo1",
          ref: "main",
        })
      ).toBe("hello");
      expect(getContent).toHaveBeenCalledTimes(1);
      expect(getContent).toHaveBeenCalledWith({
        owner: "github0",
        repo: "repo1",
        ref: "main",
        path: "action.yml",
      });
    });
    it("subdirectory action", async () => {
      const getContent = jest
        .fn<Promise<getContentResponse>>()
        .mockReturnValueOnce(
          Promise.resolve({
            status: 200,
            data: {
              content: Buffer.from("hello").toString("base64"),
            },
          })
        );
      const context = mockContext(getContent);
      expect(
        await getActionYamlContent(context, {
          type: "remote",
          owner: "github0",
          repository: "repo1",
          ref: "main",
          subdirectory: "dir2",
        })
      ).toBe("hello");
      expect(getContent).toHaveBeenCalledTimes(1);
      expect(getContent).toHaveBeenCalledWith({
        owner: "github0",
        repo: "repo1",
        ref: "main",
        path: "dir2/action.yml",
      });
    });
  });

  describe("action.yaml", () => {
    it("root action", async () => {
      const getContent = jest
        .fn<Promise<getContentResponse>>()
        .mockReturnValueOnce(
          Promise.resolve({
            status: 404,
            data: {
              content: Buffer.from("error").toString("base64"),
            },
          })
        )
        .mockReturnValueOnce(
          Promise.resolve({
            status: 200,
            data: {
              content: Buffer.from("hello").toString("base64"),
            },
          })
        );
      const context = mockContext(getContent);
      expect(
        await getActionYamlContent(context, {
          type: "remote",
          owner: "github0",
          repository: "repo1",
          ref: "main",
        })
      ).toBe("hello");
      expect(getContent).toHaveBeenCalledTimes(2);
      expect(getContent).toHaveBeenCalledWith({
        owner: "github0",
        repo: "repo1",
        ref: "main",
        path: "action.yml",
      });
      expect(getContent).toHaveBeenLastCalledWith({
        owner: "github0",
        repo: "repo1",
        ref: "main",
        path: "action.yaml",
      });
    });
    it("subdirectory action", async () => {
      const getContent = jest
        .fn<Promise<getContentResponse>>()
        .mockReturnValueOnce(
          Promise.resolve({
            status: 404,
            data: {
              content: Buffer.from("error").toString("base64"),
            },
          })
        )
        .mockReturnValueOnce(
          Promise.resolve({
            status: 200,
            data: {
              content: Buffer.from("hello").toString("base64"),
            },
          })
        );
      const context = mockContext(getContent);
      expect(
        await getActionYamlContent(context, {
          type: "remote",
          owner: "github0",
          repository: "repo1",
          ref: "main",
          subdirectory: "dir2",
        })
      ).toBe("hello");
      expect(getContent).toHaveBeenCalledTimes(2);
      expect(getContent).toHaveBeenCalledWith({
        owner: "github0",
        repo: "repo1",
        ref: "main",
        path: "dir2/action.yml",
      });
      expect(getContent).toHaveBeenLastCalledWith({
        owner: "github0",
        repo: "repo1",
        ref: "main",
        path: "dir2/action.yaml",
      });
    });
  });
});
