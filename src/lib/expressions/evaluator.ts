import * as Functions from "./functions";

import {
  And,
  BaseCstVisitor,
  Contexts,
  Eq,
  GT,
  GTE,
  LT,
  LTE,
  NEq,
  Or,
} from "./parser";
import { PropertyPath, iteratePath } from "../utils/path";

import { ContextProvider } from "./types";
import { tokenMatcher } from "chevrotain";

export interface ExpressionContext {
  contextProvider: ContextProvider;
}

/**
 * This evaluates an expression by operation on the CST produced by the parser.
 */
export class ExpressionEvaluator extends BaseCstVisitor {
  constructor() {
    super();

    this.validateVisitor();
  }

  expression(ctx: any, context: ExpressionContext) {
    let result = this.visit(ctx.lhs, context);

    if (ctx.rhs) {
      ctx.rhs.forEach((rhsOperand, idx) => {
        let rhsResult = this.visit(rhsOperand, context);
        const operator = ctx.Operator[idx];

        // Coerce types
        if (typeof result != typeof rhsResult) {
          result = this._coerceValue(result);
          rhsResult = this._coerceValue(rhsResult);
        }

        switch (true) {
          // ==
          case tokenMatcher(operator, Eq):
            result = result == rhsResult;
            break;

          // !=
          case tokenMatcher(operator, NEq):
            result = result != rhsResult;
            break;

          // &&
          case tokenMatcher(operator, And):
            result = result && rhsResult;
            break;

          // ||
          case tokenMatcher(operator, Or):
            result = result || rhsResult;
            break;

          // <
          case tokenMatcher(operator, LT):
            result = result < rhsResult;
            break;

          // <=
          case tokenMatcher(operator, LTE):
            result = result <= rhsResult;
            break;

          // >
          case tokenMatcher(operator, GT):
            result = result > rhsResult;
            break;

          // >=
          case tokenMatcher(operator, GTE):
            result = result >= rhsResult;
            break;
        }
      });
    }

    return result;
  }

  subExpression(ctx: any, context: ExpressionContext) {
    let result: any;

    switch (true) {
      case !!ctx.value:
        result = this.visit(ctx.value, context);
        break;

      case !!ctx.logicalGrouping:
        result = this.visit(ctx.logicalGrouping, context);
        break;

      case !!ctx.array:
        result = this.visit(ctx.array, context);
        break;

      case !!ctx.functionCall:
        result = this.visit(ctx.functionCall, context);
        break;

      case !!ctx.contextAccess:
        result = this.visit(ctx.contextAccess, context);
        break;
    }

    if (!!ctx.Not) {
      result = !result;
    }

    return result;
  }

  contextAccess(ctx: any, context: ExpressionContext) {
    const contextName = Contexts.map((c) => (c.PATTERN as RegExp).source).find(
      (c) => !!ctx[`Context${c}`]
    );
    if (!contextName) {
      throw new Error("Unknown context: " + contextName);
    }

    // Aggregate path
    const p: PropertyPath = [];
    if (!!ctx.contextMember) {
      for (const cM of ctx.contextMember as any[]) {
        this.visit(cM, { path: p, context });
      }
    }

    const r = this.getContextValue(contextName, p, context);
    return r;
  }

  protected getContextValue(
    contextName: string,
    path: PropertyPath,
    context: ExpressionContext
  ) {
    const contextObject = context.contextProvider.get(contextName as any);
    const result = iteratePath(path, contextObject);

    return result || "";
  }

  contextMember(
    ctx: any,
    { path, context }: { path: PropertyPath; context: ExpressionContext }
  ) {
    switch (true) {
      case !!ctx.contextDotMember:
        return this.visit(ctx.contextDotMember, path);

      case !!ctx.contextBoxMember:
        return this.visit(ctx.contextBoxMember, { path, context });
    }
  }

  contextDotMember(ctx: any, path: PropertyPath) {
    const p = ctx.ContextMember[0].image;
    path.push(p);
  }

  contextBoxMember(
    ctx: any,
    { path, context }: { path: PropertyPath; context: ExpressionContext }
  ) {
    const p = this.visit(ctx.expression, context);
    path.push(this._coerceValue(p, true));
  }

  logicalGrouping(ctx: any) {
    return this.visit(ctx.expression);
  }

  array(ctx: any) {
    const result: any[] = [];

    if (ctx.subExpression) {
      result.push(...ctx.subExpression.map((se) => this.visit(se)));
    }

    return result;
  }

  functionCall(ctx: any, context: ExpressionContext) {
    const parameters = this.visit(ctx.functionParameters, context);

    switch (true) {
      case !!ctx.contains:
        return Functions.contains(parameters[0], parameters[1]);

      case !!ctx.startsWith:
        return Functions.startsWith(parameters[0], parameters[1]);

      case !!ctx.endsWith:
        return Functions.endsWith(parameters[0], parameters[1]);

      case !!ctx.join:
        return Functions.join(parameters[0], parameters[1]);

      case !!ctx.toJson:
        return Functions.toJson(parameters[0]);

      case !!ctx.fromJson: {
        const result = Functions.fromJson(parameters[0]);

        if (!!ctx.contextMember) {
          const p: PropertyPath = [];
          for (const cM of ctx.contextMember as any[]) {
            this.visit(cM, { path: p, context });
          }
          return iteratePath(p, result);
        }

        return result;
      }

      case !!ctx.hashFiles:
        return Functions.hashFiles(parameters);

      case !!ctx.format:
        return Functions.format(parameters[0], ...parameters.slice(1));

      case !!ctx.always:
        return Functions.always();

      case !!ctx.failure:
        return Functions.failure();

      case !!ctx.success:
        return Functions.success();

      case !!ctx.cancelled:
        return Functions.cancelled();
    }

    return undefined;
  }

  functionParameters(ctx: any, context: ExpressionContext) {
    return (ctx.expression || []).map((p) => this.visit(p, context));
  }

  value(ctx: any) {
    switch (true) {
      case !!ctx.NumberLiteral:
        return parseFloat(ctx.NumberLiteral[0].image);

      case !!ctx.booleanValue:
        return this.visit(ctx.booleanValue);

      case !!ctx.Null:
        return null;

      case !!ctx.StringLiteral: {
        const value: string = ctx.StringLiteral[0].image;
        return this._removeQuotes(value);
      }
    }
  }

  booleanValue(ctx: any) {
    switch (true) {
      case !!ctx.True:
        return true;

      default:
      case !!ctx.False:
        return false;
    }
  }

  private _coerceValue(
    val: number | string | boolean | null,
    keepString = false
  ): number | string {
    if (typeof val === "number") {
      return val;
    }

    if (typeof val === "string") {
      if (keepString) {
        return val;
      }

      if (val === "") {
        return 0;
      }

      return +val;
    }

    if (val === null) {
      return 0;
    }

    if (val === true) {
      return 1;
    }

    if (val === false) {
      return 0;
    }

    return NaN;
  }

  private _removeQuotes(value: string): string {
    return "" + value.substring(1, value.length - 1).replace(/''/g, "'");
  }
}

export const evaluator = new ExpressionEvaluator();
