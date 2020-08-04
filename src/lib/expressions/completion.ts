import { tokenMatcher } from "chevrotain";
import { WorkflowDocument } from "../parser/parser";
import { CompletionOption } from "../parser/types";
import { PropertyPath } from "../utils/path";
import { getFunctionDescription } from "./functions";
import {
  Context,
  ContextMember,
  defaultRule,
  Dot,
  ExpressionLexer,
  Function,
  parser,
} from "./parser";

export interface ExpressionContextCompletion {
  completeContext(
    context: string,
    doc: WorkflowDocument,
    path: PropertyPath
  ): Promise<CompletionOption[]>;
}

export function inExpression(input: string, pos: number) {
  return input.substring(0, pos).indexOf("${{") !== -1;
}

export async function completeExpression(
  input: string,
  pos: number,
  doc: WorkflowDocument,
  path: PropertyPath,
  completer: ExpressionContextCompletion
): Promise<CompletionOption[]> {
  input = input.substring(0, pos + 1);
  // console.log(input);

  const lexResult = ExpressionLexer.tokenize(input);
  if (lexResult.errors.length > 0) {
    throw new Error("sad sad panda, lexing errors detected");
  }
  let partialTokenVector = lexResult.tokens;
  if (!partialTokenVector || partialTokenVector.length === 0) {
    // Nothing to suggest in this case, abort
    return [];
  }

  const lastInputToken = partialTokenVector[partialTokenVector.length - 1];

  // Check if we are auto-completing a context access
  if (
    tokenMatcher(lastInputToken, ContextMember) ||
    (tokenMatcher(lastInputToken, Dot) &&
      tokenMatcher(partialTokenVector[partialTokenVector.length - 2], Context))
  ) {
    // Determine previous context
    const searchTerm = tokenMatcher(lastInputToken, Dot)
      ? ""
      : lastInputToken.image;

    const contextToken = tokenMatcher(lastInputToken, Dot)
      ? partialTokenVector[partialTokenVector.length - 2]
      : partialTokenVector[partialTokenVector.length - 3];
    if (contextToken && tokenMatcher(contextToken, Context)) {
      const options = await completer.completeContext(
        contextToken.image,
        doc,
        path
      );

      options.sort((a, b) => a.value.localeCompare(b.value));

      return options.filter(
        (x) =>
          !searchTerm ||
          (x.value.startsWith(searchTerm) && x.value !== searchTerm)
      );
    }
  }

  // Check for auto-completing a context or a function
  if (lastInputToken !== undefined) {
    partialTokenVector = partialTokenVector.slice(0, -1);
    const syntacticSuggestions = parser.computeContentAssist(
      defaultRule,
      partialTokenVector
    );

    const searchTerm = lastInputToken.image;
    return syntacticSuggestions
      .filter((x) => {
        return (
          Function.categoryMatchesMap[x.nextTokenType.tokenTypeIdx] ||
          Context.categoryMatchesMap[x.nextTokenType.tokenTypeIdx]
        );
      })
      .map((x) => (x.nextTokenType.PATTERN as RegExp).source)
      .filter((x) => !searchTerm || x.startsWith(searchTerm))
      .map((x) => ({
        value: x,
        description: getFunctionDescription(x),
      }));
  }

  return [];
}
