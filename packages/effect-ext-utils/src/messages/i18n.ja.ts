/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MessageKey } from './i18n';

export const messages: Partial<Record<MessageKey, string>> = {
  predicates_no_folder_opened_text:
    'フォルダが開かれていません。VS Code で Salesforce DX 形式のプロジェクトを開いてください。',
  predicates_no_salesforce_project_found_text:
    '開かれたプロジェクトのルートディレクトリに sfdx-project.json ファイルが見つかりませんでした。VS Code で Salesforce DX 形式のプロジェクトを開いてください。'
};
