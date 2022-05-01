import { evaluateExpression, replaceExpressions } from ".";
import { Undetermined } from "./functions";
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

describe("expression parser", () => {
  it("numbers", () => {
    expect(ev("1")).toBe(1);
    expect(ev("2")).toBe(2);

    expect(ev("-2.0")).toBe(-2.0);
    expect(ev("-10.5")).toBe(-10.5);
  });

  it("strings", () => {
    expect(ev("'a'")).toBe("a");
    expect(ev("'abc'")).toBe("abc");
    expect(ev("'It''s open source!'")).toBe("It's open source!");
  });

  it("boolean", () => {
    expect(ev("true")).toBe(true);
    expect(ev("false")).toBe(false);
  });

  it("array", () => {
    expect(ev("[]")).toEqual([]);
    expect(ev("[1,2,3]")).toEqual([1, 2, 3]);
    expect(ev("['a', 'b']")).toEqual(["a", "b"]);
    expect(ev("['a', 1]")).toEqual(["a", 1]);
  });

  describe("operators", () => {
    it("==", () => {
      // Numbers
      expect(ev("1 == 2")).toBe(false);
      expect(ev("1 == 1")).toBe(true);

      // Strings
      expect(ev("'1' == '2'")).toBe(false);
      expect(ev("'ab' == 'ab'")).toBe(true);

      // Booleans
      expect(ev("true == true")).toBe(true);
      expect(ev("true == false")).toBe(false);
      expect(ev("false == true")).toBe(false);
      expect(ev("false == false")).toBe(true);

      // Mixed
      expect(ev("null == 0")).toBe(true);
      expect(ev("0 == null")).toBe(true);

      // Array
      expect(ev("[1,2] == [1.2]")).toBe(false);
    });

    it("!=", () => {
      // Numbers
      expect(ev("1 != 2")).toBe(true);
      expect(ev("1 != 1")).toBe(false);

      // Strings
      expect(ev("'1' != '2'")).toBe(true);
      expect(ev("'ab' != 'ab'")).toBe(false);

      // Booleans
      expect(ev("true != true")).toBe(false);
      expect(ev("true != false")).toBe(true);
      expect(ev("false != true")).toBe(true);
      expect(ev("false != false")).toBe(false);

      // Mixed
      expect(ev("null != 0")).toBe(false);
      expect(ev("0 != null")).toBe(false);

      // Array
      expect(ev("[1,2] != [1.2]")).toBe(true);
    });

    it("&&", () => {
      expect(ev("true && false")).toBe(false);
      expect(ev("false && true")).toBe(false);
      expect(ev("true && true")).toBe(true);
      expect(ev("false && false")).toBe(false);
    });

    it("||", () => {
      expect(ev("true || false")).toBe(true);
      expect(ev("false || true")).toBe(true);
      expect(ev("true || true")).toBe(true);
      expect(ev("false || false")).toBe(false);
    });

    it("<", () => {
      expect(ev("1 < 2")).toBe(true);
      expect(ev("1 < 1")).toBe(false);
      expect(ev("2 < 1")).toBe(false);
    });

    it("<=", () => {
      expect(ev("1 <= 2")).toBe(true);
      expect(ev("1 <= 1")).toBe(true);
      expect(ev("2 <= 1")).toBe(false);
    });

    it(">", () => {
      expect(ev("1 > 2")).toBe(false);
      expect(ev("1 > 1")).toBe(false);
      expect(ev("2 > 1")).toBe(true);
    });

    it(">=", () => {
      expect(ev("1 >= 2")).toBe(false);
      expect(ev("1 >= 1")).toBe(true);
      expect(ev("2 >= 1")).toBe(true);
    });

    it("!", () => {
      expect(ev("!false")).toBe(true);
      expect(ev("!true")).toBe(false);
      expect(ev("!0")).toBe(true);

      expect(ev("!(true == true)")).toBe(false);
      expect(ev("!(true == false)")).toBe(true);

      expect(ev("!always()")).toBe(false);
      expect(ev("!startsWith('Hello world', 'He')")).toBe(false);
    });
  });

  it("logical grouping", () => {
    expect(ev("(true && false) && true")).toBe(false);
    expect(ev("true && (false && true)")).toBe(false);

    expect(ev("(true || false) && true")).toBe(true);
    expect(ev("true || (false && true)")).toBe(true);
  });

  describe("functions", () => {
    describe("contains", () => {
      it("in array", () => {
        expect(ev("contains([2, 1], 1)")).toBe(true);
        expect(ev("Contains([2, 1], 1)")).toBe(true);
      });

      it("in string", () => {
        expect(ev("contains('hay', 'h')")).toBe(true);
        expect(ev("contains('tay', 'h')")).toBe(false);
      });
    });

    it("startsWith", () => {
      expect(ev("startsWith('Hello world', 'He')")).toBe(true);
      expect(ev("startsWith('Hello world', 'Het')")).toBe(false);
    });

    it("endsWith", () => {
      expect(ev("endsWith('Hello world', 'world')")).toBe(true);
      expect(ev("endsWith('Hello world', 'Het')")).toBe(false);
    });

    it("join", () => {
      expect(ev("join([1,2,3])")).toBe("1,2,3");
      expect(ev("join([1,2,3], '')")).toBe("123");
      expect(ev("join([1,'2'], '')")).toBe("12");
    });

    it("toJSON", () => {
      expect(ev("toJSON([1,2,3])")).toBe("[1,2,3]");
      expect(ev("toJSON(github.event_name)")).toBe('"push"');
      expect(ev("toJSON(true)")).toBe("true");
      expect(ev("toJSON(false)")).toBe("false");
    });

    describe("fromJSON", () => {
      it("basic", () => {
        expect(ev("fromJSON('{ \"foo\": true }')")).toEqual({ foo: true });
      });

      it("object access", () => {
        expect(ev("fromJSON('{ \"foo\": true }').foo")).toEqual(true);
        expect(ev("fromJSON('{ \"foo\": true }')['foo']")).toEqual(true);
      });

      it("array access", () => {
        expect(ev("fromJSON('[24, 32]')[0]")).toEqual(24);
        expect(ev("fromJSON('[24, 32]')[1]")).toEqual(32);

        expect(ev("fromJSON('[42, \"test\"]')[1 == 2]")).toEqual(42);
        expect(ev("fromJSON('[42, \"test\"]')[1 == 1]")).toEqual("test");
      });
    });

    it("hashFiles", () => {
      expect(ev("hashFiles('foo.txt')")).toBe("sha-256-hash-for-foo.txt");
      expect(ev("hashFiles('foo.txt', 'bar.txt')")).toBe(
        "sha-256-hash-for-foo.txt,bar.txt"
      );
    });

    it("format", () => {
      expect(
        ev("format('{{Hello {0} {1} {2}}}', 'Mona', 'the', 'Octocat')")
      ).toBe("{Hello Mona the Octocat}");
    });

    it("always", () => {
      expect(ev("always()")).toBe(true);
    });

    it("failure", () => {
      expect(ev("failure()")).toBe(Undetermined);
    });

    it("success", () => {
      expect(ev("success()")).toBe(Undetermined);
    });
  });

  describe("ambiguity", () => {
    it("context member keyword prefix", () => {
      expect(ev("env.jobBar")).toBe("test");
    });

    it("context member keyword match", () => {
      expect(ev("env.contains")).toBe("test");
    });
  });

  describe("context", () => {
    it("simple access", () => {
      expect(ev("github.event_name")).toBe("push");
      expect(ev("github['event_name']")).toBe("push");
    });

    it("nested access", () => {
      expect(ev("github.event['ref']")).toBe("refs/heads/master");
      expect(ev("github.event.ref")).toBe("refs/heads/master");
      expect(ev("github['event']['ref']")).toBe("refs/heads/master");
    });

    it("indirect access", () => {
      expect(ev("github[env.foo]")).toBe("thisisasecrettoken");
      expect(ev("github[format('{0}', 'event_name')]")).toBe("push");
    });
  });
});

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
