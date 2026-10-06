# The book research contract

This is the acceptance standard, not a suggestion to do whatever fits in a short run. A complete unit joins close reading, translation, philology, contextual lexical analysis, a densely connected index, and verifiable research. Aim for the strongest defensible account of the text, not the largest number of files.

## Research passes

### 1. Establish the source and names

Consult the actual Greek edition, not an agent’s memory or a search snippet. Record editor, publication, stable URL, precise locator, access date, rights, and any normalization. Preserve verse numbering and meaningful punctuation; document editorial quotation marks added to express speech boundaries. Establish names and homonyms before translation, and cross-check spelling against existing articles. Distinguish similarly named people and places by genealogy, place, role, and occurrence evidence.

List uncertainties before starting prose. Separate an uncertain ancient claim, a disputed reading, an uncertain etymology, and your own uncertainty. Use this list to direct further research.

### 2. Translate and audit

Translate line by line from Greek. Retain every clause and image, including the apparently unimportant connecting words. Check grammatical subject/object, scope of negation, temporal relations, tense/aspect, participial force, modality, discourse particles, direct/indirect speech, and vocatives. Do not silently replace Greek with what you think the story ought to say. Avoid padding an English line merely to make it look aligned.

Maintain a work-level translation convention file. Record choices for recurring formulas and culturally loaded terms, deviations that context demands, and disputed constructions. Check repetition across accepted books. Do not standardize two genuinely different senses into one gloss.

Freeze a working translation before writing article quotes. After an audit changes wording, update affected notes and recheck all quotations. A separate pass must compare every line with the Greek, not merely proofread the English.

### 3. Analyze each occurrence

The lexicon records `{w, l, g, p, n?}` for each token, in the tokenizer’s order: exact written form; lemma; contextual gloss; part of speech plus applicable morphology; optional explanatory note. Give person, number, tense/aspect, mood, voice for finite verbs; case/number/gender and other relevant features for nominal forms and participles. Preserve unresolved alternatives honestly and explain their effect on interpretation.

Check dialectal forms, augment, elision, crasis, duals, compound formation, patronymics, unusual case government, and homographs. The same form need not have the same lemma or sense everywhere. A morphological parser is a lead that must be checked, not an authority that replaces reading. Function words and repeated occurrences still need analyses even when they do not merit standalone articles.

### 4. Discover all article candidates

Review every line in sequential blocks of **at most 25 numbered positions**. Each block records translation, lexical, indexing, and research review, actual findings, and relevant article IDs. Together the blocks cover every extant or restored line exactly once. Numerical coverage is the audit trail, not proof of comprehension.

For every candidate, log the line(s), kind, proposed title, outcome (`created`, `expanded`, `covered`, `omitted`), target article ID where applicable, and reason. “Covered” means an existing article actually explains it; link it. “Omitted” needs a substantive reason such as a routine use adequately covered by the lexicon, an inseparable aspect of an existing subject, or a disproven lead. Do not omit a needed article merely because time is running out; that is unfinished scope.

Review every configured article kind, even when absent:

| Kind | Questions to ask |
| --- | --- |
| god | Which divine identities, local titles, functions, interventions, allegiances, and relationships occur? |
| person | Every named, patronymic, or identifiable unnamed figure; actions, speeches, genealogy, namesakes? |
| people | Communities, ethnic terms, contingents, kinship groups, shifting collective names? |
| creature | Mythical beings, monstrous attributes, ambiguous human/divine categories? |
| place | Settlements, regions, rivers, landscapes, routes, boundaries, disputed identifications? |
| animal | Species, behavior, husbandry, symbolic use, and natural observation? |
| object | Weapons, armor, ships, tools, textiles, food, architecture, plants/materials, manufacture and use? |
| ritual | Sacrifice, prayer, oath, supplication, burial, hospitality, assembly, exchange, law and custom? |
| term | Significant vocabulary, cultural concepts, semantic distinctions, rare/contested words and derivation? |
| theme | Honor, anger, agency, mortality, labor, gender, power, community, knowledge, and passage-specific ideas? |
| epithet | Form, morphology, etymology, bearer, formulaic placement, and contextual significance? |
| formula | Repeated diction, speech patterns, type-scenes, meter, rhetorical figures, structural devices? |
| simile | Full comparison, vehicle/tenor, natural/social setting, extent, and narrative effect? |
| saying | Maxim, proverb, memorable generalization, context and later reuse? |
| story | Events told, remembered, alluded to, prophesied, or embedded in genealogies; teller/audience/purpose? |
| anecdote | Precisely sourced later quotation, reinterpretation, reception, or ancient explanation? |
| author | Relevant ancient writers or commentators, clearly separated from characters and attributed works? |
| note | Textual variants, indirect witnesses, linguistic problems, disputed interpretation, editorial decisions? |

Categories can overlap. Prefer one stable subject article with appropriate tags and relations over duplicates that merely rephrase each other. There is no maximum number of entries and no arbitrary minimum length. Common names are not the limit of the index; uncapitalized language often contains the most important work.

