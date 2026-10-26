/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { vi } from 'vitest';
import { messages } from '../../../src/messages/i18n';
import { noDefaultOrgMessage } from '../../../src/messages';

describe('noDefaultOrgMessage', () => {
  const getExtension = vi.mocked(vscode.extensions.getExtension);

  it('uses concise copy when the org extension is absent', () => {
    getExtension.mockReturnValue(undefined);
    expect(noDefaultOrgMessage()).toBe(messages.info_no_default_org_without_org_extension);
    expect(noDefaultOrgMessage()).not.toContain('Set a Default Org');
  });

  it('includes the Set a Default Org instructions when the org extension is installed', () => {
    getExtension.mockReturnValue({} as vscode.Extension<unknown>);
    expect(noDefaultOrgMessage()).toBe(messages.info_no_default_org);
    expect(noDefaultOrgMessage()).toContain('Set a Default Org');
  });
});
