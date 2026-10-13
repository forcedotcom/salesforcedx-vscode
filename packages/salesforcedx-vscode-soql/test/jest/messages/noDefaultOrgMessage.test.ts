/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { messages } from '../../../src/messages/i18n';
import { noDefaultOrgMessage } from '../../../src/messages';

describe('noDefaultOrgMessage', () => {
  const env = vscode.env as unknown as { uiKind: number };
  const originalUiKind = env.uiKind;

  afterEach(() => {
    env.uiKind = originalUiKind;
  });

  it('returns web copy without Set a Default Org instructions when uiKind is Web', () => {
    env.uiKind = vscode.UIKind.Web;
    expect(noDefaultOrgMessage()).toBe(messages.info_no_default_org_web);
    expect(noDefaultOrgMessage()).not.toContain('Set a Default Org');
  });

  it('returns full desktop copy when uiKind is Desktop', () => {
    env.uiKind = vscode.UIKind.Desktop;
    expect(noDefaultOrgMessage()).toBe(messages.info_no_default_org);
    expect(noDefaultOrgMessage()).toContain('Set a Default Org');
  });
});
