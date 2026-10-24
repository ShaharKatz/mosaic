// Protocol vocabulary shared by the resolver and its behavioral smoke.
export const OK = 0;
export const STOP = 1;
export const CANNOT_EVALUATE = 2;
export const ORIGIN = "origin";
export const HEAD = "HEAD";
export const NONE = "none";
export const PLAN = "plan";
export const LIGHT = "light";
export const OPEN = "open";
export const MERGED = "merged";
export const RESTACK = "restack";
export const LAND = "land";
export const HISTORY = "history";
export const DECLARATION = "declaration";
export const RETARGET = "retarget";
export const CONFIG_PATH = ".omp/mosaic.json";
export const LINK_REPO = "link-repo";
export const PLAN_DIRECTORY = "docs/plans";
export const ARCHIVED_DIRECTORY = "archived";
export const PLAN_BRANCH_PATTERN = /^task\/(\d{4})-/;
export const subjectPattern = (number: string) => new RegExp(`^(?:(?:fixup!|squash!) )*(?:${number}-T\\d+:|${number}:)`);
export const parentSubjectPattern = (number: string) => new RegExp(`^(?:(?:fixup!|squash!) )*${number}[-:]`);
export const OUTPUT_KEYS = ["branch", "kind", "declared", "parent", "base", "base_ref", "base_sha", "own_pr", "old_tip", "pending", "action", "command"] as const;
export const STOP_REASONS: Record<number, string> = {
  1: "detached HEAD",
  2: "plan branch must have exactly one plan document",
  3: "base fetch failed",
  4: "own pull request lookup failed or ambiguous",
  5: "inherited Base trailer without a branch-owned declaration",
  6: "declared branch without its pull-request number",
  7: "parent lookup failed or does not match an open or default-branch-merged parent",
  8: "own pull request targets neither the resolved base nor the merged parent",
  9: "cannot determine a safe history boundary",
  10: "plan branch contains a foreign commit subject",
};
export const STOP_PREFIX = "stop: ";
export const ERROR_PREFIX = "cannot evaluate: ";
export const COMMAND_TIMEOUT = 120_000;
export const AUTH_ARGS = ["auth", "status"];
export const PR_HEAD_FIELDS = "headRepository,headRepositoryOwner,isCrossRepository";
export const OWN_PR_SUFFIX = ["--state", "open", "--json", `number,baseRefName,${PR_HEAD_FIELDS}`];
export const PARENT_PR_SUFFIX = ["--json", `state,baseRefName,headRefName,headRefOid,mergeCommit,${PR_HEAD_FIELDS}`];
export const FRONTMATTER_ERROR = "unreadable plan frontmatter: ";
export const DECLARATION_TYPE_INVALID = "invalid base or base-pr";
export const FRONTMATTER_NOT_MAPPING = "frontmatter must be a mapping";
export const quote = (value: string): string => /^[A-Za-z0-9_@%+=:,./-]+$/.test(value) ? value : `'${value.replaceAll("'", `'"'"'`)}'`;
export const remoteRef = (branch: string) => `${ORIGIN}/${branch}`;
export const trackingRef = (branch: string) => `refs/remotes/${ORIGIN}/${branch}`;
export const ontoCommand = (ref: string, tip: string, branch: string) => `GIT_EDITOR=true git rebase --onto ${quote(ref)} ${tip} ${quote(branch)}`;
export const restoreCommand = (branch: string, oid: string) => `git update-ref ${quote(trackingRef(branch))} ${quote(oid)}`;
export const recoveryMessage = (branch: string, oid: string) => `${STOP_REASONS[9]}; if ${branch} was not force-pushed after this branch's last restack, restore its ref with \`${restoreCommand(branch, oid)}\` and rerun`;
