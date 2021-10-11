import { Array, Binary, Expr, Grouping, Literal, Logical, Unary } from "./ast";
import { Pos, Token, TokenType } from "./lexer";

export class ParserError extends Error {
  constructor(message: string, public pos: Pos) {
    super(message);
  }
}

export class Parser {
  private offset = 0;

  constructor(private tokens: Token[]) {}

  parse(): Expr {
    return this.expression();
  }

  private expression(): Expr {
    return this.logical_or();
  }

  private logical_or(): Expr {
    let expr = this.logical_and();

    while (this.match(TokenType.OR)) {
      const operator = this.previous();
      const right = this.logical_and();
      expr = new Logical(expr, operator, right);
    }

    return expr;
  }

  private logical_and(): Expr {
    let expr = this.equality();

    while (this.match(TokenType.AND)) {
      const operator = this.previous();
      const right = this.equality();
      expr = new Logical(expr, operator, right);
    }

    return expr;
  }

  private equality(): Expr {
    let expr = this.comparison();

    while (this.match(TokenType.BANG_EQUAL, TokenType.EQUAL_EQUAL)) {
      const operator = this.previous();
      const right = this.comparison();
      expr = new Binary(expr, operator, right);
    }

    return expr;
  }

  private comparison(): Expr {
    let expr = this.unary();

    while (
      this.match(
        TokenType.GREATER,
        TokenType.GREATER_EQUAL,
        TokenType.LESS,
        TokenType.LESS_EQUAL
      )
    ) {
      const operator = this.previous();
      const right = this.unary();
      expr = new Binary(expr, operator, right);
    }

    return expr;
  }

  private unary(): Expr {
    if (this.match(TokenType.BANG, TokenType.MINUS)) {
      const operator = this.previous();
      const unary = this.unary();
      return new Unary(operator, unary);
    }

    return this.primary();
  }

  private primary(): Expr {
    switch (true) {
      case this.match(TokenType.FALSE):
        return new Literal(false);

      case this.match(TokenType.TRUE):
        return new Literal(true);

      case this.match(TokenType.NULL):
        return new Literal(null);

      case this.match(TokenType.NUMBER, TokenType.STRING):
        return new Literal(this.previous().value!);

      case this.match(TokenType.LEFT_PAREN): {
        const expr = this.expression();
        this.consume(TokenType.RIGHT_PAREN, "Expected ')' after expression.");
        return new Grouping(expr);
      }

      case this.match(TokenType.LEFT_BRACKET): {
        // Special case, empty array
        if (this.match(TokenType.RIGHT_BRACKET)) {
          return new Array([]);
        }

        const a = [this.expression()];

        while (this.match(TokenType.COMMA)) {
          const expr = this.expression();
          a.push(expr);
        }

        this.consume(TokenType.RIGHT_BRACKET, "Expected ']'");

        return new Array(a);
      }
    }

    throw new Error("Should not get here...");
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.next();
        return true;
      }
    }

    return false;
  }

  private check(type: TokenType): boolean {
    if (this.atEnd()) {
      return false;
    }

    return this.peek().type === type;
  }

  private atEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private next(): Token {
    if (!this.atEnd()) {
      ++this.offset;
    }

    return this.previous();
  }

  private peek(): Token {
    return this.tokens[this.offset];
  }

  private previous(): Token {
    return this.tokens[this.offset - 1];
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) {
      return this.next();
    }

    //throw new Error(this.peek(), message);
    throw new ParserError(message, this.peek().pos);
  }
}
