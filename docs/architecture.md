# Pinakes architecture and this adaptation

Baseline: `mazebench-temp/Pinakes`, commit `1fbdffa86c1db12b4acdfb61412cb4be76aec9a5`, inspected with local working-tree documentation. The source checkout had ongoing content changes and was left untouched. See [PROVENANCE.md](../PROVENANCE.md).

| Layer | Pinakes behavior retained | GreekIndexBounty changes |
| --- | --- | --- |
| Storage | Author/work JSON; Greek/English numbered rows; JSON lexical/structure data; Markdown articles and author/work/book notes | Starts empty; source inventories and isolated per-run evidence |
| Build | No npm dependencies; front matter, Markdown, quotes, concordance, relations, backlinks, report | Project branding; bounty data; indirect-witness metadata in lines and quotes |
| Citations | `book.line`, work aliases, deterministic quote UUIDs | Same UUID namespace for compatibility; documented supplements, explicit future citation adapters |
| Reader | Aligned Greek/English, layout/size choices, word and line sheets, speakers, scenes, progress, quotes | New project identity; witness labels; truthful initial empty state |
| Browsing | Article scope remembered across views; index, myth timeline, nested tags, text/lexicon search | All seed tags visible even before use; no dead “read undefined” links |
| Export | Static files, lazy book JSON, hashed article chunks | GitHub Pages publication after verification |
| Contribution | Hand-authored data plus lexical and concordance tools | Scaffold command, versioned manifest, generated PR body, scope gate, full evidence checks |
| Eligibility | No bounty gate | Sponsor’s exact Opus 5.5 / Fable 5.5 policy, evidence review, manual acceptance/payment |

Generated `site/data/` and `dist/` are ignored. The corpus remains the source of truth. Existing Markdown/quote formats continue to work; general articles stay separate from scoped notes. The quote registry is empty at launch, and unit tests use tiny isolated strings rather than installing a test book in the catalogue.

The base branch’s policy validator reads proposed files without executing contributor code. A research PR cannot modify its own policy/scripts, submit unrelated books, or rewrite previous manifests. Infrastructure work is separately scoped and still requires provenance. Branch protection prevents a passing ordinary build from replacing the submission-policy requirement.

Performance constraints are explicit: concordance building currently scans every accepted text against entry patterns; catalogue metadata is loaded together; text search can load the entire available corpus; export targets approximately 3 MB article buckets but skew can exceed that target. Profile before large imports, and add indexed search/sharding or incremental builds when measurements justify it. The initial zero-book build is not a stress test.
