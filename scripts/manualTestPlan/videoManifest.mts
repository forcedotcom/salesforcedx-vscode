/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Option, Schema } from 'effect';

export const VideoTarget = Schema.Struct({
  spec: Schema.String.pipe(Schema.pattern(/^packages\/[\w-]+\/test\/playwright\/[\w./-]+\.spec\.ts$/)),
  workflow: Schema.NonEmptyString,
  job: Schema.String.pipe(Schema.pattern(/^[\w-]+$/))
});
export type VideoTarget = typeof VideoTarget.Type;
const VideoManifest = Schema.Struct({ sha: Schema.NonEmptyString, targets: Schema.Array(VideoTarget) });

const manifestMarker = '<!-- manual-test-plan-video-targets ';
export const videosStart = '<!-- manual-test-plan-videos -->';
export const videosEnd = '<!-- /manual-test-plan-videos -->';

// Escaping '<' also prevents a model-provided string from closing the HTML comment.
export const renderVideoManifest = (manifest: typeof VideoManifest.Type) =>
  `${manifestMarker}${JSON.stringify(manifest).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e')} -->`;

export const readVideoManifest = (body: string) => {
  const start = body.indexOf(manifestMarker);
  const end = body.indexOf(' -->', start);
  return start < 0 || end < start
    ? Option.none()
    : Schema.decodeUnknownOption(Schema.parseJson(VideoManifest))(body.slice(start + manifestMarker.length, end));
};

export const videoSection = (body: string) => {
  const start = body.indexOf(videosStart);
  const end = body.indexOf(videosEnd, start);
  return start < 0 || end < start ? undefined : body.slice(start, end + videosEnd.length);
};

/** Remove only the generated block; every byte outside the markers survives. */
export const removeVideoSection = (body: string) => {
  const section = videoSection(body);
  return section === undefined ? body : body.replace(section, '');
};

export const appendVideoSection = (body: string, section: string) => `${removeVideoSection(body)}${section}`;
