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
  apex_execute_compile_success: '正常にコンパイルされました。',
  apex_execute_runtime_success: '正常に実行されました。',
  apex_execute_text: '匿名 Apex を実行',
  apex_execute_unexpected_error: '予期せぬエラー',
  apex_language_server_failed_activate: 'Apex 言語サーバを有効化できませんでした。',
  cannot_determine_workspace: 'ワークスペースのフォルダを特定できませんでした。',
  channel_name: 'Apex',
  client_name: 'Apex 言語サーバ',
  colorizer_no_code_coverage_on_project:
    'このプロジェクトでテスト実行の情報が見つかりませんでした。ユーザまたはワークスペースの設定で、"salesforcedx-vscode-core.retrieve-test-code-coverage" を true に設定してください。次に、Apex テストのサイドバーまたは、テストクラスファイル内の テストの実行 または すべてのテストの実行 のコードレンズを使用してテストを実行してください。',
  colorizer_no_code_coverage_on_test_results:
    'テスト実行 %s のコードカバレッジの情報が見つかりませんでした。ユーザまたはワークスペースの設定で、"salesforcedx-vscode-core.retrieve-test-code-coverage" を true に設定してください。次に、Apex テストのサイドバーまたは、テストクラスファイル内の テストの実行 または すべてのテストの実行 のコードレンズを使用してテストを実行してください。',
  colorizer_out_of_sync_code_coverage_data:
    'このファイルは更新されているようです。コードカバレッジの数値を更新するには、このファイルでテストを実行してください。',
  colorizer_no_code_coverage_current_file:
    'このファイルでコードカバレッジの情報が見つかりませんでした。ユーザまたはワークスペースの設定で、"salesforcedx-vscode-core.retrieve-test-code-coverage" を true に設定してください。次に、このファイルを含むApex テストを実行してください。Apex テストのサイドバーまたは、ファイル内の テストの実行 または すべてのテストの実行 のコードレンズを使用してテストを実行できます。',
  colorizer_statusbar_hover_text: 'Apex コードカバレッジを強調表示',
  anon_apex_execute_document_text: 'SFDX: エディタの内容で匿名 Apex コードを実行',
  anon_apex_execute_selection_text: 'SFDX: 現在選択されているテキストで匿名 Apex コードを実行',
  apex_log_get_text: 'SFDX: Apex デバッグログを取得',
  apex_log_get_no_logs_text: 'Apex デバッグログが見つかりませんでした。',
  apex_log_get_pick_log_text: '取得する Apex デバッグログを選択',
  apex_log_list_text: 'Apex デバッグログを取得しています',
  apex_test_run_all_test_label: 'すべてのテスト',
  apex_test_run_all_local_test_label: 'すべてのローカルのテスト',
  apex_test_run_all_tests_description_text: '現在の組織にあるすべてのテストを実行',
  apex_test_run_all_local_tests_description_text:
    'インストールされた管理パッケージに含まれるテストを除き、現在の組織にあるすべてのテストを実行',
  apex_test_run_codeAction_description_text: 'Apex テストを実行',
  apex_test_run_codeAction_no_class_test_param_text:
    'テストクラスがありません。@isTest アノテーションのあるクラスでコードアクションを実行してください。',
  apex_test_run_codeAction_no_method_test_param_text:
    'テストメソッドがありません. @isTest アノテーションまたは testMethod キーワードのあるメソッドでコードアクションを実行してください。',
  apex_test_run_description_text: 'Apex テストを実行',
  apex_test_run_text: 'SFDX: Apex テストを呼び出す',
  create_openapi_doc_failed: 'Failed to create OpenAPI Document',
  validate_eligibility: 'Validating eligibility.',
  processing_generated_oas: 'Verifying generated OpenAPI doc.',
  generating_oas_doc: 'Generating OpenAPI doc.',
  gathering_context: 'Gathering context data.',
  class_validation_failed: 'Failed to validate eligibility from %s',
  validation_failed: 'Failed to validate eligibility.',
  apex_class_not_valid: 'The Apex Class %s is not valid for OpenAPI document generation.',
  openapi_doc_created: 'OpenAPI Document created for %s: %s.',
  openapi_doc_created_merge:
    'A new OpenAPI Document %s %s is created for %s. Manually merge the two files using the diff editor.',
  generate_openapi_document: 'Generating OpenAPI document.',
  write_openapi_document: 'Writing OpenAPI Document.',
  not_eligible_method:
    'Method %s is not eligible for OpenAPI Document creation. It is not annotated with @AuraEnabled or has wrong access modifiers.',
  unknown: 'Unknown',
  invalid_active_text_editor: 'The active text editor is missing or is an invalid file.',
  cannot_gather_context: 'An error occurred while gathering context for the Apex class.',
  sobjects_no_refresh_if_already_active_error_text:
    'sObject 定義の更新が既に実行中です。プロセスを再起動する必要がある場合は、実行中のタスクをキャンセルしてください。',
  test_view_loading_message: 'Apex テストを読み込んでいます...',
  test_view_no_tests_message: 'Apex テストが見つかりませんでした',
  test_view_show_error_title: 'エラーを表示',
  test_view_no_tests_description:
    'プロジェクトに Apex テストメソッドがありません。Apex テストを実行するには、@isTest アノテーションまたは testMethod キーワードのあるメソッドを含むプロジェクトを開いてください。',
  java_runtime_missing_text:
    'Java ランタイムが見つかりませんでした。VS Code の設定の salesforcedx-vscode-apex.java.home にパスを指定してください。詳細については、[Java 設定](%s) を参照してください。',
  java_runtime_local_text:
    'ローカルの Java ランタイム (%s) はサポートされていません。VS Code の設定の salesforcedx-vscode-apex.java.home に現在のプロジェクト以外のランタイムのパスを設定してください。詳細については、[Java 設定](%s) を参照してください。',
  source_jdk_home_env_var_text: '環境変数 JDK_HOME',
  source_java_home_env_var_text: '環境変数 JAVA_HOME',
  source_java_home_setting_text: 'VS Code の設定で定義される salesforcedx-vscode-apex.java.home の設定',
  source_missing_text:
    '指定されたフォルダ %s は存在しません。Salesforce Apex 拡張機能の設定方法についての詳細は、[Java 設定](%s) を参照してください。',
  wrong_java_version_text:
    'We detected an unsupported Java version. Java versions 11 or higher are supported. We recommend [Java 21](https://www.oracle.com/java/technologies/downloads/#java21) to run the extensions. For more information, see [Set Your Java Version](%s).',
  apex_test_suite_build_text: 'SFDX: Apex テストスイートを作成',
  unable_to_locate_editor: 'ソースファイルに対してのみこのコマンドを実行できます。',
  unable_to_locate_document: 'ソースファイルに対してのみこのコマンドを実行できます。',
  launch_apex_replay_debugger_unsupported_file:
    '匿名 Apex ファイル、Apex テストファイル、または Apex デバッグログファイルに対してのみこのコマンドを実行できます。',
  cancel: 'Cancel',
  overwrite: 'Overwrite',
  file_exists: 'The file already exists. How do you want to proceed?',
  no_folder_selected: 'Operation canceled: No folder selected.',
  operation_cancelled: 'Operation canceled',
  select_folder_for_oas: 'Select folder to store OpenAPI Document',
  select_named_credential: 'Select a Named Credential',
  error_parsing_nc: 'Error parsing named credentials result',
  artifact_failed: 'Failed to save the artifact: %s',
  enter_new_nc: 'Enter a custom Named Credential...',
  enter_nc_name: 'Enter the name of the Named Credential',
  registry_access_failed: 'Failed to retrieve ESR directory name from the registry.',
  full_path_failed: 'Failed to determine the full path for the OpenAPI document.',
  schema_element_not_found: 'The <schema> element was not found in the provided XML.',
  operations_element_not_found: 'The <operations> element was not found in the provided XML.',
  invalid_named_credential: 'The named credential is either not provided or invalid.',
  error_retrieving_org_version: 'Failed to retrieve org version',
  error_parsing_yaml: 'Error parsing YAML',
  no_oas_generated: 'LLM did not return any content.',
  failed_to_combine_oas: 'Failed to combine yaml docs',
  strategy_not_qualified: 'No generation strategy is qualified for the selected class or method.',
  invalid_file_for_generating_oas_doc: 'Invalid file for generating OAS doc',
  cleanup_openapi_doc_failed: 'Could not find OpenAPI document in the source:\n',
  check_openapi_doc_failed: 'Failed to check OpenAPI Document',
  check_openapi_doc_succeeded: 'Validated the OpenAPI Document successfully',
  no_oas_doc_in_file: 'No OAS doc detected in the file',
  invalid_file_for_processing_oas_doc: 'Invalid file for processing OAS doc',
  get_document_path: 'Get OpenAPI document folder name.'
};
