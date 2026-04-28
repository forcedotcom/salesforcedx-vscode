/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { messages } from '../../../src/messages/i18n';
import { ApexTestingDecorationProvider } from '../../../src/discoveryVfs/apexTestingDecorationProvider';

describe('ApexTestingDecorationProvider', () => {
  it('returns ORG read-only decoration for apex-testing URIs', () => {
    const provider = new ApexTestingDecorationProvider();
    const decoration = provider.provideFileDecoration(URI.parse('apex-testing:/orgs/org123/classes/MyTest.cls')) as
      | vscode.FileDecoration
      | undefined;

    expect(decoration?.badge).toBe(messages.apex_testing_vfs_org_badge_text);
    expect(decoration?.tooltip).toBe(messages.apex_testing_vfs_org_file_tooltip_text);
  });

  it('returns undefined for non apex-testing URIs', () => {
    const provider = new ApexTestingDecorationProvider();
    const decoration = provider.provideFileDecoration(URI.parse('file:///tmp/MyTest.cls'));

    expect(decoration).toBeUndefined();
  });
});
