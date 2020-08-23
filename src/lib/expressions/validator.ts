import { Diagnostic, Position } from "../../types";
import { iteratePath, PropertyPath } from "../utils/path";
import { iterateExpressions, removeExpressionMarker } from "./embedding";
import { ExpressionContext, ExpressionEvaluator } from "./evaluator";
import { ExpressionLexer, parser } from "./parser";
import { ContextProvider } from "./types";

class ExpressionValidator extends ExpressionEvaluator {
  constructor(
    private contextProvider: ContextProvider,
    private errors: Diagnostic[],
    private pos: Position
  ) {
    super();
  }

  protected getContextValue(contextName: string, path: PropertyPath) {
    const ctx = this.contextProvider.get(contextName as any);

    const value = ctx && iteratePath(path, ctx);
    if (!ctx || value === undefined) {
      this.errors.push({
        message: `Unknown context access: '${contextName}.${path.join(".")}'`,
        pos: this.pos,
      });
    }

    return value;
  }
}

export function validateExpression(
  input: string,
  posOffset: number,
  errors: Diagnostic[],
  contextProvider: ContextProvider
) {
  const expressionPosition: Position = [posOffset, posOffset + input.length];

  input = removeExpressionMarker(input);

  // Check for parser errors
  const lexResult = ExpressionLexer.tokenize(input);
  parser.input = lexResult.tokens;
  if (lexResult.errors.length > 0 || parser.errors.length > 0) {
    errors.push({
      message: "Invalid expression",
      pos: expressionPosition,
    });

    return;
  }

  const cst = parser.expression();

  try {
    const result = new ExpressionValidator(
      contextProvider,
      errors,
      expressionPosition
    ).visit(cst, {} as ExpressionContext);

    // TODO: CS: Should this be invalid?
    if (result === undefined) {
      errors.push({
        message: "Invalid expression",
        pos: expressionPosition,
      });
    }
  } catch {
    errors.push({
      message: "Error evaluating expression",
      pos: expressionPosition,
    });
  }
}

export function validateExpressions(
  input: string,
  posOffset: number,
  errors: Diagnostic[],
  contextProvider: ContextProvider
) {
  iterateExpressions(input, (expr, pos) => {
    validateExpression(expr, posOffset + pos, errors, contextProvider);
  });
}
