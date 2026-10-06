# Submission format v1

`scripts/lib/submission.mjs` creates the manifest; `scripts/validate.mjs` validates it. Use `npm run submission -- init <bounty-id>` so keys, paths, and run identity are consistent. One newly added `submissions/<UUID>.json` belongs to each PR. It is a disclosure, not model attestation by a trusted third party.

## Manifest fields

| Field | Required meaning |
| --- | --- |
| schemaVersion | Integer `1`; incompatible future changes need a versioned migration |
| submissionId | UUID v4; matches filename; never reused for a different PR |
| type | `research` or `infrastructure` |
| bountyId | Registered unit such as `iliad-01`; `null` for infrastructure |
| scope | `{author, work, unit, citationScheme}`; must exactly match the contract; `null` for infrastructure |
| status | `draft` while incomplete, `complete` for acceptance |
| agents | Full roster of contributing models, with one `role: "lead"`; helpers get specific roles |
| subagentCount | `agents.length - 1`; include every actual writing/review agent, including failed/restarted runs that contributed work |
| usage | Timestamps, wall time, aggregate metrics, measurement source, unavailable-metric explanation |
| provenance | Authorship statement, nonempty list of evidence paths, evidence limitations |
| completeness | Honest percent, translated line count, analyzed token count, reviewed line count, remaining-gap list |
| research | Paths to the four ledgers and an array of audit records; `null` for infrastructure |
| changes | Concise account of what changed and why |
| validation | Array of `{command, result: "passed", log}` with committed log paths |
| payout | `{method: "arrange-after-acceptance", contact: "public GitHub handle"}`; no private payment credentials |

### Each agent

Record `id`, `role`, `provider: "Anthropic"`, `modelName` (exact policy label), `modelId` (exact API/runtime identifier), `runtime`, `runtimeVersion`, `sessionId`, `reasoningEffort`, `thinkingMode`, `thinkingBudgetTokens`, `metrics`, and `unavailableReason`.

Copy runtime settings exactly. If no user-facing effort control exists, write `not-exposed` and explain it; do not translate another vendor’s terminology into an invented setting. `thinkingBudgetTokens` is a nonnegative integer or `null`. It describes the configured budget, not hidden thoughts. Do not disclose private reasoning traces. Prompts, tool actions, concise audit findings, and exported usage are sufficient.

Each `metrics` object contains `inputTokens`, `outputTokens`, `cacheReadTokens`, `cacheWriteTokens`, `agentSeconds`, `costUsd`. Counters/time are nonnegative integers or `null`; cost is a nonnegative number or `null`. Record the provider’s accounting convention (for example, whether cache reads are already included in input tokens). Do not add overlapping categories and call that a new total. Record any noncontributing failed compute in the usage evidence and explain accounting boundaries; do not hide it.

### Usage and provenance

`usage.startedAt` and `finishedAt` are real ISO timestamps; `wallSeconds` is their difference, rounded to seconds. Wall time includes the full elapsed interval, including breaks; it is not summed worker time. `agentSeconds` sums measured agent durations and may exceed wall time when workers overlap. Aggregate each metric across the roster. If any agent’s metric is unavailable, aggregate that metric as `null` and explain what is missing. Never turn “unavailable” into zero or a false exact estimate.

`usage.measurementSource` names a committed text/JSON/Markdown export or accounting report. This is required even if some counts are unavailable: explain the runtime’s limits and include what it did report. `provenance.evidenceFiles` should include redacted runtime headers/configuration/usage exports showing the actual model IDs, settings, sessions, and dates. Make limitations explicit: screenshots and text logs can be edited, and API display names alone are not independent proof. CI cannot authenticate them; reviewers assess consistency and credibility.

Infrastructure submissions keep research counts at zero and provide engineering-specific tests and evidence. They may not include book/index research in order to escape its scope checks.

## Research ledgers

All files belong under `research/<bounty-id>/<submissionId>/`. They start empty and cannot pass acceptance until populated.

- `coverage.json`: array of `{from, to, translationReviewed, lexiconReviewed, indexReviewed, researchReviewed, entryIds, note}`. Blocks span at most 25 numbered positions, use existing endpoints, and cover every submitted source line once. Review flags must be true for a complete submission. Notes describe actual work; IDs resolve to researched articles. Restored lines count too.
- `sources.json`: array of `{id, kind, title, url, locator, accessedAt, access, rights, finding, entryIds}`. `kind` must include primary, lexical, and scholarship across the ledger. `access` is `consulted`; `accessedAt` is `YYYY-MM-DD`. Preserve exact page/section references, the useful finding, and where it is used. More types such as indirect-witness or material-evidence are welcome. Record unconsulted leads and research limitations in the narrative evidence, not as consulted records.
- `candidates.json`: array of `{title, kind, lines, disposition, entryId, reason}`. `lines` uses integer IDs in this unit. `disposition` is created, expanded, covered, or omitted. All except omitted require a researched target entry. Reasons explain the editorial choice. Add all discovered candidates, not a selection that flatters completeness.
- `categories.json`: exactly one `{kind, status, explanation, entryIds}` for every kind in `content/kinds.json`. `status` is reviewed or not-applicable. Explain absences. An absent category lists no entries.

`research.audits` contains records with `{kind, agentId, method, report, result, issuesFound, issuesResolved}`. Required kinds: translation, lexicon, index, sources, integration. Method: independent-agent or separate-pass. An independent-agent record cannot name the lead. The agent must appear in the roster; reports must exist. A passed audit resolves every issue it found. Reports describe scope, findings, corrected files/lines, unresolved scholarly uncertainty, and the post-fix result.

Supplements use `content/library/<author>/<work>/witnesses/NN.json`; see [the research standard](research-standard.md#indirect-witnesses-and-missing-lines). Source-file coverage totals are 15,687 for the full base Iliad and increase with declared supplements. Neither 15,693 nor a page’s final line number is blindly substituted for actual coverage.

## PR body and trust boundary

`npm run --silent pr:body -- submissions/<UUID>.json` prints the prose summary plus exactly one marker:

```html
<!-- greek-index-bounty: submissions/<UUID>.json -->
```

The marker points to the authoritative manifest in the proposed tree. The summary shows model/runtime/effort, team size, elapsed and aggregate time, token/cache/cost metrics, completion counts, gaps, provenance, and checks. Review the manifest for full details and revisions. Do not replace it with a free-text “written by Claude.”

The policy workflow checks out trusted base code separately from proposed content, uses a read-only token, persists no checkout credentials, and never runs proposed scripts. It checks the base policy, base unit contracts, changed-file boundary, manifest marker, all artifacts, and strict content coverage. Modifying a policy file inside the proposed PR cannot make that PR newly eligible. Ordinary build CI is separate and has no deployment credentials. The final acceptance is a maintainer’s scholarly and provenance review.
