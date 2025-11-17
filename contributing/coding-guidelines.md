# Coding Guidelines

When possible, the following are enforced through the code formatter
(Prettier.js) and eslint rules.

---

## Indentation

We use spaces, not tabs. [automatic]

## Names

- Use PascalCase for `type` names
- Use UPPERCASE_WITH_SPACES for `enum` values and constants
- Use camelCase for `function` and `method` names
- Use camelCase for `property` names and `local variables`
- Use whole words in names when possible
- Use camelCase for file names (name files after the main Type it exports)

## Conventions

- Create a folder for each major subarea

## Comments

- Use sparingly since comments always become outdated quickly.
- If you must, use JSDoc style comments.

## Strings

- Use 'single quotes' [automatic]
- All strings visible to the user need to be externalized in a `messages.ts` file.

## null and undefined

Use `undefined`, do not use `null`.
