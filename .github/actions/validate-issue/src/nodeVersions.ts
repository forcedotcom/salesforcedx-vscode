/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as HttpClient from '@effect/platform/HttpClient';
import * as HttpClientResponse from '@effect/platform/HttpClientResponse';
import * as DateTime from 'effect/DateTime';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import { isNotUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';

const VersionInfo = Schema.Struct({ start: Schema.String, end: Schema.String });
const VersionSchedule = Schema.Record({ key: Schema.String, value: VersionInfo });

export const isAnyVersionValid = Effect.fn('nodeVersions.isAnyVersionValid')(function* (versions: string[]) {
  const currentDate = yield* DateTime.now;
  const schedule = yield* HttpClient.get('https://raw.githubusercontent.com/nodejs/Release/main/schedule.json').pipe(
    Effect.flatMap(HttpClientResponse.schemaBodyJson(VersionSchedule))
  );

  return versions.some(version => {
    const release = schedule[`v${version}`];
    if (isNotUndefined(release)) {
      const start = DateTime.make(release.start);
      const end = DateTime.make(release.end);
      return (
        Option.isSome(start) &&
        Option.isSome(end) &&
        DateTime.greaterThanOrEqualTo(currentDate, start.value) &&
        DateTime.lessThanOrEqualTo(currentDate, end.value)
      );
    }
    return false;
  });
});
