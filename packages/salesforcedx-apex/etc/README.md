# Public API reports

The reviewed TypeScript API baselines are:

- `apex-node.api.md` for the primary `@salesforce/apex-node` entry point.
- `apex-node-tests-types.api.md` for the compatibility entry point
  `@salesforce/apex-node/lib/src/tests/types.js`.

Run `npm run api:check --workspace @salesforce/apex-node` to verify that the
generated declarations match the baseline. Intentional public API changes must
be reviewed and then recorded with the applicable command:

```sh
npm run api:update --workspace @salesforce/apex-node
npm run api:update:tests-types --workspace @salesforce/apex-node
```
