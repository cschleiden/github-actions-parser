import { ExpressionContext } from ".";
import { Position } from "../../types";
import { ValidationError } from "../parser/validator";
import { iteratePath, PropertyPath } from "../utils/path";
import { ExpressionEvaluator } from "./evaluator";
import { ExpressionLexer, parser } from "./parser";
import { ContextProvider } from "./types";

class ExpressionValidator extends ExpressionEvaluator {
  constructor(
    private contextProvider: ContextProvider,
    private errors: ValidationError[],
    private pos: Position
  ) {
    super();
  }

  protected getContextValue(contextName: string, path: PropertyPath) {
    const ctx = this.contextProvider.get(contextName as any);

    if (!ctx || iteratePath(path, ctx) === undefined) {
      this.errors.push({
        message: `Unknown context access: '${contextName}.${path.join(".")}'`,
        pos: this.pos,
      });
    }

    return ctx;
  }
}

export function validateExpression(
  input: string,
  errors: ValidationError[],
  contextProvider: ContextProvider
) {
  // Check for parser errors
  const lexResult = ExpressionLexer.tokenize(input);
  parser.input = lexResult.tokens;
  if (lexResult.errors.length > 0 || parser.errors.length > 0) {
    errors.push({
      message: "Invalid expression",
      pos: [0, input.length],
    });

    return;
  }

  const cst = parser.expression();

  try {
    const result = new ExpressionValidator(contextProvider, errors, [
      0,
      input.length,
    ]).visit(cst, {} as ExpressionContext);

    if (!result) {
      errors.push({
        message: "Invalid expression",
        pos: [0, input.length],
      });
    }
  } catch {
    errors.push({
      message: "Error evaluating expression",
      pos: [0, input.length],
    });
  }
}
