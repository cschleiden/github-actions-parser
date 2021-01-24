import {
  Context,
  ContextMember,
  Dot,
  ExpressionLexer,
  Function,
  defaultRule,
  parser,
} from "./parser";
import { PropertyPath, iteratePath } from "../utils/path";

import { CompletionOption } from "../../types";
import { ContextProvider } from "./types";
import { getFunctionDescription } from "./functions";
import { tokenMatcher } from "chevrotain";

export function inExpression(input: string, pos: number) {
  return input.substring(0, pos).indexOf("${{") !== -1;
}

export async function completeExpression(
  input: string,
  pos: number,
  contextProvider: ContextProvider
): Promise<CompletionOption[]> {
  input = input.substring(0, pos + 1);
  // console.log(input);

  const lexResult = ExpressionLexer.tokenize(input);
  if (lexResult.errors.length > 0) {
    return [];
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
      (tokenMatcher(
        partialTokenVector[partialTokenVector.length - 2],
        Context
      ) ||
        tokenMatcher(
          partialTokenVector[partialTokenVector.length - 2],
          ContextMember
        )))
  ) {
    // Determine previous context
    const searchTerm = tokenMatcher(lastInputToken, Dot)
      ? ""
      : lastInputToken.image;

    // Get context access path
    let contextName: string | undefined;
    let path: PropertyPath = [];
    for (let i = partialTokenVector.length - 1; i >= 0; --i) {
      if (tokenMatcher(partialTokenVector[i], Dot)) {
        // Ignore .
      } else {
        if (tokenMatcher(partialTokenVector[i], ContextMember)) {
          path.push(partialTokenVector[i].image);
        } else if (tokenMatcher(partialTokenVector[i], Context)) {
          contextName = partialTokenVector[i].image;
        } else {
          break;
        }
      }
    }

    // We iterate over the token vector backwards, so reverse the path for the
    // actual context access
    path = path.reverse();

    if (contextName) {
      const context = contextProvider.get(contextName as any);
      const obj = iteratePath(
        path[path.length - 1] === searchTerm
          ? path.slice(0, path.length - 1)
          : path,
        context
      );
      const options = Object.keys(obj).map((x) => ({ value: x }));
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
          Function.categoryMatchesMap?.[x.nextTokenType.tokenTypeIdx!] ||
          Context.categoryMatchesMap?.[x.nextTokenType.tokenTypeIdx!]
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
