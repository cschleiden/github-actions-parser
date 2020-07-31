import { getEventPayload } from "../events/eventPayload";
import { ExpressionContext, RuntimeContexts } from "../expressions/evaluator";
import { EnvMap } from "../workflow";
import { Event } from "./runtimeModel";

export function getBaseContext(
  workflow: string,
  event: Event,
  env: EnvMap,
  additionalContexts?: Partial<RuntimeContexts>
): ExpressionContext {
  return {
    contexts: {
      github: {
        token: "thisisasecrettoken",
        job: "first",
        ref: `refs/heads/${("branch" in event && event.branch) || "master"}`,
        sha: "825e127fcace28992b3688a96f78fe4d55e1e145",
        repository: "cschleiden/github-actions-hero",
        repositoryUrl: "git://github.com/cschleiden/github-actions-hero.git",
        run_id: "42",
        run_number: "23",
        actor: "cschleiden",
        workflow,
        head_ref: "825e127fcace28992b3688a96f78fe4d55e1e145",
        base_ref: "",
        event_name: event.event,
        event: getEventPayload(event.event),
      },
      env,
      ...additionalContexts,
    },
  };
}

export function mergeEnv(
  ctx: ExpressionContext,
  env?: EnvMap
): ExpressionContext {
  return {
    ...ctx,
    contexts: {
      ...ctx.contexts,
      env: {
        ...ctx.contexts.env,
        ...env,
      },
    },
  };
}
