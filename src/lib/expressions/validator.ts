import { ContextProvider, DynamicContext } from "./types";
import { Diagnostic, Position } from "../../types";
import { ExpressionContext, ExpressionEvaluator } from "./evaluator";
import { ExpressionLexer, parser } from "./parser";
import { PropertyPath, iteratePath } from "../utils/path";
import { iterateExpressions, removeExpressionMarker } from "./embedding";

import { Undetermined } from "./functions";

function iterateContextPath(path: PropertyPath, context: Object): any {
  let dynamicNode = false;

  const result = iteratePath(path, context, (x) => {
    if (x === DynamicContext) {
      dynamicNode = true;
    }
  });

  if (dynamicNode) {
    // We have encountered at least one DynamicContext while iterating. Dynamic contexts
    // are built up at runtime, and we cannot reliably reason about those.
    return Undetermined;
  }

  return result;
}

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

    const value = ctx && iterateContextPath(path, ctx);
    if (!ctx || (value !== Undetermined && value === undefined)) {
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
  diagnostics: Diagnostic[],
  contextProvider: ContextProvider
) {
  const expressionPosition: Position = [posOffset, posOffset + input.length];

  input = removeExpressionMarker(input);

  // Check for parser errors
  const lexResult = ExpressionLexer.tokenize(input);
  parser.input = lexResult.tokens;
  if (lexResult.errors.length > 0) {
    diagnostics.push({
      message: "Invalid expression",
      pos: expressionPosition,
    });

    return;
  }

  const cst = parser.expression();
  if (parser.errors.length > 0) {
    diagnostics.push({
      message: "Invalid expression",
      pos: expressionPosition,
    });

    // console.log(JSON.stringify(parser.errors));

    return;
  }

  try {
    const result = new ExpressionValidator(
      contextProvider,
      diagnostics,
      expressionPosition
    ).visit(cst, {} as ExpressionContext);

    return result;
  } catch (e) {
    console.error(e);

    diagnostics.push({
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
