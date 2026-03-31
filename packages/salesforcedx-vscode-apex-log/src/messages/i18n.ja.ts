/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { MessageKey } from './i18n';

export const messages: Partial<Record<MessageKey, string>> = {
  name_cannot_be_default: '"default" という名前は使用できません',
  name_empty_error: '名前を入力してください',
  name_format_error: '名前は文字で始まり、英数字とアンダースコアのみ使用できます',
  name_max_length_error: '名前は %d 文字を超えることはできません',
  output_dir_prompt: '出力ディレクトリを選択',
  template_type_prompt: 'テンプレートタイプを選択',
  apex_class_name_prompt: 'Apex クラス名を入力',
  apex_class_default_template_description: 'コンストラクター付きの標準 Apex クラス',
  apex_class_exception_template_description: 'カスタム例外クラス',
  apex_class_inbound_email_template_description: '受信メールサービスハンドラー',
  apex_generate_class_success: 'Apex クラスが正常に作成されました',
  apex_trigger_name_prompt: 'Apex トリガ名を入力',
  apex_generate_trigger_success: 'Apex トリガが作成されました',
  apex_test_class_name_prompt: 'Apex テストクラス名を入力',
  apex_unit_test_template_description: 'サンプルテストメソッド付きテンプレート',
  basic_unit_test_template_description: '最小限のテンプレート'
};
