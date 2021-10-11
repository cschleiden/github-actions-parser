import {
  Array,
  Binary,
  Expr,
  ExprVisitor,
  FunctionCall,
  Grouping,
  Literal,
  Logical,
  Unary,
} from "./ast";
import { Pos, Token, TokenType } from "./lexer";

type T = string | number | boolean | null;
type Result = T | T[];

export class RuntimeError extends Error {
  constructor(msg: string, pos?: Pos) {
    super(msg);
  }
}

export interface Environment {
  getContextValue(key: Token): any;
}

export class DefaultEnvironment implements Environment {
  getContextValue(key: Token) {
    // TODO: Does the pos make sense here?
    throw new RuntimeError(`Undefined context access '${key.lexeme}'`, key.pos);
  }
}

export class Evaluator implements ExprVisitor<Result> {
  constructor(private expr: Expr) {}

  evaluate(env: Environment): Result {
    return this.evaluateExpr(this.expr);
  }

  visitLiteral(literal: Literal): Result {
    return literal.literal;
  }

  visitUnary(unary: Unary): Result {
    const value = this.evaluateExpr(unary.expr);

    switch (unary.operator.type) {
      case TokenType.MINUS:
        return -1.0 * (value as number); // TODO: Only accept numbers?

      case TokenType.BANG:
        // TODO: support truthiness
        return !(value as boolean); // TODO: Only accept booleans?
    }

    return null;
  }

  visitFunctionCall(functionCall: FunctionCall): Result {
    switch (functionCall.functionName.lexeme.toLocaleLowerCase()) {
      case "always": {
        this.checkFunctionArguments(0, functionCall);
        return true;
      }

      case "startswith": {
        this.checkFunctionArguments(2, functionCall);

        const stack = this.evaluateExpr(functionCall.args[0]);
        const needle = this.evaluateExpr(functionCall.args[1]);
        return `${stack}`.startsWith(`${needle}`);
      }

      case "endswith": {
        this.checkFunctionArguments(2, functionCall);

        const stack = this.evaluateExpr(functionCall.args[0]);
        const needle = this.evaluateExpr(functionCall.args[1]);
        return `${stack}`.endsWith(`${needle}`);
      }

      case "tojson":
        this.checkFunctionArguments(1, functionCall);

        return JSON.stringify(this.evaluateExpr(functionCall.args[0]));
    }

    throw new RuntimeError(
      `Unexpected function call: ${functionCall.functionName.lexeme}`,
      functionCall.functionName.pos
    );
  }

  private checkFunctionArguments(
    requiredArguments: number,
    functionCall: FunctionCall,
    atLeast: boolean = false
  ) {
    if (requiredArguments != functionCall.args.length) {
      if (!atLeast || requiredArguments > functionCall.args.length) {
        throw new RuntimeError(
          `Unexpected number of arguments for function call ${functionCall.functionName.lexeme}`,
          functionCall.functionName.pos
        );
      }
    }
  }

  visitLogical(logical: Logical): Result {
    let left = this.evaluateExpr(logical.left);
    let right = this.evaluateExpr(logical.right);

    left = coalesceValue(left);
    right = coalesceValue(right);

    switch (logical.operator.type) {
      case TokenType.OR:
        return !!(left || right);

      case TokenType.AND:
        return !!(left && right);
    }

    throw new RuntimeError("Unexpected operator");
  }

  visitBinary(binary: Binary): Result {
    let left = this.evaluateExpr(binary.left);
    let right = this.evaluateExpr(binary.right);

    if (typeof left !== typeof right || left === null || right === null) {
      left = coalesceValue(left);
      right = coalesceValue(right);
    }

    // TODO: coalesce correctly
    switch (binary.operator.type) {
      case TokenType.EQUAL_EQUAL:
        return left == right;

      case TokenType.BANG_EQUAL:
        return left != right;

      case TokenType.LESS:
        return left < right;

      case TokenType.LESS_EQUAL:
        return left <= right;

      case TokenType.GREATER:
        return left > right;

      case TokenType.GREATER_EQUAL:
        return left >= right;
    }

    return null;
  }

  visitGrouping(grouping: Grouping): Result {
    return this.evaluateExpr(grouping.inner);
  }

  visitArray(array: Array): Result {
    return array.elements.map((x) => this.evaluateExpr(x) as T);
  }

  private evaluateExpr(expr: Expr): Result {
    return expr.accept(this);
  }
}

function coalesceValue(value: Result): number {
  switch (true) {
    case typeof value === "number":
      return value as number;

    case value === null:
      return 0;

    case value === true:
      return 1;

    case value === false:
      return 0;

    case typeof value === "string":
      if (value === "") {
        return 0;
      }

      try {
        return parseFloat(value as string);
      } catch {}

    default:
      return NaN;
  }
}
