import { parseUses } from "./uses";

describe("parseUses", () => {
  it("parses remote uses", () => {
    const r = parseUses("actions/checkout@v1");

    expect(r).toEqual({
      type: "remote",
      ref: "v1",
      owner: "actions",
      repository: "checkout",
    });
  });

  it("parses remote uses in subdirectory", () => {
    const r = parseUses("actions/aws/ec2@v1");

    expect(r).toEqual({
      type: "remote",
      ref: "v1",
      owner: "actions",
      repository: "aws",
      subdirectory: "ec2",
    });
  });

  it("parses local uses", () => {
    const r = parseUses("actions");

    expect(r).toEqual({
      type: "local",
    });
  });
});
