/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { GitHub } from '@salesforce/effect-octokit';
import type * as Effect from 'effect/Effect';

type Release = Pick<
  Effect.Effect.Success<ReturnType<typeof GitHub.releases>>[number],
  'tag_name' | 'published_at' | 'body'
>;

// Only main extension releases (v66.7.0 format, not soql-common-v1.0.0), newest-first.
export const selectExtensionReleases = (releases: readonly Release[]): Release[] =>
  releases
    .filter(release => /^v\d+\.\d+\.\d+$/.test(release.tag_name))
    .toSorted((a, b) => new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime());

/** Extract only this release's first changelog section; older bodies include full history. */
export const formatReleaseAsChangelog = (release: Release): string => {
  const version = release.tag_name.replace(/^v/, '');
  const date = new Date(release.published_at ?? 0).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // If no body, create a minimal entry
  if (!release.body?.trim()) {
    return `# ${version} - ${date}\n\nSee [GitHub Release](https://github.com/forcedotcom/salesforcedx-vscode/releases/tag/v${version}) for details.\n`;
  }

  const lines = release.body.trim().split('\n');
  const extractedLines = [];
  let foundFirstHeader = false;

  for (const line of lines) {
    // Version headers start with "# " followed by a version number
    const isVersionHeader = /^# \d+\.\d+\.\d+/.test(line);

    if (isVersionHeader) {
      if (foundFirstHeader) {
        // Found the SECOND version header - stop here.
        // This release included historical changelog, we only want the first section.
        break;
      }
      foundFirstHeader = true;
    }

    extractedLines.push(line);
  }

  const extracted = extractedLines.join('\n').trim();

  // Ensure it has the version header
  if (!extracted.startsWith(`# ${version}`)) {
    return `# ${version} - ${date}\n\n${extracted}`;
  }

  return extracted;
};
