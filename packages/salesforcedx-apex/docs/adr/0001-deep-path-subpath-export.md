# Expose `lib/src/tests/types.js` as an explicit subpath export

The W-23051181 migration scoped `@salesforce/apex-node`'s `exports` map, and external consumers import `@salesforce/apex-node/lib/src/tests/types.js`, failing with `ERR_PACKAGE_PATH_NOT_EXPORTED`. Known consumers: `salesforcecli/plugin-apex` (`jsonReporter.ts` + 3 NUT files, `TestRunIdResult`/`ApexTestRunResultStatus`) and `salesforcecli/mcp` (`packages/mcp-provider-dx-core/src/tools/run_apex_test.ts`, `ApexTestResultOutcome`). We add that one concrete subpath entry; the key `./lib/src/tests/types.js` stays fixed (consumer-facing), but the target resolves to `./out/src/tests/types.js` (post-build directory, per W-23166333). We keep the map narrow rather than widening it, because the `exports` map is public API and narrowing it later is a breaking change.

## Considered Options

- **Chosen — single explicit entry `"./lib/src/tests/types.js"`**: key unchanged (consumer stability); target points to the built `out/` dir. Exposes only the one path any known external consumer imports; narrow and reversible.
- **Rejected — wildcard `"./lib/src/*"`**: opens the entire `lib/src` tree (streaming, logs, reporter internals) to any npm consumer; over-broad and harder to narrow later.
- **Rejected — drop the map (`exports: null`)**: restores upstream any-deep-path behavior but discards the migration's narrowing intent; makes everything public again — least reversible.
- **Rejected — plugin-apex switches to the public API**: out of this repo's control; the deep import is real today and the NUT net must go green against the current consumer.
