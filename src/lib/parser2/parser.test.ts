import { DiagnosticKind, parse } from "./parser";

describe("Validation", () => {
  it("Reports missing keys", () => {
    const doc = parse(`name: test
on: push`);

    expect(doc.diagnostics).toEqual([
      {
        start: 0,
        end: 19,
        kind: DiagnosticKind.Error,
        message: "Missing required key 'jobs'",
      },
    ]);
  });

  it("Reports additional keys", () => {
    const doc = parse(`name123: test
on: push
jobs:
  build:
    runs-on: ubuntu-latest`);

    expect(doc.diagnostics).toEqual([
      {
        start: 0,
        end: 13,
        kind: DiagnosticKind.Error,
        message: "Key 'name123' is not allowed",
      },
    ]);
  });
});

// describe("Successful parsing of workflow", () => {
//   it("basic with name", () => {
//     const wd = parse(`name: test
// on: push
// jobs:
//   first:
//     runs-on: ubuntu-latest
//     steps:
//     - run: echo 1`);

//     expect(wd.workflow.name).toBe("test");
//     // expect(wd.workflow.on)("push");
//   });
// });
