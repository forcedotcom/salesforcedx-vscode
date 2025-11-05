# Extensions development docs

This docs folder's purpose is to onboard developers to vscode extension development in general, whether or not you contribute to this particular repo. Seems as good of a place as any.

If you're contributing to this repo, be sure to the docs in `contributing`

## Documentation Index

### Core Topics

- [Testing](./Testing.md) - unit tests, e2e testing (RedHat/Playwright), coverage
- [Build](./Build.md) - bundling, packaging, publishing
- [Telemetry](./Telemetry.md) - usage metrics and logging

### Architecture

- [Extensions](./architecture/Extensions.md) - best practices, naming, logging, activation, environment considerations
- [Typescript](./architecture/Typescript.md) - recommended patterns and anti-patterns
- [Code Reuse](./architecture/CodeReuse.md) - shared libraries, vscode-services, cross-extension communication
- [Extension Packs](./architecture/ExtensionPacks.md) - how packs work and inclusion criteria

## Old vs. New Patterns

Extensions are being re-architected to support a few major initiatives

1. web compatibility
2. more teams building extensions

The docs will describe some old patterns that you'll see in the codebase, the new pattern, and why the change is happening. Just because you (or your AI) see something in this code base does not mean you should copy it.

You've caught us in the middle of a giant transition, so apologies for how confusing this is going to be.

## Where to Put Code

This repo is owned by Extensions team (IDE Experience, aka IDE Foundations). You probably don't want your code here if you're building a new extension. You **might** want your code here if you're adding a feature that closely ties to something already here (ex: Apex or LWC).

There are other extensions (code-analyzer, or the vibe coding extension) that live in other repos, then build/bundle/package/publish from their repo, and are included in one of our extension packs.

Whether you intend to build a new extension, or a feature, or want to be included in the pack, it's worth talking to us in advance.

## Questions?

slack `#platform-dev-tools`
