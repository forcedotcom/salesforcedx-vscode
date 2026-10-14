# @salesforce/soql-common

Common SOQL parsing utilities and comment handling for SOQL (Salesforce Object Query Language).

## Features

- SOQL parser based on ANTLR4
- Header comment extraction and handling
- TypeScript type definitions

## Installation

```bash
npm install @salesforce/soql-common
```

## Usage

```typescript
import { parseHeaderComments, SOQLParser } from '@salesforce/soql-common';

// Parse SOQL with comments
const result = parseHeaderComments(soqlString);
console.log(result.headerComments);
console.log(result.soqlText);
```

## Updating the bundled SOQL parser

`src/soql-parser.lib/` contains a copy of the JavaScript `lib/` artifacts from the internal
`soql-parser` project. This package uses the checked-in artifacts directly; its `compile` script
copies them into `out/src/`.

To refresh the artifacts, use the JavaScript package in the internal `soql-parser` project.
It requires Node.js 22 or later. Run:

```bash
npm ci
npm run generate-sources
npm run compile
npm test
npm pack
```

`npm pack` runs the parser's `prepack` script, which obfuscates the JavaScript files before
packaging. Extract `package/lib/` from the resulting tarball and replace the contents of
`src/soql-parser.lib/` with those files. Keep `README.txt` and remove any artifacts that no
longer appear in the package. Use the packaged files rather than the checkout's plain compiled
`lib/`.

Review the resulting diff, including generated declarations and exports. Record the source
revision in the change description. Then validate this package from this repository's root:

```bash
pnpm --filter @salesforce/soql-common test
pnpm --filter @salesforce/soql-common lint
```

## License

BSD-3-Clause
