# Coding Guidelines

When possible, the following are enforced through the code formatter
(Prettier.js) and tslint rules.

---

## Indentation

We use spaces, not tabs.

## Names

- Use PascalCase for `type` names
- Use UPPERCASE_WITH_SPACES for `enum` values and constants
- Use camelCase for `function` and `method` names
- Use camelCase for `property` names and `local variables`
- Use whole words in names when possible
- Use camelCase for file names (name files after the main Type it exports)

## Conventions

- Create a folder for each major subarea
- In the folder, create an index.ts which exports the public facing API for that
  subarea.
- Tests can refer directly to the .ts files; other consumers should refer to the
  index.ts file.

## Comments

- Use sparingly since comments always become outdated quickly.
- If you must, use JSDoc style comments.

## Strings

- Use 'single quotes'
- All strings visible to the user need to be externalized in a `messages.ts` file.

## null and undefined

Use `undefined`, do not use `null`.
