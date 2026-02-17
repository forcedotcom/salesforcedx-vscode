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

## License

BSD-3-Clause
