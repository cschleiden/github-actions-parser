export const expressionMarker = /\$\{\{(.*?)\}\}/gm;

export function containsExpression(input: string): boolean {
  return input?.match && input.match(expressionMarker) !== null;
}

export function removeExpressionMarker(input: string): string {
  return input.replace(expressionMarker, (_, g) => g);
}

export function iterateExpressions(
  input: string,
  f: (expression: string, pos: number, length: number) => void
) {
  for (const match of Array.from(input.matchAll(expressionMarker))) {
    f(match[0], match.index, match.length);
  }
}
