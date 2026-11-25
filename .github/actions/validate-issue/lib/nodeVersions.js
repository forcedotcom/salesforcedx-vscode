"use strict";
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAnyVersionValid = void 0;
const HttpClient = require("@effect/platform/HttpClient");
const HttpClientResponse = require("@effect/platform/HttpClientResponse");
const DateTime = require("effect/DateTime");
const Effect = require("effect/Effect");
const Option = require("effect/Option");
const Predicate_1 = require("effect/Predicate");
const Schema = require("effect/Schema");
const VersionInfo = Schema.Struct({ start: Schema.String, end: Schema.String });
const VersionSchedule = Schema.Record({ key: Schema.String, value: VersionInfo });
exports.isAnyVersionValid = Effect.fn('nodeVersions.isAnyVersionValid')(function* (versions) {
    const currentDate = yield* DateTime.now;
    const schedule = yield* HttpClient.get('https://raw.githubusercontent.com/nodejs/Release/main/schedule.json').pipe(Effect.flatMap(HttpClientResponse.schemaBodyJson(VersionSchedule)));
    return versions.some(version => {
        const release = schedule[`v${version}`];
        if ((0, Predicate_1.isNotUndefined)(release)) {
            const start = DateTime.make(release.start);
            const end = DateTime.make(release.end);
            return (Option.isSome(start) &&
                Option.isSome(end) &&
                DateTime.greaterThanOrEqualTo(currentDate, start.value) &&
                DateTime.lessThanOrEqualTo(currentDate, end.value));
        }
        return false;
    });
});
//# sourceMappingURL=nodeVersions.js.map