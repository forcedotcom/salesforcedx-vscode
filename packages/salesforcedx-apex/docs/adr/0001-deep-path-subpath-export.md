# Expose `lib/src/tests/types.js` as an explicit subpath export

The W-23051181 migration scoped `@salesforce/apex-node`'s `exports` map down to `.` + `./lib/src/utils`, but `salesforcecli/plugin-apex` imports `@salesforce/apex-node/lib/src/tests/types.js` (`jsonReporter.ts` + 3 NUT files), which now fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`. We add that one concrete subpath entry (mirroring the `./lib/src/utils` precedent) rather than widening the map, because the `exports` map is public API on a published package and narrowing it later is a breaking change.

## Considered Options

- **Chosen — single explicit entry `"./lib/src/tests/types.js"`**: exposes only the one path any known external consumer imports; as narrow and reversible as possible.
- **Rejected — wildcard `"./lib/src/*"`**: opens the entire `lib/src` tree (streaming, logs, reporter internals) to any npm consumer; over-broad and harder to narrow later.
- **Rejected — drop the map (`exports: null`)**: restores upstream any-deep-path behavior but discards the typed `.`/`utils` intent the migration added; makes everything public again — least reversible.
- **Rejected — plugin-apex switches to the public API**: out of this repo's control; the deep import is real today and the NUT net must go green against the current consumer.
