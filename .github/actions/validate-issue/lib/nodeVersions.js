"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAnyVersionValid = void 0;
const FetchHttpClient = require("@effect/platform/FetchHttpClient");
const HttpClient = require("@effect/platform/HttpClient");
const Effect = require("effect/Effect");
const Predicate_1 = require("effect/Predicate");
const Schema = require("effect/Schema");
const VersionInfo = Schema.Struct({ start: Schema.String, end: Schema.String });
const VersionSchedule = Schema.Record({ key: Schema.String, value: VersionInfo });
exports.isAnyVersionValid = Effect.fn('nodeVersions.isAnyVersionValid')(function* (currentDate, versions) {
    const json = yield* HttpClient.get('https://raw.githubusercontent.com/nodejs/Release/main/schedule.json').pipe(Effect.flatMap(response => response.json), Effect.provide(FetchHttpClient.layer));
    const schedule = yield* Schema.decodeUnknown(VersionSchedule)(json);
    return versions.some(version => {
        const release = schedule[`v${version}`];
        return ((0, Predicate_1.isNotUndefined)(release) &&
            currentDate >= new Date(release.start) &&
            currentDate <= new Date(release.end));
    });
});
//# sourceMappingURL=nodeVersions.js.map