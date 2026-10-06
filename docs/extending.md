# Extending the corpus

The Pinakes-derived reader is built so that more of Homer drops in with no code changes, and so that prose and
mathematical works need only small, well-defined additions. This note says where each kind of
growth plugs in.

## More Homer (register the work and contracts first)

The Iliad's remaining books, the Odyssey, and the Homeric Hymns are all verse cited as
`book.line`. For each new book add, beside the existing files:

| File | Contents |
|---|---|
| `grc/NN.txt` | the Greek, one verse per row: `line<TAB>text` |
| `en/NN.txt` | the translation, aligned to the Greek numbering |
| `structure/NN.json` | scenes (covering every line), speeches (matching the quotation marks), days |
| `lexicon/NN.json` | one `{w, l, g, p, n?}` analysis per token, as produced by `tokenize()` |
| `notes/NN/<id>.md` | what each index entry is and does in this book (see below) |

`node scripts/lexicon.mjs skeleton <book> <from> <to>` prints the tokens of a range ready to be
analyzed; `check` validates a filled-in part against the text and against the lemmas already used;
`merge` writes `lexicon/NN.json` from the parts. Several parts can be written in parallel.

`npm test` checks the alignment, the speeches against the quotation marks, the scene coverage,
and the lexicon token counts. The build report lists every capitalized Greek word no entry covers
yet, which is the index's to-do list for the new book. Existing entries pick up their new
occurrences automatically, because the concordance runs over every available book.

A maintainer must register the source inventory, unit contracts, reward/funding state, and source rights before opening bounties. The existing author/work/unit/citationScheme manifest fields then identify the scope. A new work gets its own folder, `work.json` (with `aliases` so that `{{quote:Od. 9.1-10}}`
resolves), and optionally `TRANSLATION.md`, which the About page renders.

The Myths timeline already runs from the Primordial age to the Telegony. Stories from the Odyssey
go into the same periods, and the Odyssey's own action goes under `odyssey`.

## Scopes: one article, read at many levels

Every entry has one general article (`content/index/<folder>/<id>.md`) and any number of scoped
notes, one per author, work or book, stored in the library under that scope:

```
content/library/homer/iliad/notes/02/achilles.md   Achilles in Iliad 2
content/library/homer/iliad/notes/achilles.md      Achilles in the Iliad
content/library/homer/odyssey/notes/11/achilles.md Achilles in Odyssey 11 (the shade in the underworld)
content/library/homer/notes/achilles.md            Achilles in Homer
content/library/aristotle/notes/achilles.md        Achilles in Aristotle
```

The reader chooses the scope on the entry page as a path of up to three rows: All and the authors;
the chosen author's works, led by "About" (the author as a whole); the chosen work's books, led by
"About" (the work as a whole). At a book, the article opens with that book's notes and folds the
general article away; at an author or a work, it reads whole, with the notes of that scope in place.
The choice is remembered as the study scope, so every article opens at the book being studied, and
the Index can be limited to an author, a work or a book (`site/assets/js/lib/scope.js`). A new work or author needs only its `author.json` or `work.json`; its
notes are picked up by folder. The general article stays general: etymology, family, myth and
later tradition; everything that happens in a particular book goes in that book's note.

## Prose (Plato, Aristotle, Herodotus)

Prose is cited by sections rather than lines: Stephanus pages (`Republic 327a`), Bekker pages
(`Poetics 1450a15`), or book.chapter.section (`Herodotus 7.134.1`). Three pieces generalize:

1. **Section ids.** `readLines()` in `scripts/lib/content.mjs` requires integer line numbers.
   Prose needs string ids (`327a`) with an explicit order, which is the order of the file. This is planned work and is not implemented.
2. **References.** `parseRef()` in `scripts/lib/refs.mjs` parses `book.line`. A work's
   `citation.scheme` (`"stephanus"`, `"bekker"`, `"book.chapter.section"`) would select a parser,
   and `refLines()` would expand a range by position in the file, not by arithmetic.
3. **Reader layout.** `work.display` is already `"verse"` for Homer. A `"prose"` layout would
   render paragraphs with section markers in the margin instead of one row per line. Tap-a-word,
   names, quotes and the index work the same way, because they all key on section id and token.

## Mathematics (Euclid, Archimedes)

A proposition is a structured section: enunciation, setting-out, construction, proof. Cite it as
`book.proposition` (`Elements I.1`), with the parts as sub-sections (`I.1.construction`).

Diagrams are already supported. Put an SVG in `content/figures/` and place it with
`{{figure:euclid/1-1.svg | Caption}}`. The build inlines it, so strokes and labels drawn in
`currentColor` follow the light and dark themes, and on narrow screens it scrolls sideways
instead of shrinking. For a proposition, the figure would sit beside the text in a
`"proposition"` reader layout. Its point labels could switch between Latin and Greek letters

## The index

The kinds, tags, periods and modes are data (`content/*.json`). Adding a kind, a tag facet, or a
mythic period means editing those files, not code. The Myths view, the tag browser and the Index
filters all read them.
