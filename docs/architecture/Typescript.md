# Typescript

## Philosophy

If you're new to TS, the goal is to improve the developer experience vs. JS and eliminate runtime errors.
I'd start with this guy <https://www.totaltypescript.com/> to get into the language.

This repo has been around for a long time and doesn't always follow these guidelines.

## Recommended

### effect

<https://effect.website/> . We're using this more and more in the extensions to simplify and standardize a lot of things.

### eslint

There are a lot of eslint rules in the repo, and we're expanding their use and trying to tighten up a lot of the older code. You can take the eslint configuration from this repo as a starting point.

### current EcmaScript

You'll see old code, and AIs are trained on it. There's often better ways in recent ES versions, but the old ones are still around for compatibility. Eslint rules can help keep things up to date using newer techniques.

The tsconfig `target`/`lib` properties will ensure you don't use something that's not available in the target es version.

## Anti-patterns

### enums

Enums don't exist in JS. They do in TS, and get compiled to **weird** JS.

You probably just need a string union type. They provides type enforcement and autocomplete for developers, but evaporates during compile to improve perf

### runtime errors

your code shouldn't throw errors for developer mistakes

ex: a non-exhaustive switch/case where you throw for default case. Use types to make sure all cases are handled.

ex: throwing if null/undefined is passed in where the input/consumer is within our control (not user-supplied input).

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
