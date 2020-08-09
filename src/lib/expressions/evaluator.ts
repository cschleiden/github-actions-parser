import { tokenMatcher } from "chevrotain";
import { iteratePath, PropertyPath } from "../utils/path";
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
import { ContextProvider } from "./types";

export interface ExpressionContext {
  contextProvider: ContextProvider;
}

/**
 * This evaluates an expression by operation on the CST produced by the parser.
 */
export class ExpressionEvaluator extends BaseCstVisitor {
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
    switch (true) {
      case !!ctx.value:
        return this.visit(ctx.value, context);

      case !!ctx.logicalGrouping:
        return this.visit(ctx.logicalGrouping, context);

      case !!ctx.array:
        return this.visit(ctx.array, context);

      case !!ctx.functionCall:
        return this.visit(ctx.functionCall, context);

      case !!ctx.contextAccess:
        return this.visit(ctx.contextAccess, context);
    }
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
    //const p = this._removeQuotes(ctx.StringLiteral[0].image);
    const p = this.visit(ctx.subExpression, context);
    path.push(p);
  }

  logicalGrouping(ctx: any) {
    return this.visit(ctx.expression);
  }

  array(ctx: any) {
    const result = [];

    if (ctx.subExpression) {
      result.push(...ctx.subExpression.map((se) => this.visit(se)));
    }

    return result;
  }

  functionCall(ctx: any, context: ExpressionContext) {
    const parameters = ctx.expression.map((p) => this.visit(p, context));

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

      // TODO: Implement other functions
      // case !!tokenMatcher(f, fromJson):
      //   return Functions.fromJson(parameters[0]);
    }
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
    let result: boolean;

    switch (true) {
      case !!ctx.True:
        result = true;
        break;

      case !!ctx.False:
        result = false;
        break;
    }

    if (!!ctx.Not) {
      result = !result;
    }

    return result;
  }

  private _coerceValue(val: any): any {
    if (typeof val === "number") {
      return val;
    }

    if (typeof val === "string") {
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
