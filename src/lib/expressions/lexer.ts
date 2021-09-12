export enum TokenType {
  LEFT_PAREN,
  RIGHT_PAREN,
  LEFT_BRACE,
  RIGHT_BRACE,
  COMMA,
  DOT,
  MINUS,
  PLUS,
  SLASH,
  STAR,

  // 1-2 chars token
  BANG,
  BANG_EQUAL,
  EQUAL,
  EQUAL_EQUAL,
  GREATER,
  GREATER_EQUAL,
  LESS,
  LESS_EQUAL,

  // Literals
  NUMBER,
  STRING,
  IDENTIFIER,

  EOF,
}

export type Pos = {
  line: number;
  column: number;
};

export type Token = {
  type: TokenType;

  lexeme: string;
  value?: string | number | boolean;

  pos: Pos;
};

export type Result = {
  tokens: Token[];
};

export class Lexer {
  private start = 0;
  private offset = 0;

  private line = 0;
  private lastLineOffset = 0;

  private tokens: Token[] = [];

  constructor(private input: string) {}

  lex(): Result {
    while (!this.atEnd()) {
      this.start = this.offset;
      const c = this.next();

      switch (c) {
        case "(":
          this.addToken(TokenType.LEFT_PAREN);
          break;
        case ")":
          this.addToken(TokenType.RIGHT_PAREN);
          break;
        case "{":
          this.addToken(TokenType.LEFT_BRACE);
          break;
        case "}":
          this.addToken(TokenType.RIGHT_BRACE);
          break;
        case ",":
          this.addToken(TokenType.COMMA);
          break;
        case ".":
          this.addToken(TokenType.DOT);
          break;
        case "-":
          this.addToken(TokenType.MINUS);
          break;
        case "+":
          this.addToken(TokenType.PLUS);
          break;
        case "*":
          this.addToken(TokenType.STAR);
          break;
        case "/":
          this.addToken(TokenType.SLASH);
          break;
        case "!":
          this.addToken(
            this.match("=") ? TokenType.BANG_EQUAL : TokenType.BANG
          );
          break;
        case "=":
          this.addToken(
            this.match("=") ? TokenType.EQUAL_EQUAL : TokenType.EQUAL
          );
          break;
        case "<":
          this.addToken(
            this.match("=") ? TokenType.LESS_EQUAL : TokenType.LESS
          );
          break;
        case ">":
          this.addToken(
            this.match("=") ? TokenType.GREATER_EQUAL : TokenType.GREATER
          );
          break;

        // Ignore whitespace.
        case " ":
        case "\r":
        case "\t":
          break;

        case "\n":
          ++this.line;
          this.lastLineOffset = this.offset;
          break;

        case "'":
          this.consumeString();
          break;

        default:
          switch (true) {
            case isDigit(c):
              this.consumeNumber();
              break;

            case isAlpha(c):
              this.consumeIdentifier();
              break;

            default:
              // TODO: Error
              throw new Error(`Unexpected input ${c}`);
          }
      }
    }

    this.tokens.push({
      type: TokenType.EOF,
      lexeme: "",
      pos: this.pos(),
    });

    return {
      tokens: this.tokens,
    };
  }

  private pos(): Pos {
    return {
      line: this.line,
      column: this.start - this.lastLineOffset,
    };
  }

  private atEnd(): boolean {
    return this.offset >= this.input.length;
  }

  private peek(): string {
    if (this.atEnd()) {
      return "\0";
    }

    return this.input[this.offset];
  }

  private peekNext(): string {
    if (this.offset + 1 >= this.input.length) {
      return "\0";
    }

    return this.input[this.offset + 1];
  }

  private next(): string {
    return this.input[this.offset++];
  }

  private reverse(): string {
    return this.input[--this.offset];
  }

  private match(expected: string): boolean {
    if (this.atEnd()) {
      return false;
    }
    if (this.input[this.offset] !== expected) {
      return false;
    }

    this.offset++;
    return true;
  }

  private addToken(type: TokenType, value?: string | number | boolean) {
    this.tokens.push({
      type,
      lexeme: this.input.substr(this.start, this.offset),
      pos: this.pos(),
      value,
    });
  }

  private consumeNumber() {
    while (isDigit(this.peek())) {
      this.next();
    }

    // Look for a fractional part.
    if (this.peek() == "." && isDigit(this.peekNext())) {
      this.next();

      // Consume fractional part
      while (isDigit(this.peek())) this.next();
    }

    const lexeme = this.input.substring(this.start, this.offset);

    // TODO: Handle invalid numbers
    const value = parseFloat(lexeme);

    this.addToken(TokenType.NUMBER, value);
  }

  private consumeString() {
    while (this.peek() != "'" && !this.atEnd()) {
      if (this.peek() == "\n") this.line++;
      this.next();
    }

    if (this.atEnd()) {
      // TODO: Error handling, unterminated string
      return;
    }

    // Closing '
    this.next();

    // Trim the surrounding quotes.
    const value = this.input.substring(this.start + 1, this.offset - 1);
    this.addToken(TokenType.STRING, value);
  }

  private consumeIdentifier() {
    while (isAlphaNumeric(this.peek())) this.next();

    this.addToken(TokenType.IDENTIFIER);
  }
}

function isDigit(c: string) {
  return c >= "0" && c <= "9";
}

function isAlpha(c: string) {
  return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c == "_";
}

function isAlphaNumeric(c: string) {
  return isAlpha(c) || isDigit(c);
}
