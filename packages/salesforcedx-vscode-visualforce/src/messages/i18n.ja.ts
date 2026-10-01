/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { MessageKey } from './i18n';

export const messages: Partial<Record<MessageKey, string>> = {
  name_empty_error: '名前を入力してください',
  name_format_error:
    '名前は文字で始まり、英数字とアンダースコアのみ使用でき、アンダースコアで終わることができず、連続したアンダースコアを含めることができません',
  name_max_length_error: '名前は %d 文字を超えることはできません',
  output_dir_prompt: '出力ディレクトリを選択',
  vf_page_name_prompt: 'Visualforce ページ名を入力',
  vf_component_name_prompt: 'Visualforce コンポーネント名を入力',
  vf_generate_page_success: 'Visualforce ページが正常に作成されました',
  vf_generate_component_success: 'Visualforce コンポーネントが正常に作成されました',
  visualforce_generate_page_text: 'SFDX: Visualforce ページを作成',
  visualforce_generate_component_text: 'SFDX: Visualforce コンポーネントを作成'
};
