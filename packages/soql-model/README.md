# @salesforce/soql-model

Internal SOQL query model: AST types/enums and implementations, serialization to/from SOQL text, and field-value validators. Consumed in-repo via npm workspaces (`*`). Not published — see [ADR-0019](../../docs/adr/0019-soql-model-internal-package.md).

## Exports

- `@salesforce/soql-model/model` — AST types/enums plus impl classes
- `@salesforce/soql-model/model/util` — `SoqlModelUtils`
- `@salesforce/soql-model/analyzers` — `SelectAnalyzer`, column data types
- `@salesforce/soql-model/serialization` — `ModelSerializer`, `deserialize`
- `@salesforce/soql-model/validators` — validator factory + input utilities

## License

BSD-3-Clause
