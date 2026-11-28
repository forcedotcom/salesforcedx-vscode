import * as Effect from 'effect/Effect';
import { createRequire } from 'node:module';

// Invalid runtime mixing is isolated: it must fail rather than corrupt the test runner.
const requireV4 = createRequire(new URL('../v4/package.json', import.meta.url));
const LayerV4 = requireV4('effect/Layer');
await Effect.runPromise(Effect.provide(Effect.succeed('must-not-work'), LayerV4.empty));
