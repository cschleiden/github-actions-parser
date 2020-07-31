import { tokenMatcher } from "chevrotain";
import { CompletionOption } from "../parser/types";
import { ExpressionContext } from "./evaluator";
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

export async function completeExpression(
  input: string,
  pos: number,
  context: ExpressionContext
): Promise<CompletionOption[]> {
  input = input.substring(0, pos + 1);
  // console.log(input);

  let partialSuggestionMode = false;

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
    if (
      contextToken &&
      tokenMatcher(contextToken, Context) &&
      context.contexts[contextToken.image]
    ) {
      const properties = Object.keys(context.contexts[contextToken.image]);
      return properties
        .filter(
          (x) =>
            searchTerm === "" || (x.startsWith(searchTerm) && x !== searchTerm)
        )
        .map((x) => ({ value: x }));
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
