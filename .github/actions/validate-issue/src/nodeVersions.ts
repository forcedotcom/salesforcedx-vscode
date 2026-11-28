/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as DateTime from 'effect/DateTime';
import * as Effect from 'effect/Effect';
import * as HttpClient from 'effect/http/HttpClient';
import * as HttpClientResponse from 'effect/http/HttpClientResponse';
import * as Option from 'effect/Option';
import { isNotUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';

const VersionInfo = Schema.Struct({ start: Schema.String, end: Schema.String });
const VersionSchedule = Schema.Record(Schema.String, VersionInfo);

export const isAnyVersionValid = Effect.fn('nodeVersions.isAnyVersionValid')(function* (versions: string[]) {
  const currentDate = yield* DateTime.now;
  const client = yield* HttpClient.HttpClient;
  const schedule = yield* client
    .get('https://raw.githubusercontent.com/nodejs/Release/main/schedule.json')
    .pipe(Effect.flatMap(HttpClientResponse.schemaBodyJson(VersionSchedule)));

  return versions.some(version => {
    const release = schedule[`v${version}`];
    if (isNotUndefined(release)) {
      const start = DateTime.make(release.start);
      const end = DateTime.make(release.end);
      return (
        Option.isSome(start) &&
        Option.isSome(end) &&
        DateTime.isGreaterThanOrEqualTo(currentDate, start.value) &&
        DateTime.isLessThanOrEqualTo(currentDate, end.value)
      );
    }
    return false;
  });
});
