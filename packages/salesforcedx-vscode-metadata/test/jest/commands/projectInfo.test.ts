/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { renderMarkdown } from '../../../src/commands/projectInfo';

describe('projectInfo renderMarkdown', () => {
  const render = (appName: string) =>
    renderMarkdown({
      metadataInfo: { typeStats: [], sourceApiVersion: '60.0', packageDirCount: 1, namespace: 'none' },
      orgInfo: { orgType: 'scratch', tracksSource: true, sourceMemberCount: 0 },
      settings: [],
      envInfo: {
        cliVersion: 'sf 2.0.0',
        javaVersion: 'openjdk 17',
        appName,
        vscodeVersion: '1.90.0',
        nodeVersion: 'v20.0.0',
        os: 'Darwin 24.0.0',
        extensions: []
      }
    });

  it('renders the editor app name row', () => {
    expect(render('Visual Studio Code')).toContain('| Editor | Visual Studio Code |');
  });

  it('does not render an undefined editor row', () => {
    expect(render('Visual Studio Code')).not.toContain('| Editor | undefined |');
  });
});
