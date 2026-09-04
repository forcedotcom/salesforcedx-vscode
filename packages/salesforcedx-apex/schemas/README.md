# Public JSON API schema

`public-api.schema.json` is generated from Effect schemas and records every
JSON-representable data contract in the supported `@salesforce/apex-node` API.
Use the named entries under `$defs` when inspecting an individual contract.

Run `npm run schema:check -w @salesforce/apex-node` to verify the checked-in
schema or `npm run schema:update -w @salesforce/apex-node` after an intentional
public contract change.
