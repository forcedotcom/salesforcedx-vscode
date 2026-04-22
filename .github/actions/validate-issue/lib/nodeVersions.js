"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAnyVersionValid = void 0;
const isAnyVersionValid = (currentDate) => async (versions) => {
    const resp = (await (await fetch("https://raw.githubusercontent.com/nodejs/Release/main/schedule.json")).json());
    return versions
        .map((version) => `v${version}`)
        .some((formattedVersion) => formattedVersion in resp &&
        currentDate >= new Date(resp[formattedVersion].start) &&
        currentDate <= new Date(resp[formattedVersion].end));
};
exports.isAnyVersionValid = isAnyVersionValid;
//# sourceMappingURL=nodeVersions.js.map