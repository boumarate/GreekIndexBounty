# Homonyms and concordance collisions

This empty corpus has no adjudicated homonyms yet. For each new book, investigate shared names and Greek forms that collide with common words. Record the evidence and decisions in the run’s research log and relevant article notes; extend this document only through a separately scoped infrastructure/documentation change if shared guidance is needed.

Distinct referents get distinct stable IDs. Etymological similarity is not identity. Use exact accented forms, capitalized-only patterns (`^`), exclusions (`!`), forced phrases (`+`), or precise `except:` references as described in the index guide. Test every affected occurrence, including earlier accepted books. Run `node scripts/homographs.mjs N` after lexicon assembly and after integration.
