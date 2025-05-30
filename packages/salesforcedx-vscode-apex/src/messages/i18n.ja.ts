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
export const messages = {
  active_text_editor_not_apex: 'アクティブなテキストエディタは Apex クラスファイルではありません',
  anon_apex_execute_document_text: 'SFDX: エディタの内容で匿名 Apex コードを実行',
  anon_apex_execute_selection_text: 'SFDX: 現在選択されているテキストで匿名 Apex コードを実行',
  apex_class_not_valid: 'Apex クラス %s は OpenAPI ドキュメント生成に適していません。',
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
  apex_test_run_all_local_test_label: 'すべてのローカルのテスト',
  apex_test_run_all_local_tests_description_text:
    'インストールされた管理パッケージに含まれるテストを除き、現在の組織にあるすべてのテストを実行',
  apex_test_run_all_test_label: 'すべてのテスト',
  apex_test_run_all_tests_description_text: '現在の組織にあるすべてのテストを実行',
  apex_test_run_codeAction_description_text: 'Apex テストを実行',
  apex_test_run_codeAction_no_class_test_param_text:
    'テストクラスがありません。@isTest アノテーションのあるクラスでコードアクションを実行してください。',
  apex_test_run_codeAction_no_method_test_param_text:
    'テストメソッドがありません. @isTest アノテーションまたは testMethod キーワードのあるメソッドでコードアクションを実行してください。',
  apex_test_run_description_text: 'Apex テストを実行',
  apex_test_run_text: 'SFDX: Apex テストを呼び出す',
  apex_test_suite_build_text: 'SFDX: Apex テストスイートを作成',
  artifact_failed: '成果物の保存に失敗しました: %s',
  cannot_determine_workspace: 'ワークスペースのフォルダを特定できませんでした。',
  cannot_gather_context: 'Apex クラスのコンテキスト収集中にエラーが発生しました。',
  cannot_get_apexoaseligibility_response: 'Apex 言語サーバからの apexoas/isEligible の応答を取得できませんでした',
  cancel: 'キャンセル',
  channel_name: 'Apex',
  check_openapi_doc_failed: 'OpenAPI ドキュメントのチェックに失敗しました',
  check_openapi_doc_succeeded: 'OpenAPI ドキュメント %s の検証に成功しました',
  class_validation_failed: '%s からの適格性の検証に失敗しました',
  cleanup_openapi_doc_failed: 'ソースで OpenAPI ドキュメントが見つかりませんでした:\n',
  client_name: 'Apex 言語サーバ',
  colorizer_no_code_coverage_current_file:
    'このファイルでコードカバレッジの情報が見つかりませんでした。ユーザまたはワークスペースの設定で、"salesforcedx-vscode-core.retrieve-test-code-coverage" を true に設定してください。次に、このファイルを含むApex テストを実行してください。Apex テストのサイドバーまたは、ファイル内の テストの実行 または すべてのテストの実行 のコードレンズを使用してテストを実行できます。',
  colorizer_no_code_coverage_on_project:
    'このプロジェクトでテスト実行の情報が見つかりませんでした。ユーザまたはワークスペースの設定で、"salesforcedx-vscode-core.retrieve-test-code-coverage" を true に設定してください。次に、Apex テストのサイドバーまたは、テストクラスファイル内の テストの実行 または すべてのテストの実行 のコードレンズを使用してテストを実行してください。',
  colorizer_no_code_coverage_on_test_results:
    'テスト実行 %s のコードカバレッジの情報が見つかりませんでした。ユーザまたはワークスペースの設定で、"salesforcedx-vscode-core.retrieve-test-code-coverage" を true に設定してください。次に、Apex テストのサイドバーまたは、テストクラスファイル内の テストの実行 または すべてのテストの実行 のコードレンズを使用してテストを実行してください。',
  colorizer_out_of_sync_code_coverage_data:
    'このファイルは更新されているようです。コードカバレッジの数値を更新するには、このファイルでテストを実行してください。',
  colorizer_statusbar_hover_text: 'Apex コードカバレッジを強調表示',
  create_openapi_doc_failed: 'OpenAPI ドキュメントの作成に失敗しました',
  eligible_method_not_in_doc: 'メソッド %s は OAS 生成に適格ですが、ドキュメントに存在しません',
  enter_new_nc: 'カスタムの名前付き認証情報を入力...',
  enter_nc_name: '名前付き認証情報の名前を入力',
  error_parsing_nc: '名前付き認証情報の結果の解析中にエラーが発生しました',
  error_parsing_yaml: 'YAML の解析中にエラーが発生しました',
  error_retrieving_org_version: '組織バージョンの取得に失敗しました',
  failed_to_combine_oas: 'yaml ドキュメントの結合に失敗しました',
  failed_to_parse_yaml: 'ドキュメントを YAML として解析できませんでした: %s',
  file_exists: 'ファイルは既に存在します。どのように処理しますか？',
  full_path_failed: 'OpenAPI ドキュメントの完全なパスを特定できませんでした。',
  gathering_context: 'コンテキストデータを収集中です。',
  generate_openapi_document: 'OpenAPI ドキュメントを生成中です。',
  generating_oas_doc: 'OpenAPI ドキュメントを生成中です。',
  get_document_path: 'OpenAPI ドキュメントフォルダ名を取得',
  ineligible_method_in_doc: 'メソッド %s は OAS 生成に適格ではありませんが、ドキュメントに存在します',
  invalid_active_text_editor: 'アクティブなテキストエディタが存在しないか、無効なファイルです。',
  invalid_file_for_generating_oas_doc: 'OAS ドキュメント生成に無効なファイルです',
  invalid_file_for_processing_oas_doc: 'OAS ドキュメント処理に無効なファイルです',
  invalid_named_credential: '名前付き認証情報が提供されていないか、無効です。',
  java_binary_not_executable_text:
    '%s の Java バイナリ %s が実行可能ではありません。ファイルの権限を確認してください。',
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
  merge: '既存の ESR と手動でマージ',
  method_not_found_in_doc_symbols: 'メソッド %s がドキュメントシンボルに見つかりません',
  no_eligible_method: 'クラスに適格なメソッドが見つかりません',
  no_folder_selected: '操作がキャンセルされました: フォルダが選択されていません。',
  no_oas_doc_in_file: 'ファイルに OAS ドキュメントが検出されませんでした',
  no_oas_generated: 'LLM がコンテンツを返しませんでした。',
  not_eligible_method:
    'メソッド %s は OpenAPI ドキュメント生成に適していません。http アノテーションがないか、アクセス修飾子が正しくありません。',
  openapi_doc_created: '%s の OpenAPI ドキュメントを作成しました: %s',
  openapi_doc_created_merge:
    '%s の新しい OpenAPI ドキュメント %s %s が作成されました。差分エディタを使用して2つのファイルを手動でマージしてください。',
  operation_cancelled: '操作がキャンセルされました',
  operations_element_not_found: '提供された XML に <operations> 要素が見つかりませんでした。',
  orphan_process_advice:
    '以下のプロセスリストは、適切にシャットダウンされなかった Apex 言語サーバのインスタンスです。\nこれらのプロセスは、この警告メッセージから停止することも、自分で処理することもできます。\n自分でこれらのプロセスを終了する場合は、関連するドキュメントを参照してプロセスを停止してください。',
  overwrite: '上書き',
  parent_process_id: '親プロセス ID',
  process_command: 'プロセスコマンド',
  process_id: 'プロセス ID',
  processing_generated_oas: '生成された OpenAPI ドキュメントを検証中です。',
  registry_access_failed: 'レジストリから ESR ディレクトリ名を取得できませんでした。',
  schema_element_not_found: '提供された XML に <schema> 要素が見つかりませんでした。',
  select_folder_for_oas: 'OpenAPI ドキュメントを保存するフォルダを選択',
  select_named_credential: '名前付き認証情報を選択',
  sobjects_no_refresh_if_already_active_error_text:
    'sObject 定義の更新が既に実行中です。プロセスを再起動する必要がある場合は、実行中のタスクをキャンセルしてください。',
  source_java_home_env_var_text: '環境変数 JAVA_HOME',
  source_java_home_setting_text: 'VS Code の設定で定義される salesforcedx-vscode-apex.java.home の設定',
  source_jdk_home_env_var_text: '環境変数 JDK_HOME',
  source_missing_text:
    '指定されたフォルダ %s は存在しません。Salesforce Apex 拡張機能の設定方法についての詳細は、[Java 設定](%s) を参照してください。',
  strategy_not_qualified: '選択されたクラスまたはメソッドに適した生成戦略がありません。',
  terminate_failed: 'Apex 言語サーバプロセス PID: %d の終了に失敗しました: %s',
  terminate_orphaned_language_server_instances:
    '%d 個の孤立した Apex 言語サーバプロセスが見つかりました。\nこれらを終了しますか？',
  terminate_processes: 'プロセスを終了',
  terminate_processes_confirm: '%d 個の孤立プロセスを終了',
  terminate_processes_title: '孤立プロセスの終了',
  terminate_show_processes: 'プロセスを表示',
  terminated_orphaned_process: 'Apex 言語サーバプロセス PID: %d を終了しました',
  terminated_orphaned_processes: '%d 個の孤立プロセスを終了しました。',
  test_view_loading_message: 'Apex テストを読み込んでいます...',
  test_view_no_tests_description:
    'プロジェクトに Apex テストメソッドがありません。Apex テストを実行するには、@isTest アノテーションまたは testMethod キーワードのあるメソッドを含むプロジェクトを開いてください。',
  test_view_no_tests_message: 'Apex テストが見つかりませんでした',
  test_view_show_error_title: 'エラーを表示',
  unable_to_locate_document: 'ソースファイルに対してのみこのコマンドを実行できます。',
  unable_to_locate_editor: 'ソースファイルに対してのみこのコマンドを実行できます。',
  unknown: '不明',
  unknown_error: '不明なエラー',
  validate_eligibility: '適格性を検証中です。',
  validation_failed: '適格性の検証に失敗しました。',
  write_openapi_document: 'OpenAPI ドキュメントを書き込み中です。',
  wrong_java_version_short: 'サポートされていない Java バージョン',
  wrong_java_version_text:
    'サポートされていない Java バージョンを検出しました。Java 11 以上がサポートされています。拡張機能の実行には [Java 21](https://www.oracle.com/java/technologies/downloads/#java21) を推奨します。詳細については、[Java バージョンの設定](%s) を参照してください。',
  yes: 'はい'
};
