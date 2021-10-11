import { Array, Binary, Literal } from "./ast";
import { Lexer, TokenType } from "./lexer";

import { Parser } from "./parser";

const parse = (input: string) => {
  const result = new Lexer(input).lex();
  const expr = new Parser(result.tokens).parse();
  return expr;
};

describe("parser", () => {
  it("comparison", () => {
    expect(parse("1 == 2")).toEqual(
      new Binary(
        new Literal(1),
        {
          type: TokenType.EQUAL_EQUAL,
          lexeme: "==",
          pos: {
            line: 0,
            column: 2,
          },
          value: undefined,
        },
        new Literal(2)
      )
    );
  });

  it("array", () => {
    expect(parse("[]")).toEqual(new Array([]));
    expect(parse("[1]")).toEqual(new Array([new Literal(1)]));
    expect(parse("[1,2]")).toEqual(new Array([new Literal(1), new Literal(2)]));
  });
});
