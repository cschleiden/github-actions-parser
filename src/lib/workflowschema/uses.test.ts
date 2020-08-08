import { parseUses } from "./uses";

describe("parseUses", () => {
  it("parses remote uses", () => {
    const r = parseUses("actions/checkout@v1");

    expect(r).toEqual({
      ref: "v1",
      owner: "actions",
      name: "checkout",
    });
  });

  it("returns undefined for invalid ref", () => {
    const r = parseUses("actions");

    expect(r).toBeUndefined();
  });
});
