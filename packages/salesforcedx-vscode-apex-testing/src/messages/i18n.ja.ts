/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { MessageKey } from './i18n';

export const messages: Partial<Record<MessageKey, string>> = {
  apex_generate_unit_test_class_text: 'SFDX: Apex ユニットテストクラスを作成',
  apex_test_class_output_dir_prompt: '出力ディレクトリを選択',
  apex_test_class_name_prompt: 'Apex テストクラス名を入力',
  apex_test_class_name_placeholder: 'マイテスト',
  apex_unit_test_template_description: 'サンプルテストメソッド付きテンプレート',
  basic_unit_test_template_description: '最小限のテンプレート',
  apex_test_template_prompt: 'テンプレートタイプを選択',
  apex_generate_class_success: 'Apex クラスが正常に作成されました'
};
