import { Token } from "./lexer";

export interface ExprVisitor<R> {
  visitLiteral(literal: Literal): R;
  visitUnary(unary: Unary): R;
  visitBinary(binary: Binary): R;
  visitLogical(binary: Logical): R;
  visitGrouping(grouping: Grouping): R;
  visitArray(array: Array): R;
  visitFunctionCall(functionCall: FunctionCall): R;
}

export abstract class Expr {
  abstract accept<R>(v: ExprVisitor<R>): R;
}

export class Literal extends Expr {
  constructor(public literal: string | number | boolean | null) {
    super();
  }

  accept<R>(v: ExprVisitor<R>): R {
    return v.visitLiteral(this);
  }
}

export class Unary extends Expr {
  constructor(public operator: Token, public expr: Expr) {
    super();
  }

  accept<R>(v: ExprVisitor<R>): R {
    return v.visitUnary(this);
  }
}

export class FunctionCall extends Expr {
  constructor(public functionName: Token, public args: Expr[]) {
    super();
  }

  accept<R>(v: ExprVisitor<R>): R {
    return v.visitFunctionCall(this);
  }
}

export class Binary extends Expr {
  constructor(public left: Expr, public operator: Token, public right: Expr) {
    super();
  }

  accept<R>(v: ExprVisitor<R>): R {
    return v.visitBinary(this);
  }
}

export class Logical extends Binary {
  accept<R>(v: ExprVisitor<R>): R {
    return v.visitLogical(this);
  }
}

export class Grouping extends Expr {
  constructor(public inner: Expr) {
    super();
  }

  accept<R>(v: ExprVisitor<R>): R {
    return v.visitGrouping(this);
  }
}

export class Array extends Expr {
  constructor(public elements: Expr[]) {
    super();
  }

  accept<R>(v: ExprVisitor<R>): R {
    return v.visitArray(this);
  }
}
