# @salesforce/effect-ext-utils

Utility functions and helpers for Effect-based VS Code extensions.

## Overview

This package provides reusable utilities and helper functions for building VS Code extensions using the Effect library. It contains common patterns and utilities that can be shared across Effect-based extensions.

## Differences between this and the `vscode-services` extension

1. this is a package, you an import it directly instead of having to get it through the extension API
1. it's a dev-time, not run-time dependency
1. each extension get its own instance of this package, so they aren't shared/comingled. Ex: `extensionScope` is per extension, each extension manages and closes its own scope.
1. You can pass these to `services` as dependencies (ex: some Effect that requires a scope).
1. the dependencies are minimal (mostly Effect, which all extensions will end up with). This should **not** contain any DX libraries or large dependencies

## Installation

```bash
npm install @salesforce/effect-ext-utils
```

## Usage

```typescript
import {} from /* utilities */ '@salesforce/effect-ext-utils';
```

## License

BSD-3-Clause

## Support

For issues or questions, please file an issue at:
https://github.com/forcedotcom/salesforcedx-vscode/issues
