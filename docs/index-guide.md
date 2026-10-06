# Writing index entries

Every index entry is one Markdown file under `content/index/<folder>/<id>.md`. The file name is the
entry's id: lowercase ASCII, words joined by hyphens (`plan-of-zeus.md`, `swift-footed.md`). Folders are
only for tidiness; ids must be unique across all of them.

The build (`npm run build`, or `npm run check` to validate without writing) reads every entry, finds its
Greek forms in the text, links its names in the English, renders its article, and reports problems.

## Front matter

```yaml
---
title: Achilles                     # display name (required)
greek: Ἀχιλλεύς                     # headword with full accents
kind: person                        # one of the kinds in content/kinds.json (required)
tags: [achaean, myrmidon, warrior]  # ids from content/tags.json only
summary: One or two sentences. May contain [[links]].
aliases: [Pelides, son of Peleus]   # other names people might search for
grc: [Ἀχιλ*, Πηλεΐδ*]               # Greek form patterns, found automatically in the text
en: [Achilles, son of Peleus]       # English words to link in the translation (see below)
refs: [1.352, 1.505]                # lines that refer to the entry without naming it
except: [1.11]                      # lines where a matching form means something else
passages:                           # key passages: listed on the page, not counted as mentions
  - 1.396-406 | Thetis frees Zeus
of: [zeus]                          # epithets, anecdotes, notes: what the entry is about
relations:                          # family and other relations, with evidence
  - father: peleus (1.1, 1.489)
  - mother: thetis (1.280, 1.352)
featured: true                      # show on the Library page (sparingly)
---
```

Stories also take `period` (from `content/periods.json`), `mode` (`narrated`, `told`, `allusion`,
`foreshadowing`, `genealogy`, `backstory`), `narrator` (an entry id), and `participants` (entry ids).
Anecdotes and notes take `source` ("Strabo, Geography 8.3.30").

Lists may be written inline (`[a, b]`) or as indented `- item` lines. Use the indented form when an item
contains a comma.

### Kinds

`god` · `person` · `people` · `creature` · `place` · `animal` · `object` · `ritual` · `term` (a Greek word) ·
`theme` · `epithet` · `formula` (formulas, type-scenes and figures of speech) · `simile` ·
`saying` (maxims and famous lines) · `story` ·
`anecdote` (reception, later use) · `author` · `note` (textual and scholarly notes)

### Greek forms (`grc`)

Patterns are matched against every word of the Greek, **ignoring accents, breathings, iota subscripts,
diaeresis, capitals, and elision marks**. So `Ἥρη` also matches `Ἥρῃ`, and `μῆνιν` matches `μῆνιν` only.

- `Ἀχιλῆος`: one exact word (without accents).
- `Ἀχιλ*`: any word beginning with these letters. Use stems only when they cannot catch other words.
- `πόδας ὠκὺς`: a phrase of consecutive words.
- `=ἦ`: accent-sensitive, for the rare word that differs from another only by accent.
- `^Ὕλην`: only when capitalized, for a name that is also a common word (Ὕλη the town, ὕλη
  "forest"; Λᾶας the town, λᾶας "stone"). The text capitalizes proper names only, so this keeps a
  town from matching every forest.
- `!=Τρῳ*`: an exclusion. Words it matches are never claimed by the entry's other patterns, so
  `[Τρώ*, "!=Τρῳ*"]` finds the Trojans (Τρῶες, Τρώων, Τρῶας) but not the Trojan women (Τρῳαί,
  Τρῳάς), which differ only by accent and iota subscript. Prefer it to `except` when the clash will
  recur in every book.
- `+Τρῳὰς δὲ στίχας`: a forced pattern, which the entry's own exclusions do not drop. Use it for the
  rare phrase an exclusion would wrongly take away: at 5.461 Τρῳὰς στίχας are "the Trojan ranks", not
  the Trojan women, so the Trojans claim the phrase and `trojan-women` lists 5.461 under `except`.

List the forms that actually occur, copied from the Greek text (`content/library/homer/iliad/grc/01.txt`).
The build warns about any pattern that never matches. Use `except` for lines where a form means something
else (Χρύσην is the priest at 1.11 but the town everywhere else).

Patronymics count for both father and son: Πηληϊάδεω is Achilles and also a mention of Peleus.

### English forms (`en`)

