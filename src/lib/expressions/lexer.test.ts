import { Lexer, Token, TokenType } from "./lexer";

const lex = (input: string) => {
  const l = new Lexer(input);

  return l.lex();
};

const expectTokenTypes = (input: string, ...expected: TokenType[]) => {
  const r = lex(input);

  expect(r.tokens.map((x) => TokenType[x.type])).toEqual(
    expected.map((x) => TokenType[x]).concat([TokenType[TokenType.EOF]])
  );
};

describe("lexer", () => {
  describe("operators", () => {
    it("+", () => expectTokenTypes("+", TokenType.PLUS));
    it("-", () => expectTokenTypes("-", TokenType.MINUS));
    it("/", () => expectTokenTypes("/", TokenType.SLASH));

    it("<", () => expectTokenTypes("<", TokenType.LESS));
    it(">", () => expectTokenTypes(">", TokenType.GREATER));

    it("!=", () => expectTokenTypes("!=", TokenType.BANG_EQUAL));
    it("==", () => expectTokenTypes("==", TokenType.EQUAL_EQUAL));
    it("<=", () => expectTokenTypes("<=", TokenType.LESS_EQUAL));
    it(">=", () => expectTokenTypes(">=", TokenType.GREATER_EQUAL));
  });

  describe("numbers", () => {
    it("number", () => expectTokenTypes("12", TokenType.NUMBER));
    it("decimal", () => expectTokenTypes("12.0", TokenType.NUMBER));
    it("zero", () => expectTokenTypes("0", TokenType.NUMBER));
  });

  describe("strings", () => {
    it("string", () => {
      expect(lex("'foo'").tokens[0]).toEqual({
        type: TokenType.STRING,
        lexeme: "'foo'",
        value: "foo",
        pos: {
          line: 0,
          column: 0,
        },
      } as Token);
    });
  });

  describe("identifiers", () => {
    it("basic", () => {
      expect(lex("github").tokens[0]).toEqual({
        type: TokenType.IDENTIFIER,
        lexeme: "github",
        pos: {
          line: 0,
          column: 0,
        },
      } as Token);
    });
  });
});
