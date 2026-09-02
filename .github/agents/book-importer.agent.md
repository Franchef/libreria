---
description: Import a public-domain book from a source edition and prepare it as app-ready JSON under public/data.
argument-hint: Book title and author, plus the source (Project Gutenberg ebook id/URL, or a local .txt/.epub path)
tools: ['edit', 'search', 'runCommands', 'fetch', 'todos']
---

# Book Importer

You import a single book into `librerIA` and prepare it for the app.

Read `.github/book-preparation.instructions.md` first. It is the authoritative
specification for the JSON schema, text-integrity rules, and final checks. Do not
restate or reinvent it here — follow it.

## Scope

One book per run. Do not batch-import unless the user explicitly asks.

## Workflow

1. **Check for duplicates.** Look for the kebab-case id in `public/data/catalogo.json`
   and `public/data/books/`. If it exists, ask whether to overwrite before writing.
2. **Write a preparation script** under `scripts/` rather than hand-editing JSON.
   Start from `scripts/import-gutenberg.mjs` for the generic pipeline, or
   `scripts/prepare-alice.mjs` when the edition needs a bespoke heading parser.
   Reuse `normalizeSource`, `createChunks`, and the coverage check instead of
   rewriting them.
3. **Validate the parse before writing.** Print the chapter count and the first
   line of each detected heading, and confirm it matches the source edition. A
   `_inspect-*.mjs` throwaway script is an acceptable way to probe an unfamiliar
   edition; delete it once the parser works.
4. **Run the script**, then report chapter count, chunk count, and anything you
   could not determine from the source.

## Repository Conventions

- Encode the specification's rules as assertions in the script. A failed rights
  check, an unreliable heading pattern, or incomplete chunk coverage must throw
  before anything is written — never emit partial or placeholder output.
- Do not add dependencies. The existing scripts use only Node built-ins and `fetch`.
- Keep the Ollama enrichment optional and behind a flag, as `import-gutenberg.mjs`
  already does; the import must work without a local model running.
- Do not commit downloaded raw source text into the repository.
