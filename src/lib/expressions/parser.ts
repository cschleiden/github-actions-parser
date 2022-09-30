import * as chevrotain from "chevrotain";

///////
// Copy the content between here,

const True = chevrotain.createToken({ name: "True", pattern: /true/ });
const False = chevrotain.createToken({ name: "False", pattern: /false/ });
const Null = chevrotain.createToken({ name: "Null", pattern: /null/ });
const LParens = chevrotain.createToken({ name: "LParens", pattern: /\(/ });
export const RParens = chevrotain.createToken({
  name: "RParens",
  pattern: /\)/,
});
const LSquare = chevrotain.createToken({ name: "LSquare", pattern: /\[/ });
export const RSquare = chevrotain.createToken({
  name: "RSquare",
  pattern: /]/,
});
export const Comma = chevrotain.createToken({ name: "Comma", pattern: /,/ });

/**
 * Expressions cannot use arbitrary variables, everything needs to be access via a context,
 * so define all supported ones.
 * see https://help.github.com/en/actions/reference/context-and-expression-syntax-for-github-actions#contexts
 */
export const Dot = chevrotain.createToken({ name: "Dot", pattern: /\./ });
export const ContextMemberOrKeyword = chevrotain.createToken({
  name: "ContextMemberOrKeyword",
  pattern: chevrotain.Lexer.NA,
});
export const ContextMember = chevrotain.createToken({
  name: "ContextMember",
  pattern: /[a-zA-Z_][a-zA-Z0-9-_]*/,
  categories: ContextMemberOrKeyword,
});
export const Context = chevrotain.createToken({
  name: "Context",
  pattern: chevrotain.Lexer.NA,
  longer_alt: ContextMember,
});
export const Contexts = [
  "github",
  "env",
  "job",
  "steps",
  "runner",
  "secrets",
  "strategy",
  "matrix",
  "needs",
  "inputs",
].map((c) =>
  chevrotain.createToken({
    name: `Context${c}`,
    pattern: new RegExp(`${c}`),
    categories: [Context, ContextMemberOrKeyword],
    longer_alt: ContextMember,
  })
);

//
// Operators
//
export const Operator = chevrotain.createToken({
  name: "Operator",
  pattern: chevrotain.Lexer.NA,
  longer_alt: ContextMember,
});
export const And = chevrotain.createToken({
  name: "And",
  pattern: /&&/,
  categories: Operator,
});
export const Or = chevrotain.createToken({
  name: "Or",
  pattern: /\|\|/,
  categories: Operator,
});
export const Eq = chevrotain.createToken({
  name: "Eq",
  pattern: /==/,
  categories: Operator,
});
export const NEq = chevrotain.createToken({
  name: "NotEq",
  pattern: /!=/,
  categories: Operator,
});
export const LT = chevrotain.createToken({
  name: "LT",
  pattern: /</,
  categories: Operator,
});
export const LTE = chevrotain.createToken({
  name: "LTE",
  pattern: /<=/,
  categories: Operator,
});
export const GT = chevrotain.createToken({
  name: "GT",
  pattern: />/,
  categories: Operator,
});
export const GTE = chevrotain.createToken({
  name: "GTE",
  pattern: />=/,
  categories: Operator,
});
export const Not = chevrotain.createToken({
  name: "Not",
  pattern: /!/,
  categories: Operator,
});

//
// Functions
//
// TODO: Adding all functions as tokens might not be the best idea, but this way we get validation during parsing
export const Function = chevrotain.createToken({
  name: "Function",
  pattern: chevrotain.Lexer.NA,
  longer_alt: ContextMember,
});
export const contains = chevrotain.createToken({
  name: "contains",
  pattern: /contains/i,
  categories: [Function, ContextMemberOrKeyword],
  longer_alt: ContextMember,
});
export const startsWith = chevrotain.createToken({
  name: "startsWith",
  pattern: /startsWith/i,
  categories: [Function, ContextMemberOrKeyword],
  longer_alt: ContextMember,
});
export const endsWith = chevrotain.createToken({
  name: "endsWith",
  pattern: /endsWith/i,
  categories: [Function, ContextMemberOrKeyword],
  longer_alt: ContextMember,
});
export const join = chevrotain.createToken({
  name: "join",
  pattern: /join/i,
  categories: [Function, ContextMemberOrKeyword],
  longer_alt: ContextMember,
});
export const toJSON = chevrotain.createToken({
  name: "toJSON",
  pattern: /toJSON/i,
  categories: [Function, ContextMemberOrKeyword],
  longer_alt: ContextMember,
});
export const fromJSON = chevrotain.createToken({
  name: "fromJSON",
  pattern: /fromJSON/i,
  categories: [Function, ContextMemberOrKeyword],
  longer_alt: ContextMember,
});
export const hashFiles = chevrotain.createToken({
  name: "hashFiles",
  pattern: /hashFiles/i,
  categories: [Function, ContextMemberOrKeyword],
  longer_alt: ContextMember,
});
export const success = chevrotain.createToken({
  name: "success",
  pattern: /success/i,
  categories: [Function, ContextMemberOrKeyword],
  longer_alt: ContextMember,
});
export const always = chevrotain.createToken({
  name: "always",
  pattern: /always/i,
  categories: [Function, ContextMemberOrKeyword],
  longer_alt: ContextMember,
});
export const failure = chevrotain.createToken({
  name: "failure",
  pattern: /failure/i,
  categories: [Function, ContextMemberOrKeyword],
  longer_alt: ContextMember,
});
export const format = chevrotain.createToken({
  name: "format",
  pattern: /format/i,
  categories: [Function, ContextMemberOrKeyword],
  longer_alt: ContextMember,
});
export const cancelled = chevrotain.createToken({
  name: "cancelled",
  pattern: /cancelled/i,
  categories: [Function, ContextMemberOrKeyword],
  longer_alt: ContextMember,
});
const Functions = [
  contains,
  startsWith,
  endsWith,
  join,
  toJSON,
  fromJSON,
  hashFiles,
  success,
  always,
  failure,
  format,
  cancelled,
];

