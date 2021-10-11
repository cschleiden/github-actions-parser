import { evaluateExpression, replaceExpressions } from ".";

import { ContextProvider } from "./types";

const ctx: ContextProvider = {
  get: (context: string) => {
    switch (context) {
      case "github": {
        return {
          token: "thisisasecrettoken",
          job: "first",
          // ref: `refs/heads/${("branch" in event && event.branch) || "master"}`,
          sha: "825e127fcace28992b3688a96f78fe4d55e1e145",
          repository: "cschleiden/github-actions-hero",
          repositoryUrl: "git://github.com/cschleiden/github-actions-hero.git",
          run_id: "42",
          run_number: "23",
          actor: "cschleiden",
          // workflow,
          head_ref: "825e127fcace28992b3688a96f78fe4d55e1e145",
          base_ref: "",
          // event_name: event.event,
          // event: getEventPayload(event.event),

          ref: "refs/heads/master",
          event_name: "push",
          event: {
            ref: "refs/heads/master",
          },
        };
      }

      case "secrets": {
        return {
          FOO: "Bar",
        };
      }

      case "env": {
        return {
          foo: "token",
          contains: "test",
          jobBar: "test",
        };
      }
    }

    return {};
  },
};

const ev = <T>(input: string): T => evaluateExpression(input, ctx);

describe("expression replacer", () => {
  it("replaces expressions in strings", () => {
    expect(replaceExpressions("abc", ctx)).toBe("abc");
    expect(replaceExpressions("abc ${{ 'test' }}", ctx)).toBe("abc test");
    expect(replaceExpressions("${{ 123 }} abc ${{ 'test' }}", ctx)).toBe(
      "123 abc test"
    );
  });

  it("replaces expressions in strings without spaces", () => {
    expect(replaceExpressions("abc_${{ 'test' }}", ctx)).toBe("abc_test");
    expect(
      replaceExpressions("abc_${{ secrets.FOO || github.actor }}", ctx)
    ).toBe("abc_Bar");
  });
});
