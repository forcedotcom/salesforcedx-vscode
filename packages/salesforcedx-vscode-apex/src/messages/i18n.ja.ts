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
 * If omitted, we will assume _message.
 */

import { MessageKey } from './i18n';

export const messages: Partial<Record<MessageKey, string>> = {
  anon_apex_execute_document_text: 'SFDX: エディタの内容で匿名 Apex コードを実行',
  anon_apex_execute_selection_text: 'SFDX: 現在選択されているテキストで匿名 Apex コードを実行',
  apex_execute_compile_success: '正常にコンパイルされました。',
  apex_execute_runtime_success: '正常に実行されました。',
  apex_execute_text: '匿名 Apex を実行',
  apex_execute_unexpected_error: '予期せぬエラー',
  apex_language_server_already_restarting: 'Apex 言語サーバは既に再起動中です。お待ちください。',
  apex_language_server_failed_activate: 'Apex 言語サーバを有効化できませんでした。',
  apex_language_server_loaded: 'インデックス化が完了しました $(check)',
  apex_language_server_loading: 'Apex ファイルをインデックス化しています。しばらくお待ちください... $(sync~spin)',
  apex_language_server_quit_and_restarting: 'Apex 言語サーバが停止しました。再起動中... %d/5',
  apex_language_server_restart: 'Apex 言語サーバを再起動',
  apex_language_server_restart_dialog_clean_and_restart: 'Apex DB をクリーンアップして再起動',
  apex_language_server_restart_dialog_prompt:
    'Apex DB をクリーンアップして再起動しますか？それとも再起動のみ行いますか？',
  apex_language_server_restart_dialog_restart_only: '再起動のみ',
  apex_language_server_restart_failed: 'Apex 言語サーバの再起動に失敗しました: ',
  apex_language_server_restarting: 'Apex 言語サーバを再起動しています... $(sync~spin)',
  apex_log_get_no_logs_text: 'Apex デバッグログが見つかりませんでした。',
  apex_log_get_pick_log_text: '取得する Apex デバッグログを選択',
  apex_log_get_text: 'SFDX: Apex デバッグログを取得',
  apex_log_list_text: 'Apex デバッグログを取得しています',
  cannot_determine_workspace: 'ワークスペースのフォルダを特定できませんでした。',
  client_name: 'Apex 言語サーバ',
  colorizer_no_code_coverage_current_file:
    'このファイルでコードカバレッジの情報が見つかりませんでした。ユーザまたはワークスペースの設定で、"salesforcedx-vscode-apex-testing.retrieve-test-code-coverage" を true に設定してください。次に、このファイルを含むApex テストを実行してください。Apex テストのサイドバーまたは、ファイル内の テストの実行 または すべてのテストの実行 のコードレンズを使用してテストを実行できます。',
  colorizer_no_code_coverage_on_project:
    'このプロジェクトでテスト実行の情報が見つかりませんでした。ユーザまたはワークスペースの設定で、"salesforcedx-vscode-apex-testing.retrieve-test-code-coverage" を true に設定してください。次に、Apex テストのサイドバーまたは、テストクラスファイル内の テストの実行 または すべてのテストの実行 のコードレンズを使用してテストを実行してください。',
  colorizer_no_code_coverage_on_test_results:
    'テスト実行 %s のコードカバレッジの情報が見つかりませんでした。ユーザまたはワークスペースの設定で、"salesforcedx-vscode-apex-testing.retrieve-test-code-coverage" を true に設定してください。次に、Apex テストのサイドバーまたは、テストクラスファイル内の テストの実行 または すべてのテストの実行 のコードレンズを使用してテストを実行してください。',
  colorizer_out_of_sync_code_coverage_data:
    'このファイルは更新されているようです。コードカバレッジの数値を更新するには、このファイルでテストを実行してください。',
  colorizer_statusbar_hover_text: 'Apex コードカバレッジを強調表示',
  java_binary_not_executable_text:
    '%s の Java バイナリ %s が実行可能ではありません。ファイルの権限を確認してください。',
  java_binary_missing_text: '%s の Java バイナリ %s が見つかりません。Java のインストールを確認してください。',
  java_bin_missing_text: '%s に Java bin ディレクトリが見つかりません。Java のインストールを確認してください。',
  java_home_expansion_failed_text: 'Java ホームパスの展開に失敗しました。Java のインストールを確認してください。',
  java_home_invalid_text:
    'Java ホームパス %s が無効です。Salesforce Apex 拡張機能の設定方法についての詳細は、[Java 設定](%s) を参照してください。',
  java_home_undefined_text:
    'Java ホームパスが設定されていません。設定または環境変数で Java ホームパスを設定してください。',
  java_runtime_local_text:
    'ローカルの Java ランタイム (%s) はサポートされていません。VS Code の設定の salesforcedx-vscode-apex.java.home に現在のプロジェクト以外のランタイムのパスを設定してください。詳細については、[Java 設定](%s) を参照してください。',
  java_runtime_missing_text:
    'Java ランタイムが見つかりませんでした。VS Code の設定の salesforcedx-vscode-apex.java.home にパスを指定してください。詳細については、[Java 設定](%s) を参照してください。',
  java_version_check_command_failed: 'Java コマンド %s の実行に失敗しました。エラー: %s',
  launch_apex_replay_debugger_unsupported_file:
    '匿名 Apex ファイル、Apex テストファイル、または Apex デバッグログファイルに対してのみこのコマンドを実行できます。',
  orphan_process_advice:
    '以下のプロセスリストは、適切にシャットダウンされなかった Apex 言語サーバのインスタンスです。\nこれらのプロセスは、この警告メッセージから停止することも、自分で処理することもできます。\n自分でこれらのプロセスを終了する場合は、関連するドキュメントを参照してプロセスを停止してください。',
  parent_process_id: '親プロセス ID',
  process_command: 'プロセスコマンド',
  process_id: 'プロセス ID',
  sobjects_no_refresh_if_already_active_error_text:
    'sObject 定義の更新が既に実行中です。プロセスを再起動する必要がある場合は、実行中のタスクをキャンセルしてください。',
  source_java_home_env_var_text: '環境変数 JAVA_HOME',
  source_java_home_setting_text: 'VS Code の設定で定義される salesforcedx-vscode-apex.java.home の設定',
  source_jdk_home_env_var_text: '環境変数 JDK_HOME',
  source_missing_text:
    '指定されたフォルダ %s は存在しません。Salesforce Apex 拡張機能の設定方法についての詳細は、[Java 設定](%s) を参照してください。',
  terminate_failed: 'Apex 言語サーバプロセス PID: %d の終了に失敗しました: %s',
  terminate_orphaned_language_server_instances:
    '%d 個の孤立した Apex 言語サーバプロセスが見つかりました。\nこれらを終了しますか？',
  terminate_processes: 'プロセスを終了',
  terminate_processes_confirm: '%d 個の孤立プロセスを終了',
  terminate_processes_title: '孤立プロセスの終了',
  terminate_show_processes: 'プロセスを表示',
  terminated_orphaned_process: 'Apex 言語サーバプロセス PID: %d を終了しました',
  terminated_orphaned_processes: '%d 個の孤立プロセスを終了しました。',
  unable_to_locate_document: 'ソースファイルに対してのみこのコマンドを実行できます。',
  unable_to_locate_editor: 'ソースファイルに対してのみこのコマンドを実行できます。',
  unknown: '不明',
  unknown_error: '不明なエラー',
  wrong_java_version_short: 'サポートされていない Java バージョン',
  wrong_java_version_text:
    'サポートされていない Java バージョンを検出しました。Java 11 以上がサポートされています。拡張機能の実行には [Java 21](https://www.oracle.com/java/technologies/downloads/#java21) を推奨します。詳細については、[Java バージョンの設定](%s) を参照してください。',
  yes: 'はい',
  launch_apex_replay_debugger_with_selected_file: '選択されたファイルで Apex リプレイデバッガを起動'
};
