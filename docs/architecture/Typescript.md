# Typescript

## Philosophy

If you're new to TS, the goal is to improve the developer experience vs. JS and eliminate runtime errors.
I'd start with this guy <https://www.totaltypescript.com/> to get into the language.

This repo has been around for a long time and doesn't always follow these guidelines.

## Recommended

### effect

<https://effect.website/> . We're using this more and more in the extensions to simplify and standardize a lot of things.

### eslint

There are a lot of eslint rules in the repo, and we're expanding their use and trying to tighten up a lot of the older code. You can take the eslint configuration from this repo as a starting point. The custom rules for VS Code extension packages are published to npm as [`@salesforce/eslint-plugin-vscode-extensions`](https://www.npmjs.com/package/@salesforce/eslint-plugin-vscode-extensions) (source: `packages/eslint-local-rules`).

#### Installing the plugin in your extension repo

```bash
npm install --save-dev @salesforce/eslint-plugin-vscode-extensions @eslint/json
```

In your `eslint.config.mjs`:

```js
import jsonPlugin from '@eslint/json';
import localRulesPlugin from '@salesforce/eslint-plugin-vscode-extensions';

export default [
  {
    plugins: { json: jsonPlugin }
  },
  // TypeScript source files
  {
    files: ['src/**/*.ts'],
    plugins: { local: localRulesPlugin },
    rules: {
      // i18n
      'local/no-duplicate-i18n-values': 'error',
      'local/no-unused-i18n-messages': 'error',
      // vscode API hygiene
      'local/no-vscode-message-literals': 'error',
      'local/no-vscode-progress-title-literals': 'error',
      'local/no-vscode-quickpick-description-literals': 'error',
      'local/no-vscode-validateinput-literals': 'error',
      'local/no-vscode-uri': 'error',
      'local/command-must-be-in-package-json': 'error',
    }
  },
  // package.json validation (requires @eslint/json)
  {
    files: ['**/package.json'],
    language: 'json/json',
    plugins: { json: jsonPlugin, local: localRulesPlugin },
    rules: {
      'local/package-json-i18n-descriptions': 'error',
      'local/package-json-extension-icon': 'error',
      'local/package-json-icon-paths': 'error',
      'local/package-json-command-refs': 'error',
      'local/package-json-view-refs': 'error',
      'local/package-json-salesforce-dep-versions': 'error',
    }
  },
  // .vscodeignore validation
  {
    files: ['packages/*/.vscodeignore'],
    plugins: { local: localRulesPlugin },
    processor: 'local/vscodeignoreText',
    rules: {
      'local/vscodeignore-required-patterns': 'error',
      'local/vscodeignore-contributes-conflict': 'error',
    }
  }
];
```

See the [package README](../../packages/eslint-local-rules/README.md) for the full list of available rules and their descriptions.

### current EcmaScript

You'll see old code, and AIs are trained on it. There's often better ways in recent ES versions, but the old ones are still around for compatibility. Eslint rules can help keep things up to date using newer techniques.

The tsconfig `target`/`lib` properties will ensure you don't use something that's not available in the target es version.

### AI guidance

(it's useful for humans, too!)

See [TypeScript skill](../../.claude/skills/typescript/SKILL.md) for AI-enforced coding standards.

## Anti-patterns

### any

use of `any` : you'll see this code sometimes. It's better to use unknown and try to narrow the type (TS will help you handle all the cases) than to throw an `any` on there. You've lost all the benefits of TS as this point.

alternatives: look at generics

Acceptable exceptions: parsing json with standard JSON.parse (but still better to define a schema for that json and have a tool like Zod or Effect verify that the file content matches the schema before using it)

### as

Avoid use of `as Foo` or even worse `as unknown as Foo`.

Some people think of `as` as a "cast" but you're really telling the compiler, "trust me, this is what I say it is even if it doesn't look like it". Now, or any time in the future, no matter what you do the type or the implementation, the compiler will assume it's correct. You've lost all the benefits of TS as this point.

Acceptable exceptions can be mocks in tests where you're intentionally not mocking the full interface.

### null

Avoid `null`, just use `undefined`. Sometimes the Salesforce API provides `null` in its responses and you'll have to work with it

### not using strict mode (tsconfig)

strict mode will force you to handle null/undefined

### everything is a class

Coming from Java, people think class-first. You can use classes in TS, but they're a lot less important. Prefer functions and objects.

Classes are necessary where you need to extend parts of the vscode API and can be useful when you're creating persistent, managed state in member variables (but of course, minimize state!).

Things TS doesn't need classes to do

- store data (that's an object)
- initialize/build an object (that a function)
- hold a function (just write a fn an export if needed)
- make something readonly/immutable (see TS `readonly`)
- mock

There's too much cruft in this repo to turn on the `classes-use-this` eslint rule, but someday we will. I'd recommend you start there!

## See Also

- [Extensions](./Extensions.md) - extension development best practices
- [Code Reuse](./CodeReuse.md) - shared libraries and patterns
