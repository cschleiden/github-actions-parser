import check_run from "../../events/check_run.json";
import check_suite from "../../events/check_suite.json";
import commit_comment from "../../events/commit_comment.json";
import content_reference from "../../events/content_reference.json";
import create from "../../events/create.json";
import deletePayload from "../../events/delete.json";
import deployment from "../../events/deployment.json";
import deployment_status from "../../events/deployment_status.json";
import deploy_key from "../../events/deploy_key.json";
import fork from "../../events/fork.json";
import github_app_authorization from "../../events/github_app_authorization.json";
import gollum from "../../events/gollum.json";
import installation from "../../events/installation.json";
import installation_repositories from "../../events/installation_repositories.json";
import issues from "../../events/issues.json";
import issue_comment from "../../events/issue_comment.json";
import label from "../../events/label.json";
import marketplace_purchase from "../../events/marketplace_purchase.json";
import member from "../../events/member.json";
import membership from "../../events/membership.json";
import meta from "../../events/meta.json";
import milestone from "../../events/milestone.json";
import organization from "../../events/organization.json";
import org_block from "../../events/org_block.json";
import packagePayload from "../../events/package.json";
import page_build from "../../events/page_build.json";
import ping from "../../events/ping.json";
import project from "../../events/project.json";
import project_card from "../../events/project_card.json";
import project_column from "../../events/project_column.json";
import publicPayload from "../../events/public.json";
import pull_request from "../../events/pull_request.json";
import pull_request_review from "../../events/pull_request_review.json";
import pull_request_review_comment from "../../events/pull_request_review_comment.json";
import push from "../../events/push.json";
import release from "../../events/release.json";
import repository from "../../events/repository.json";
import repository_dispatch from "../../events/repository_dispatch.json";
import repository_import from "../../events/repository_import.json";
import repository_vulnerability_alert from "../../events/repository_vulnerability_alert.json";
import security_advisory from "../../events/security_advisory.json";
import sponsorship from "../../events/sponsorship.json";
import star from "../../events/star.json";
import status from "../../events/status.json";
import team from "../../events/team.json";
import team_add from "../../events/team_add.json";
import watch from "../../events/watch.json";
import workflow_dispatch from "../../events/workflow_dispatch.json";
import workflow_run from "../../events/workflow_run.json";
import { mergeDeep } from "../utils/deepMerge";

const eventPayloads = {
  check_run,
  check_suite,
  commit_comment,
  content_reference,
  create,
  delete: deletePayload,
  deploy_key,
  deployment,
  deployment_status,
  fork,
  github_app_authorization,
  gollum,
  installation,
  installation_repositories,
  issue_comment,
  issues,
  label,
  marketplace_purchase,
  member,
  membership,
  meta,
  milestone,
  org_block,
  organization,
  package: packagePayload,
  page_build,
  ping,
  project,
  project_card,
  project_column,
  public: publicPayload,
  pull_request,
  pull_request_review,
  pull_request_review_comment,
  push,
  release,
  repository,
  repository_dispatch,
  repository_import,
  repository_vulnerability_alert,
  security_advisory,
  sponsorship,
  star,
  status,
  team,
  team_add,
  watch,
  workflow_dispatch,
  workflow_run,
};

export function getEventPayload(events: string[]) {
  const payloads = events.map((event) => eventPayloads[event]);
  return mergeDeep({}, ...payloads);
}
