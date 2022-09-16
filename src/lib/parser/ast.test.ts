import YAML from "yaml";
import { PropertyPath } from "../utils/path";
import { getPathFromNode } from "./ast";

describe("getPathFromNode", () => {
  const checkPath = (
    input: string,
    nodeSelector: (doc: YAML.Document) => YAML.Node,
    expectedPath: PropertyPath
  ) => {
    const doc = YAML.parseDocument(input);
    const path = getPathFromNode(doc, nodeSelector(doc));
    expect(path).toEqual(expectedPath);
  };

  it("root map", () => checkPath("foo: bar", (doc) => doc.contents!, ["$"]));

  it("map", () =>
    checkPath(
      "foo:\n  bar: baz",
      (doc) => (doc.contents as YAML.YAMLMap).get("foo") as YAML.YAMLMap,
      ["$", "foo"]
    ));

  it("map value", () =>
    checkPath(
      "foo:\n  bar: baz",
      (doc) =>
        ((doc.contents as YAML.YAMLMap).get("foo") as YAML.YAMLMap).items[0]
          .value as YAML.Node,
      ["$", "foo", "bar"]
    ));
});
