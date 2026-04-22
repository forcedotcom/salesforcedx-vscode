/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MessageKey } from './i18n';

/**
 * Conventions:
 * _message: is for unformatted text that will be shown as-is to
 * the user.
 * _text: is for text that will appear in the UI, possibly with
 * decorations, e.g., $(x) uses the https://octicons.github.com/ and should not
 * be localized
 *
 * If omitted, we will assume _message.
 */
export const messages: Partial<Record<MessageKey, string>> = {
  no_workspace_folder_found_for_test_text: 'このテストのワークスペースフォルダを特定できませんでした',
  lwc_test_controller_label: 'LWC テスト',
  run_test_title: 'テストを実行',
  debug_test_title: 'テストをデバッグ',
  run_all_tests_title: 'すべてのテストを実行',
  debug_all_tests_title: 'すべてのテストをデバッグ',
  run_test_task_name: 'テストを実行',
  watch_test_task_name: 'テストをウォッチ',
  default_task_name: 'LWC テスト',
  task_windows_command_prompt_messaging: 'タスク実行時のデフォルトのシェルが cmd.exe に設定されます',
  lightning_lwc_no_redhat_extension_found:
    'Salesforce js-meta.xml IntelliSense を使用するには、Red Hat XML 拡張機能が必要です。',
  lightning_lwc_deprecated_redhat_extension:
    'Salesforce js-meta.xml IntelliSense を使用するには、Red Hat XML 拡張機能のバージョン 0.14.0 以上が必要です。Red Hat XML 拡張機能をアップグレードしてください。',
  lightning_lwc_redhat_extension_regression:
    'Salesforce js-meta.xml IntelliSense は Red Hat XML 拡張機能のバージョン 0.15.0 では動作しません。Red Hat XML 拡張機能をアップグレードしてください。',
  lightning_lwc_fail_redhat_extension: 'Red Hat XML 拡張機能の設定に失敗しました',
  lwc_language_server_loading: 'LWC ファイルをインデックス化しています。しばらくお待ちください… $(sync~spin)',
  lwc_language_server_loaded: 'インデックス化が完了しました $(check)'
};
