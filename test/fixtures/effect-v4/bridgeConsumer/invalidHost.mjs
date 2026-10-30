import assert from 'node:assert/strict';
import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Runtime from 'effect/Runtime';
import { createLegacyServices, makeV4Host } from '../bridgeHost/host.js';

// Intentionally invalid JavaScript host: TypeScript must never need a cast to admit it.
const owner = await makeV4Host();
const laterDefect = new Error('reason after malformed DTO');
const legacy = await createLegacyServices({
  ...owner.host,
  getConnection: async () => ({
    _tag: 'Failure',
    reasons: [
      { _tag: 'Fail', error: { _tag: 'UnknownForeignError', message: 42 } },
      { _tag: 'Die', defect: laterDefect },
      { _tag: 'Interrupt', fiberId: 42 }
    ]
  })
});
const exit = await Effect.runPromiseExit(
  legacy.services.ConnectionService.getConnection().pipe(Effect.provide(legacy.services.prebuiltServicesLayer))
);
assert.ok(Exit.isFailure(exit));
const defects = [...Cause.defects(exit.cause)];
assert.equal(defects.length, 2);
assert.equal(defects[1], laterDefect, 'an invalid DTO must not discard subsequent reasons');
assert.ok(Cause.isInterrupted(exit.cause));
await legacy.dispose();
for (const mode of ['reject', 'throw']) {
  const unexpected = new Error(`unexpected host ${mode}`);
  const invalid = await createLegacyServices({
    ...owner.host,
    getConnection: () => {
      if (mode === 'throw') throw unexpected;
      return Promise.reject(unexpected);
    }
  });
  const rejected = await Effect.runPromiseExit(
    invalid.services.ConnectionService.getConnection().pipe(Effect.provide(invalid.services.prebuiltServicesLayer))
  );
  assert.ok(Exit.isFailure(rejected));
  assert.deepEqual(
    [...Cause.defects(rejected.cause)],
    [unexpected],
    'unexpected host exception must become one defect'
  );
  await invalid.dispose();
}
for (const phase of ['acquire', 'dispose']) {
  for (const mode of ['throw', 'reject']) {
    const original = new Error(`lifecycle ${phase} ${mode}`);
    const fail = () => {
      if (mode === 'throw') throw original;
      return Promise.reject(original);
    };
    const creating = createLegacyServices({
      ...owner.host,
      subscribeOrgChanges:
        phase === 'acquire'
          ? fail
          : async callback => {
              await callback({ orgId: '00D000000000001' });
              return { _tag: 'Success', value: fail };
            }
    });
    const completion = phase === 'acquire' ? creating : creating.then(value => value.dispose());
    await assert.rejects(
      completion,
      error =>
        Runtime.isFiberFailure(error) &&
        Cause.defects(error[Runtime.FiberFailureCauseId]).pipe(defects => [...defects][0] === original),
      'lifecycle boundary must retain the original defect object'
    );
  }
}
await owner.dispose();
console.log(
  'PASS invalid DTO preserves later reasons; operation/lifecycle throws and rejections retain defect identity'
);