Names (gods, persons, peoples, creatures, places) are linked in the English automatically, using the
title and any capitalized aliases. For other kinds, give `en` the English words that render the Greek
in the translation (`en: [wrath]` for μῆνις). They are linked only in lines where the Greek form occurs.
Check the translation (`content/library/homer/iliad/en/01.txt`) for the exact wording.

## General article and scoped notes

An entry is read at a **scope**: everything, one author, one work, or one book (Homer › Iliad › 3). So its
content lives in two kinds of file:

- **The entry file** (`content/index/<folder>/<id>.md`) holds what is true at every scope: etymology,
  family, descriptions and epithets, the myth, later tradition. Its summary is general too. A summary
  should say who or what the thing is, not what it does in one book.
- **A note** holds what the entry is and does in one scope. The folder the note sits in is the scope,
  and the file name is the entry's id:

  ```
  content/library/homer/iliad/notes/02/odysseus.md   Odysseus in Iliad 2
  content/library/homer/iliad/notes/odysseus.md      Odysseus in the Iliad as a whole
  content/library/homer/notes/odysseus.md            Odysseus in Homer (Iliad and Odyssey together)
  ```

  Later authors get the same treatment when their texts arrive (`content/library/aristotle/notes/…`).

A note's front matter is optional. It may contain:

```yaml
---
summary: One sentence on the entry's part in this book (shown under the title at this scope).
heading: The Catalogue           # optional; the section is otherwise called "In Iliad 2"
grc: [Ὀδυσῆα]                    # Greek forms first met in this book (added to the entry's forms)
en: [son of Laertes]             # English renderings first met in this book
refs: [2.260]                    # lines, in this work, that refer to the entry without naming it
except: [2.184]                  # lines where one of the entry's forms means someone else
passages:                        # key passages in this book
  - 2.244-264 | Odysseus and Thersites
relations:
  - father: laertes (2.173)      # relations first evidenced in this book
---
```

References in a note default to the note's own work, so `2.260` means Iliad 2.260. Write the body with
`##` headings if it has sections, exactly as in an entry file. On the whole-article view, the notes
are placed at the entry's `{{notes}}` line, or before `## Mythology` / `## Outside Homer` when there is
no such line.

Write a note when the entry does something in the book that is worth telling: a character's actions
and speeches, a place's part in the story, a word's use in context. An entry that is only named in
passing needs no note. Its occurrences are listed at every scope anyway.

## The article

The body below the front matter is Markdown. Headings start at `##`. Link other entries with
`[[id]]`, `[[id|label]]`, or `[[Title]]`. Quote the text with a quote tag on its own line:

```
{{quote:Iliad 1.528-530 | The nod of Zeus}}
```

The title after `|` is optional. `npm run quotes` turns these into permanent ids
(`{{quote:9d7f…}}`). Either form works in the build. Inline, `{{ref:Iliad 1.5}}` links to a line.
Footnotes use `[^1]` and a `[^1]: …` line; `{{tabs}}`, `{{tab:Label}}`, `{{/tabs}}` make folder tabs.
A diagram is `{{figure:file.svg | Caption}}` on its own line, for an SVG in `content/figures/`. Draw it
in `currentColor` so it follows the light and dark themes.

Sections, in this order where they apply. Leave out any that have nothing real to say.

- **Gods, persons, peoples, places:** `## Etymology`, `## Family` (with quotes as evidence and a short
  gloss under each), `## Descriptions` (epithets with Greek word analysis, as in `ἀγκυλομήτης = ἀγκύλος
  "crooked" + μῆτις "counsel"`), `{{notes}}` (where the book notes go: what they do and say in each
  book), `## Mythology`, `## Outside Homer`.
- **Greek words:** `## Meaning`, `{{notes}}`, `## Related words`.
- **Epithets:** `## Meaning` (with the etymology), `## Use`.
- **Formulas and type-scenes:** `## The pattern`, `{{notes}}`.
- **Stories:** `## The story`, `## In the poem` (why it is told, and to whom), `## Outside Homer`.

What an entry does in a particular book goes in that book's note, not in the entry file (see above).
- **Anecdotes and notes:** a plain account, with the source cited precisely.

## Style

- Say only what you know. Keep what Homer says separate from later tradition, and put the later
  material under `## Outside Homer` with its sources (Hesiod, *Theogony* 147–153; Apollodorus 1.1.1).
  Never invent a citation. When the evidence is uncertain, say so briefly.
- Quote the text through quote tags rather than copying lines into the prose.
- Plain, precise English. American spelling. Short sentences.
- Greek words in running text are given with a gloss: μῆνις (“wrath”).
