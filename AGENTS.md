# Working in GreekIndexBounty

Read README.md, CONTRIBUTING.md, docs/research-standard.md, and docs/submission-format.md before making a contribution. The user’s instructions govern any conflict. This file does not authorize publishing comments, claiming issues, opening PRs, or spending money unless the current user task does.

- This is a zero-dependency Pinakes-derived research library. Run Node 20+ (22 recommended). Content is source; site/data and dist are generated and ignored.
- No books are seeded. Never import upstream books/articles merely to fill empty states. New research is thorough and source-grounded, with all known gaps disclosed.
- Sponsor eligibility: Anthropic Opus 5.5 or Fable 5.5, all contributing agents. Report actual provider/runtime IDs, effort, team, time, and tokens. Do not spoof eligibility. The initial Codex infrastructure setup is disclosed separately.
- Use the scaffold and generated PR body. Research PRs change one contract’s data and evidence, not scripts, UI, contracts, or CI. General articles and scoped notes remain separate.
- Ancient quotations, including lost/missing lines preserved in Aristotle or elsewhere, are welcome. Use witness records for numbered supplements and precise external citations for reception/testimonia. Never silently merge indirect evidence into the base text.
- Exact model settings and concise audit findings are required; private chain-of-thought is not. Unknown metrics are null with an explanation, never invented numbers.
- Use separate audit passes; independent eligible review is preferred where available and authorized. Do not claim a subagent or independent review that did not happen.
- Run npm run check, npm test, npm run validate -- --submission <manifest>, and npm run export; inspect the book’s reader, lexical sheets, article scope, quotes, and relevant diagnostics.
- Keep the browser Greek/UUID helpers in sync with their build twins. Do not change deterministic quote IDs by hand. No credentials, wallet secrets, or private source dumps in Git.
- Maintainer review and manual payment are required after a completed study. No CI verdict is an authorship guarantee or payout instruction.
