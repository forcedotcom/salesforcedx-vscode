/*
 * Copyright (c) 2026, salesforce.com, inc.
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
  lwc_test_run_profile_title: 'SFDX: すべての LWC テストを実行',
  lwc_test_debug_profile_title: 'SFDX: すべての LWC テストをデバッグ',
  run_test_title: 'テストを実行 (LWC)',
  debug_test_title: 'テストをデバッグ (LWC)',
  run_all_tests_title: 'すべてのテストを実行 (LWC)',
  debug_all_tests_title: 'すべてのテストをデバッグ (LWC)',
  jest_runner_duplicate_codelens_message:
    'SFDX LWC 拡張機能と Jest Runner 拡張機能の両方がテストコードレンズを表示します。"(LWC)" レンズは、ネイティブ結果を使用してテストエクスプローラーでテストを実行します。',
  jest_runner_dont_show_again_button: '今後表示しない',
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
  template_type_prompt: 'テンプレートの種類を選択',
  lwc_builtin_templates_label: '組み込みテンプレート',
  lwc_custom_templates_label: 'カスタムテンプレート',
  lwc_preferred_template_label: '優先テンプレート',
  lwc_custom_template_override_description: 'カスタムテンプレート (組み込みの "%s" を上書き)',
  lwc_template_default_description: '標準の Lightning Web コンポーネント (JavaScript)',
  lwc_template_typescript_description: '標準の Lightning Web コンポーネント (TypeScript)',
  lwc_template_analytics_dashboard_description: 'CRM Analytics ダッシュボードコンポーネント',
  lwc_template_analytics_dashboard_with_step_description: 'CRM Analytics ダッシュボードコンポーネント (ステップ付き)',
  lwc_language_server_loading: 'LWC ファイルをインデックス化しています。しばらくお待ちください… $(sync~spin)',
  lwc_language_server_loaded: 'インデックス化が完了しました $(check)',
  rename_component_warning:
    '警告: 古い名前への参照は更新されません。手動で更新し、すべての変更が完了したら再デプロイしてください。',
  rename_component_input_dup_file_name_error:
    'このファイル名は現在のコンポーネントディレクトリで既に使用されています。別の名前を選択して再試行してください。',
  component_input_dup_error: 'コンポーネント名は LWC または Aura で既に使用されています'
};
