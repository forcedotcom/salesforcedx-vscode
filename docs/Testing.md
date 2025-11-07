# Testing

## Philosophy

It's useful to read Kent Dodd’s thinking

- <https://kentcdodds.com/blog/write-tests>
- <https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications>

Why?

1. our language/ecosystem has outstanding static analysis. eslint and ts (strictly used!) catch a lot of the problems that UT were historically used for
2. a lot of our code is sitting on top of big libraries and/or a salesforce org’s APIs
   1. The amount of stubbing to do command-level unit tests makes it kinda silly
   2. stubbed tests won’t catch all the real-world stuff that can go wrong with connections, orgs, and networking. If we live where customers live, we’ll be annoyed and want to handle these

So we have really strong types and eslint rules.
You can add local, custom eslint rules to prevent common mistakes (AIs are good at these) so devs get squiggles instead of waiting for test run failures (shift left!)

### unit tests

be pragmatic with these. If your unit (function, preferably) has some complex logic and not a lot of dependencies, it's probably a good place to write a unit test.
Pure functions are ideal for testing.
if you see a LOT of stubs, that's probably not a good unit test

Use TS to make impossible states impossible (the compiler flags errors!) instead of writing unit tests to handle "does my function check for null handling" ?

This repo uses `jest` for testing and it's probably the best place to start. [Docs](../contributing/tests.md)

### coverage

We compute test coverage locally but don't send it anywhere, nor is there a requirement to do so

## End to End Testing

e2e is even more crucial in the extensions because much of the extensions API is "run-time only." You **could** write unit tests to check vscode notifications, but you're mocking all of that and there's no way to assert that you're doing it correctly. It's more useful to have an e2e environment running **real** vscode and asserting it does what you expect.

Both our e2e testing frameworks run both locally and in Github Actions

### old: redhat framework

<https://github.com/forcedotcom/salesforcedx-vscode-test-tools> is our repo to make using <https://github.com/redhat-developer/vscode-extension-tester> simpler.

See [contributing/e2e-instructions.md](../contributing/e2e-instructions.md) for instructions for the framework.

pros

- pre-defined selenium PageObject definitions for most of the vscode UI so you don't have to figure out or maintain selectors
- versioned selectors for multiple vscode versions
- you can import our library from anywhere else

cons

- it's slow and single-test-at-a-time
- it's been super flaky
- desktop only (so you might need to do playwright stuff to cover your web extension)

### new: playwright

pros

- fast
- allows parallel execution
- records videos
- works on the web (with vscode-test-web) so a single test runs everywhere
- nice debug mode (step through the test steps)

cons

- haven't tried with windows yet
- you might spend some time screwing around getting the selectors right
- our test using this are much newer, and the code exists only within the extensions, so you'll be copy-pasting a bit if you want to reuse that. On the roadmap to make that more shared

I'd probably start with playwright if I were doing a new extension.

### VSCode DOM

one of the most annoying parts about e2e testing is the "dynamic" nature of the vscode DOM. For example, you might think that everything in the orgBrowser tree is a div. It's actually lazy-loaded, such that anything above or below the visible viewport is removed from the dom, and as you scroll up or down, things are attached/detached

So you go to assert the number of elements, or search the DOM and don't get what you'd expect

When the VSCode UI changes, you might have to update your e2e tests. And you might have to only run tests on newer versions (you still support older versions but don't test against them)

## See Also

- [Build](./Build.md) - use packaged vsix for e2e tests
- [contributing/tests.md](../contributing/tests.md) - jest setup and running tests
- [contributing/e2e-instructions.md](../contributing/e2e-instructions.md) - RedHat e2e framework details
