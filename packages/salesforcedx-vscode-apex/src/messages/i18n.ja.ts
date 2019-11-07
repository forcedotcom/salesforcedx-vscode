/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Conventions:
 * _message: is for unformatted text that will be shown as-is to
 * the user.
 * _text: is for text that will appear in the UI, possibly with
 * decorations, e.g., $(x) uses the https://octicons.github.com/ and should not
 * be localized
 *
 * If ommitted, we will assume _message.
 */
export const messages = {
  source_java_home_setting_text:
    'VS Code の設定で定義される salesforcedx-vscode-apex.java.home の設定',
  source_jdk_home_env_var_text: '環境変数 JDK_HOME',
  source_java_home_env_var_text: '環境変数 JAVA_HOME',
  source_missing_text:
    '指定されたフォルダ %s は存在しません。Salesforce Apex 拡張機能の設定方法についての詳細は、[Java 設定](%s) を参照してください。',
  java_runtime_missing_text:
    'Java ランタイムが見つかりませんでした。VS Code の設定の salesforcedx-vscode-apex.java.home にパスを指定してください。詳細については、[Java 設定](%s) を参照してください。',
  force_sobjects_refresh: 'SFDX: SObject の定義を更新',
  force_apex_test_run_codeAction_description_text: 'Apex テストを実行',
  force_apex_test_run_codeAction_no_class_test_param_text:
    'テストクラスがありません。@isTest アノテーションのあるクラスでコードアクションを実行してください。',
  force_apex_test_run_codeAction_no_method_test_param_text:
    'テストメソッドがありません. @isTest アノテーションまたは testMethod キーワードのあるメソッドでコードアクションを実行してください。',
  force_apex_test_run_description_text: 'Apex テストを実行',
  force_test_view_loading_message: 'Apex テストを読み込んでいます...',
  force_test_view_no_tests_message: 'Apex テストが見つかりませんでした',
  force_test_view_show_error_title: 'エラーを表示',
  force_test_view_no_tests_description:
    'プロジェクトに Apex テストメソッドがありません。Apex テストを実行するには、@isTest アノテーションまたは testMethod キーワードのあるメソッドを含むプロジェクトを開いてください。',
  wrong_java_version_text:
    '実行には Java 8 が必要です。https://java.com/ja/download/ からダウンロードしてインストールしてください。詳細については、[Java バージョンを設定する](%s) を参照してください。',

  client_name: 'Apex 言語サーバ',
  cannot_determine_workspace:
    'ワークスペースのフォルダを特定できませんでした。',
  colorizer_no_code_coverage_on_project:
    'このプロジェクトでテスト実行の情報が見つかりませんでした。ユーザまたはワークスペースの設定で、"salesforcedx-vscode-core.retrieve-test-code-coverage" を true に設定してください。次に、Apex テストのサイドバーまたは、テストクラスファイル内の テストの実行 または すべてのテストの実行 のコードレンズを使用してテストを実行してください。',
  colorizer_no_code_coverage_on_test_results:
    'テスト実行 %s のコードカバレッジの情報が見つかりませんでした。ユーザまたはワークスペースの設定で、"salesforcedx-vscode-core.retrieve-test-code-coverage" を true に設定してください。次に、Apex テストのサイドバーまたは、テストクラスファイル内の テストの実行 または すべてのテストの実行 のコードレンズを使用してテストを実行してください。',
  colorizer_out_of_sync_code_coverage_data:
    'このファイルは更新されているようです。コードカバレッジの数値を更新するには、このファイルでテストを実行してください。',
  colorizer_no_code_coverage_current_file:
    'このファイルでコードカバレッジの情報が見つかりませんでした。ユーザまたはワークスペースの設定で、"salesforcedx-vscode-core.retrieve-test-code-coverage" を true に設定してください。次に、このファイルを含むApex テストを実行してください。Apex テストのサイドバーまたは、ファイル内の テストの実行 または すべてのテストの実行 のコードレンズを使用してテストを実行できます。',
  colorizer_statusbar_hover_text: 'Apex コードカバレッジを強調表示',
  force_sobjects_no_refresh_if_already_active_error_text:
    'sObject 定義の更新が既に実行中です。プロセスを再起動する必要がある場合は、実行中のタスクをキャンセルしてください。',
  apex_language_server_failed_activate:
    'Apex 言語サーバを有効化できませんでした。',
  sobject_refresh_all: 'すべてのオブジェクト',
  sobject_refresh_custom: 'カスタムオブジェクト',
  sobject_refresh_standard: '標準オブジェクト'
};