export const StringLiteral = chevrotain.createToken({
  name: "StringLiteral",
  //pattern: /'(:?[^'']|\\(:?[bfnrtv\\/]|u[0-9a-fA-F]{4}))*'/,
  pattern: /'((?:''|[^'])*)'/,
});
export const NumberLiteral = chevrotain.createToken({
  name: "NumberLiteral",
  pattern: /-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/,
});
export const WhiteSpace = chevrotain.createToken({
  name: "WhiteSpace",
  pattern: /[ \t\n\r]+/,
  group: chevrotain.Lexer.SKIPPED,
});

const allTokens = [
  WhiteSpace,
  NumberLiteral,

  // Built-in functions
  Function,
  contains,
  startsWith,
  format,
  endsWith,
  join,
  toJSON,
  fromJSON,
  hashFiles,
  success,
  always,
  cancelled,
  failure,

  StringLiteral,
  LParens,
  RParens,
  LSquare,
  RSquare,
  Comma,

  // Operators
  Operator,
  And,
  Or,
  Eq,
  NEq,
  LTE,
  LT,
  GTE,
  GT,
  Not,

  // Literals
  True,
  False,
  Null,

  // Contexts (github, env, etc.)
  Context,
  ...Contexts,
  Dot,
  ContextMemberOrKeyword,
  ContextMember,
];
const ExpressionLexer = new chevrotain.Lexer(allTokens);

export class ExpressionParser extends chevrotain.CstParser {
  constructor() {
    super(allTokens);
    this.performSelfAnalysis();
  }

  expression = this.RULE("expression", () => {
    //this.OPTION(() => {
    this.SUBRULE1(this.subExpression, { LABEL: "lhs" });
    this.MANY(() => {
      this.CONSUME(Operator);
      this.SUBRULE2(this.subExpression, { LABEL: "rhs" });
    });
    //});
  });

  subExpression = this.RULE("subExpression", () => {
    this.OPTION(() => this.CONSUME(Not));
    this.OR([
      { ALT: () => this.SUBRULE(this.logicalGrouping) },
      { ALT: () => this.SUBRULE(this.functionCall) },
      { ALT: () => this.SUBRULE(this.contextAccess) },
      { ALT: () => this.SUBRULE(this.value) },
      { ALT: () => this.SUBRULE(this.array) },
    ]);
  });

  contextAccess = this.RULE("contextAccess", () => {
    this.OR(
      Contexts.map((f) => ({
        ALT: () => this.CONSUME(f),
      }))
    );

    this.MANY(() => {
      this.SUBRULE(this.contextMember);
    });
  });

  contextMember = this.RULE("contextMember", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.contextDotMember) },
      { ALT: () => this.SUBRULE(this.contextBoxMember) },
    ]);
  });

  contextDotMember = this.RULE("contextDotMember", () => {
    this.CONSUME(Dot);
    this.CONSUME(ContextMemberOrKeyword);
  });

  contextBoxMember = this.RULE("contextBoxMember", () => {
    this.CONSUME(LSquare);
    this.SUBRULE(this.expression);
    this.CONSUME(RSquare);
  });

  array = this.RULE("array", () => {
    this.CONSUME(LSquare);
    this.MANY_SEP({
      SEP: Comma,
      DEF: () => {
        this.SUBRULE(this.subExpression);
      },
    });
    this.CONSUME(RSquare);
  });

  logicalGrouping = this.RULE("logicalGrouping", () => {
    this.CONSUME(LParens);
    this.SUBRULE(this.expression);
    this.CONSUME(RParens);
  });

  functionCall = this.RULE("functionCall", () => {
    this.OR1([
      // fromJSON is the only function that might return an object, and then allow context access
      {
        ALT: () => {
          this.CONSUME(fromJSON);
          this.SUBRULE1(this.functionParameters);
          this.OPTION(() => this.SUBRULE(this.contextMember));
        },
      },
      {
        ALT: () => {
          this.OR2(
            Functions.filter((f) => f !== fromJSON).map((f) => ({
              ALT: () => this.CONSUME(f),
            }))
          );

          this.SUBRULE2(this.functionParameters);
        },
      },
    ]);
  });

  functionParameters = this.RULE("functionParameters", () => {
    this.CONSUME(LParens);
    this.MANY_SEP({
      SEP: Comma,
      DEF: () => {
        this.SUBRULE(this.expression);
      },
    });
    this.CONSUME(RParens);
  });

  value = this.RULE("value", () => {
    this.OR([
      { ALT: () => this.CONSUME(StringLiteral) },
      { ALT: () => this.CONSUME(NumberLiteral) },
      { ALT: () => this.SUBRULE(this.booleanValue) },
      { ALT: () => this.CONSUME(Null) },
    ]);
  });

  booleanValue = this.RULE("booleanValue", () => {
    this.OR([
      { ALT: () => this.CONSUME(True) },
      { ALT: () => this.CONSUME(False) },
    ]);
  });
}

// return {
//   lexer: ExpressionLexer,
//   parser: ExpressionParser,
//   defaultRule: "expression",
// };
// and here to the playground for visualization.
//////////

// reuse the same parser instance.
export const defaultRule = "expression";
export const parser = new ExpressionParser();
export const BaseCstVisitor = parser.getBaseCstVisitorConstructor();
export { ExpressionLexer };
