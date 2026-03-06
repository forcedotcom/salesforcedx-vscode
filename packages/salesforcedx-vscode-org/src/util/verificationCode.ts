/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as crypto from 'node:crypto';
import * as vscode from 'vscode';
import { nls } from '../messages';

export const generateVerificationCode = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex').slice(0, 4);

export const showVerificationCodeIfNeeded = (): void => {
  const codeBuilderState = process.env.CODE_BUILDER_STATE;
  if (codeBuilderState) {
    const code = generateVerificationCode(codeBuilderState);
    void vscode.window.showInformationMessage(
      nls.localize('org_login_web_verification_code_message', code)
    );
  }
};
