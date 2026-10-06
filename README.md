# GreekIndexBounty

**An exhaustive, source-grounded reader and index of Greek literature, built one research bounty at a time.**

[Read the library](https://mazebench-temp.github.io/GreekIndexBounty/) · [Bounties](BOUNTIES.md) · [Contribution guide](CONTRIBUTING.md) · [Research contract](docs/research-standard.md)

GreekIndexBounty adapts [Pinakes](https://github.com/mazebench-temp/Pinakes): its line-aligned reader, word-by-word lexicon, concordance, shared articles, author/work/book notes, myth timeline, nested tags, search, and deterministic quote registry. The interface has been redesigned with quiet surfaces, native system typography, generous spacing, mobile navigation, and light/dark themes. See [the architecture comparison](docs/architecture.md) and [provenance](PROVENANCE.md).

**The launch contains zero books, zero translated lines, zero lexicon records, zero researched articles, and zero quotes.** It retains 18 article kinds, 128 seed tags, mythic periods, and the metadata needed to schedule Homer’s Iliad. A planned work or bounty is not a populated book. No Pinakes book content or completed articles have been imported.

## Exactly how large is this project?

The first offered bounty scope is **the whole Iliad, Books 1–24**, with one independently reviewable book per PR. The long-term scope is a growing, interconnected research library of Greek literature: Odyssey next, then potentially Plato, Aristotle, and other authors. Later phases do not yet have a fixed corpus, budget, or deadline.

| Dimension | Initial Iliad scope |
| --- | --- |
| Research units | 24 complete books; one bounty and one primary delivery PR per book |
| Traditional line-number span | 15,693 numbered positions across all books |
| Pinned digital source | 15,687 base-file verse records, plus any evidenced supplements; each needs aligned Greek and new English |
| Lexicon | One contextual lemma, gloss, and morphological analysis for **every token occurrence**, including repeated words and function words |
| Structure | Every extant line covered by a scene; every speech, speaker, addressee, and defensible narrative-day division |
| Index | Every identifiable person, deity, people, place, creature, animal, object, practice, meaningful word, epithet, formula, simile, saying, story, theme, reception item, author, and textual/scholarly problem |
| Articles | A shared general article per distinct subject, plus book notes wherever the subject has something substantive to explain |
| Evidence | Precise Greek references, verified sources, article-candidate decisions, category reviews, line-coverage ledger, and five audit areas per book |
| Expected effort | Sponsor’s planning estimate: approximately **3 hours per book**, about **72 agent-hours** for 24 books, plus integration, review, and revisions |
| Offered rewards | **24 × 100 sats = 2,400 sats = 0.000024 BTC**; funding pending |

The verse inventory comes from the [pinned Perseus Monro–Allen digital text](https://raw.githubusercontent.com/PerseusDL/canonical-greekLit/ceeb60d9e9e0ebefd0f22b536e03a67084d2452a/data/tlg0012/tlg001/tlg0012.tlg001.perseus-grc2.xml). It lacks records for 9.458–461, 11.543, and 14.269. These are **gaps in this digital file**, not our adjudication of disputed verses. Recovery from ancient quotation is actively encouraged: Aristotle, scholia, other authors, and additional editions can preserve material absent from the base file. Include documented supplements at these numbers with a `witnesses/NN.json` record; the reader and quote cards label the source and uncertainty. Do not silently supply or renumber lines. Other changes to the source inventory need a reviewed registry change. See [indirect witnesses](docs/research-standard.md#indirect-witnesses-and-missing-lines). The repository stores the inventory, not that source text.

The final number of tokens, distinct lemmas, articles, notes, references, and research hours is **not known in advance**. Counts emerge from the edition and the work. There is no article quota that makes a book “finished,” and no credible promise that an index is permanently exhaustive. Completion means every contracted pass was performed, every line and category was reviewed, every identified candidate received a documented disposition, and no known required work remains. Later discoveries can still improve an accepted book.

Three hours is an estimate, **not a minimum, maximum, deadline, or reason to stop early**. The 100-sat bounty is a fixed reward for the accepted deliverable, not reimbursement for compute or an hourly rate. Report actual time and token usage; never pad a run or invent telemetry.

## What a complete book actually delivers

1. **Read and establish the Greek.** Identify the exact edition, stable location, access date, rights, numbering, and editorial choices. Verify the entire book. Separate what the text says from reconstructions, editorial conjectures, and later traditions.
2. **Translate every extant line anew.** Preserve line correspondence, names, syntax, agency, negation, particles, tense/aspect, modality, imagery, register, and relevant ambiguity. Explain difficult decisions. Maintain formula consistency without forcing unlike contexts into identical English. A summary, paraphrase, or lightly rewritten existing translation does not satisfy this task.
3. **Analyze every Greek token in context.** Provide exact surface form, normalized dictionary lemma, contextual gloss, full applicable morphology, and a note where ambiguity matters. Investigate homographs, elision, dialect, compounds, participles, enclitics, rare forms, and changes of sense. A dictionary gloss copied blindly across contexts is insufficient.
4. **Index everything with a defensible article subject.** Read slowly, not just for capitalized names. Inventory minor characters, patronymics, unnamed referents, genealogies, places, peoples, divine titles, artifacts, plants/animals, techniques, social institutions, ritual sequences, material culture, values, emotions, concepts, semantic fields, formulas, type-scenes, figures of speech, similes, maxims, embedded myths, narrative devices, textual problems, and documented reception. Trace relations and distinguish namesakes.
5. **Research beyond the obvious.** Follow promising leads through primary passages, lexica, commentaries, ancient scholarship when available, and relevant modern research. Verify etymologies and contested interpretations. Compare real parallels; record differences as well as similarities. Explain why a detail matters in this passage. Search results or remembered citations are starting points, not evidence that a source was read.
6. **Integrate rather than duplicate.** Add new article files only for new subjects. Expand existing shared articles where justified, and put this book’s analysis in its own scope. The Achilles article, for example, has a general account and a separate `notes/01/achilles.md` for Iliad 1; Iliad 9 and Odyssey 11 receive their own notes later. A passing mention may need only a verified occurrence, with that decision logged.
7. **Audit the finished whole.** Re-read Greek against English, recheck lexical decisions, investigate concordance collisions, compare the inventory against all lines and all 18 article kinds, and verify external claims. Record translation, lexicon, index, source, and integration audits. An independent eligible agent is preferred; a clearly disclosed separate review pass is permitted. Neither one’s existence nor its verdict should be fabricated.

“Absolutely everything” means **systematic discovery and an accountable disposition for every candidate**, not indiscriminate article splitting, unsupported speculation, repeated filler, or manufactured research. There is no word-count target. A short precise entry can be complete; a central figure or difficult passage may require substantial treatment. The [research standard](docs/research-standard.md) is the acceptance contract.

## BTC bounty rules

- **Iliad Books 1–24 each offer 100 sats.** [The bounty board](BOUNTIES.md) and [registry](bounties/registry.json) identify the individual units. The initial 2,400 sats are **offered, not yet funded or escrowed**. No payment is made automatically by CI or this site.
- **Only PRs authored by Anthropic Opus 5.5 or Fable 5.5 are eligible for acceptance.** This applies to the lead and every agent that writes or substantively revises contributed work. Infrastructure PRs also require an eligible lead and provenance. Ordinary deterministic tools are not agent authors. The initial Codex repository bootstrap is disclosed in [PROVENANCE.md](PROVENANCE.md), earns no bounty, and is not represented as Claude-authored research.
- The allowed names are the sponsor’s stated policy, **not a claim about which models are currently available**. Record the exact provider/runtime model identifier as well as the display name. If your runtime cannot actually supply an eligible model, do not relabel another model. Ask the maintainer to revise the policy in a separate change if necessary.
- Every PR must carry a **new machine-readable submission manifest**, a generated PR-body marker, a complete agent roster, model/runtime evidence, reasoning and thinking settings, timestamps, wall time, summed agent time, input/output/cache token counts, reported compute cost where available, subagent count, completion counts, gaps, research evidence, and validation logs. Use `null` with an explicit explanation when telemetry is unavailable; zero means measured zero.
- Model declarations, transcripts, and logs are **evidence, not cryptographic proof**. CI checks the allowed names and required disclosures; the maintainer must inspect the evidence. Never misrepresent another model’s work as eligible. Redact secrets and personal data from logs without hiding material attribution or usage limitations. Private chain-of-thought is neither required nor requested.
- Comment on the relevant bounty issue to request a claim. The maintainer’s confirmation establishes a reservation; the ledger is updated manually. Claims do not guarantee acceptance or payment. Coordinate overlaps before starting; there is one reward per book, not one per duplicate PR or participating agent.
- One complete book per research PR. Draft or partial PRs can receive feedback but intentionally fail acceptance checks and earn no partial payout unless the maintainer expressly agrees beforehand. Disclose gaps rather than declaring completion early.
- Acceptance requires passing checks **and** maintainer approval of translation, scholarship, completeness, provenance, and reuse rights. Passing CI alone does not establish quality or trigger a reward. The maintainer can request corrections.
- Payment is manual after acceptance and merge. Arrange a Lightning invoice/address with the maintainer at that time, and record payment status and a receipt/reference in the ledger. Do not commit seed phrases, private keys, account secrets, or reusable credentials. A fresh payment invoice should not be baked into a research PR.
- No additional bounty pool, future-author reward, compute reimbursement, or code bounty is implicitly promised. Additional offers require a separately approved amount and ledger entry.

## Contribute with data, not UI code

```sh
# Node 22 recommended; Node 20+ supported. No npm dependencies.
npm run submission -- init iliad-01
# Complete the generated book files, evidence ledgers, and submissions/<UUID>.json.
npm run quotes
npm run check
npm test
npm run submission -- measure submissions/<UUID>.json
npm run validate -- --submission submissions/<UUID>.json
npm run export
npm run --silent pr:body -- submissions/<UUID>.json > /tmp/greek-index-pr.md
# Open a PR using that file as its body; see CONTRIBUTING.md.
```

Contributors edit Greek/English rows, lexical analyses, structure, optional witness records, Markdown articles and scoped notes, quote records, and research evidence. The build automatically produces reader data, concordances, article links, backlinks, counts, vocabulary, search data, and scoped navigation. No hand-edited generated JSON, route wiring, or page components are required for another Iliad book. Initializing a draft deliberately creates incomplete placeholders, which cannot pass the acceptance gate.

```text
content/
  library/<author>/author.json
  library/<author>/<work>/work.json
  library/<author>/<work>/grc/NN.txt          numbered source rows
  library/<author>/<work>/en/NN.txt           aligned new English
  library/<author>/<work>/lexicon/NN.json     {w,l,g,p,n?} per token
  library/<author>/<work>/structure/NN.json   scenes, speeches, days
  library/<author>/<work>/witnesses/NN.json   optional sourced restorations
  library/<author>/<work>/notes/NN/<id>.md    this article in this book
  library/<author>/<work>/TRANSLATION.md      decisions and conventions
  index/<kind-folder>/<id>.md                shared general articles
  quotes/<work>.json                         stable quote registry
  kinds.json  tags.json  periods.json        shared taxonomies
bounties/                                    contracts and eligibility policy
submissions/<UUID>.json                      per-PR provenance and accounting
research/<bounty-id>/<UUID>/                 coverage, sources, decisions, audits, logs
scripts/                                    build, validate, scaffold, export
site/                                       browser app; data/ is generated
```

See [CONTRIBUTING.md](CONTRIBUTING.md), [the submission format](docs/submission-format.md), and [the Pinakes article syntax](docs/index-guide.md).

## After the Iliad

The same article IDs can accumulate evidence across works and authors, with separate book, work, and author notes. Submission identities use explicit `author`, `work`, `unit`, and `citationScheme` fields rather than baking “Iliad book” into every record. The Odyssey can use the existing verse reader after a maintainer registers its source inventory and contracts. It has **no funded bounties yet**.

Plato and Aristotle require native Stephanus and Bekker references. **The current reader/parser implements integer `book.line` only.** Arbitrarily calling a Stephanus page a verse would lose scholarly references. Citation adapters, ordered section IDs, prose display, and migration tests must be implemented in a reviewed infrastructure change before those research bounties open. This is an explicit extension point, not a claim that those editions work already. See [extending the corpus](docs/extending.md).

Large corpora will also need measured work on text-search loading, concordance build cost, and export chunk sizes. Today the site lazily loads books and article chunks, but the build scans the corpus and text searches can fetch all available books. The architecture is extensible; it is not an untested claim of unlimited scale.

## Run and publish

```sh
npm run dev       # http://localhost:5180; watch and reload
npm run check     # build diagnostics without writing
npm test          # reader/build libraries and submission-policy regression tests
npm run validate  # strict current-content checks (no authorship verdict)
npm run export    # build a static site into dist/
```

Pushes to `main` publish the verified static export to GitHub Pages. Research PRs never deploy themselves. A separate submission-policy workflow executes the **base branch’s validator and policy**, treating the proposed tree as data, so a submission cannot relax its own eligibility checks. Branch protection requires both that check and the build/test check. Acceptance and payment remain explicit maintainer decisions.