### 5. Research each promising thread

Consult a primary source, lexical evidence, and relevant scholarship at minimum, then follow the book’s actual questions. A minimum source mix is a floor, not an adequate research plan by itself. Consult commentaries and specialist research, ancient scholia and lexica, material/ritual/geographic evidence where relevant, parallels within Homer, and later quotations/reception. Look beyond the first search result and beyond modern summaries. Pursue citations backward to the primary passage where possible.

Each consulted source record gives its precise locator, stable URL (or bibliographic landing page for an offline source), access date, relevant finding, affected entries, and rights. Distinguish direct consultation from a secondhand reference. An inaccessible item is a research lead, not a consulted source. If a necessary claim cannot be verified, narrow or qualify it, or disclose the remaining gap; never invent a page number or pretend to have read a book.

Use short, necessary quotations within the source’s reuse terms and write your own explanation. Do not paste restricted books or unlicensed commentary into the repository. Clearly distinguish Homer’s evidence, the words of a character, an ancient commentator’s claim, a modern scholar’s interpretation, and the contributor’s inference. Disputed etymologies must remain disputed. Evidence of later reception does not automatically explain Homer’s original intention.

### Indirect witnesses and missing lines

**Ancient quotations are encouraged.** Aristotle, Plato, rhetoricians, lexicographers, scholia, papyri, and other witnesses can preserve readings or verses absent from the base digital source. Investigate them thoroughly. The source-file gaps are an invitation to check evidence, not a ban on recovering material.

There are two routes:

- A quotation or variant that cannot securely be placed in a numbered gap belongs in a researched reception/textual article, with the witness’s own citation and a link to the relevant Homeric passage. It need not wait for that author’s entire work to be imported. Use a precise external source link and a short attributed quotation in Markdown. Do not fabricate a Homeric verse number or an internal reader quote tag for unimported material.
- An evidenced supplement at a known gap can be included in `grc/NN.txt` with aligned English, full lexicon analysis, structure, coverage, and a matching record in `witnesses/NN.json`. It is accepted as **supplemental text with attribution**, not silently presented as text found in the base file. The reader and quote cards label its witness and uncertainty. The pinned base inventory stays unchanged.

Witness records are objects keyed by the restored verse number. Each contains `kind` (`indirect-witness` or `edition-supplement`), exact `greek`, `source` (`author`, `work`, `locator`, `url`, `accessedAt`, `rights`), `basis` (why this wording and placement are justified), `certainty`, and `editorialNote` (differences, qualifications, editorial decisions). Record the witness in the consulted-source log too. Cite exactly where the quotation is preserved, distinguish the quoted text from an ancient paraphrase, and explain editorial bridges or conjectures. Do not turn a paraphrase into a purported verbatim quotation. Relevant ambiguities should survive in the published note.

A speculative identification can be discussed in an article without inserting a restored line. A documented supplement is optional unless the research establishes that it is needed to meet the agreed edition scope. “100%” refers to the base lines plus declared supplements and completed research passes, not a claim to have recovered every lost verse. Broader numbering/edition changes need a reviewed inventory update. Cross-book ranges should be quoted as separate passages. Unrestored gaps should also be split into extant quote ranges; the quote tool intentionally refuses to invent absent text.

### 6. Integrate articles and notes

The shared article explains the subject across scopes; the book note explains its role, language, occurrences, and implications here. For Achilles in Iliad 1, read every relevant action, speech, epithet, relationship, indirect reference, and disputed point; write `notes/01/achilles.md` and connect verified passages. Later books extend the same article with their own notes.

Use only defined tags/kinds/periods. Add new tags when the corpus needs them. Links must resolve. Use Greek patterns conservatively; distinguish accent-sensitive forms and homographs, names that resemble common nouns, and different bearers of the same name. Check every automatic occurrence against the Greek. Add implicit references explicitly. An automatic concordance is not a completed index.

Use deterministic quote tags for available passages. Quotes spanning a restored line retain the witness label. The general article can cite external ancient texts without pretending those texts are already in the reader. Keep source attribution and exact work/section references visible in the prose as well as the research log.

### 7. Audit and declare completion

Record five audits: **translation**, **lexicon**, **index**, **sources**, **integration**. Each names its reviewer agent, method, report path, findings, resolved issues, and result. Prefer independent reviewers; otherwise use explicitly separated passes. Never describe self-review as independent. Record disagreements and corrections, not merely “looks good.” All required issues must be resolved before completion; scholarly uncertainty can remain if accurately framed and researched.

The integration audit verifies scene/speech consistency, stable IDs, article scope, quotations after translation edits, citations and witness labels, lexical homographs, links, mobile reader interactions, and the final diff. Explain every conspicuous absence, every “not applicable” category, and the remaining limitations of the study.

Only declare complete when all passes, evidence, and artifacts are finished. Do not stop because the estimate or token budget has elapsed. If you cannot finish, keep a draft and report what remains. Time, tokens, word count, agent count, and a green CI check are not substitutes for scholarly judgment.
