/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { MessageKey } from './i18n';

export const messages: Partial<Record<MessageKey, string>> = {
  retrieving_tests_message: 'テストを取得しています…',
  apex_test_suites_parent_text: 'Apex テストスイート',
  apex_test_suite_edit_text: 'SFDX: Apex テストスイートを編集',
  colorizer_coverage_apply_failed_message: 'コードカバレッジを適用できませんでした。%s',
  apex_test_suite_name_input_prompt: '希望する Apex テストスイート名を入力してください:',
  apex_test_aggregate_failed_message: '%s 件のテストが失敗しました',
  apex_test_failed_no_details_message: 'テストが失敗しました',
  apex_test_suite_no_suites_message: 'Apex テストスイートが見つかりません。'
};
