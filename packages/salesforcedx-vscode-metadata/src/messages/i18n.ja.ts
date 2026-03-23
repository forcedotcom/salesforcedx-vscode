/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { MessageKey } from './i18n';

/** Japanese strings; partial — missing keys fall back to English base bundle. Ported from core where noted. */
export const messages: Partial<Record<MessageKey, string>> = {
  apex_trigger_name_prompt: 'ファイル名を入力',
  apex_name_empty_error: 'トリガ名を入力してください',
  apex_name_format_error:
    'トリガ名は文字で始まり、英数字とアンダースコアのみ使用できます',
  apex_class_name_max_length_error: 'ファイル名は %s 文字を超えることはできません',
  apex_trigger_output_dir_prompt: 'フォルダを入力 (Enter で確認または Esc でキャンセル)',
  apex_generate_trigger_success: 'Apex トリガが作成されました',
  // NOTE: Japanese overrides are partial; missing keys fall back to the base bundle.
};
