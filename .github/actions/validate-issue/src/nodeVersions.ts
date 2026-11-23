import * as Effect from 'effect/Effect';
import { isNotUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';

const VersionInfo = Schema.Struct({ start: Schema.String, end: Schema.String });
const VersionSchedule = Schema.Record({ key: Schema.String, value: VersionInfo });

export const isAnyVersionValid = Effect.fn('nodeVersions.isAnyVersionValid')(function* (
  currentDate: Date,
  versions: string[]
) {
  const json = yield* Effect.tryPromise(() =>
    fetch('https://raw.githubusercontent.com/nodejs/Release/main/schedule.json').then(response => response.json())
  );
  const schedule = yield* Schema.decodeUnknown(VersionSchedule)(json);

  return versions.some(version => {
    const release = schedule[`v${version}`];
    return (
      isNotUndefined(release) &&
      currentDate >= new Date(release.start) &&
      currentDate <= new Date(release.end)
    );
  });
});
