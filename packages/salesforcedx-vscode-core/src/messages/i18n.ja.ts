/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MISSING_LABEL_MSG } from '@salesforce/salesforcedx-utils-vscode';
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
  channel_starting_message: '開始しています: ',
  channel_end_with_exit_code: 'が終了コード %s で終了しました。',
  channel_end_with_sfdx_not_found:
    'Salesforce CLI がインストールされていません。https://developer.salesforce.com/tools/salesforcecli からインストールしてください。',
  channel_end_with_error: 'がエラーで終了しました。%s',
  channel_end: 'が終了しました。',

  progress_notification_text: '%s を実行しています。',

  notification_successful_execution_text: '%s が正常に実行されました。',
  notification_canceled_execution_text: '%s がキャンセルされました。',
  notification_unsuccessful_execution_text: '%s が失敗しました。',
  notification_show_button_text: '表示',
  notification_show_in_status_bar_button_text: 'ステータスバーだけに表示',
  notification_make_default_dev: 'Dev Hub 組織を認証',

  task_view_running_message: '[実行しています] %s',

  status_bar_tooltip: 'クリックしてコマンドをキャンセル',

  org_login_web_authorize_dev_hub_text: 'SFDX: Dev Hub 組織を認証',
  org_login_web_authorize_org_text: 'SFDX: 組織を認証',

  parameter_directory_strict_not_available: '必要なメタデータフォルダ "%s" がこのワークスペースに存在しません。',

  parameter_gatherer_enter_file_name: 'ファイル名を入力',
  parameter_gatherer_enter_dir_name: 'フォルダを入力 (Enter で確認または Esc でキャンセル)',
  parameter_gatherer_enter_username_name: '対象ユーザ名を入力',
  parameter_gatherer_enter_alias_name: '組織のエイリアスを入力またはデフォルトのエイリアスを使用',
  parameter_gatherer_enter_custom_url: 'カスタムのログイン URL を入力またはデフォルトの URL を使用',

  parameter_gatherer_enter_scratch_org_expiration_days:
    'スクラッチ組織の有効日数を入力 (1 から 30 まで) またはデフォルト値 (7) を使用',
  parameter_gatherer_enter_project_name: 'プロジェクト名を入力',
  parameter_gatherer_paste_forceide_url: '設定から forceide:// の URL をペースト',
  parameter_gatherer_paste_forceide_url_placeholder: '設定の forceide:// URL',
  parameter_gatherer_invalid_forceide_url:
    'forceide:// 形式の URL が無効です。登録者の組織から、設定の Apex デバッガのページに表示される forceide:// 形式の URL をコピー・ペーストしてください。',

  org_create_default_scratch_org_text: 'SFDX: デフォルトのスクラッチ組織を作成...',
  org_create_result_parsing_error: '組織を作成するレスポンスの処理中に予期せぬエラーが発生しました。',

  org_open_default_scratch_org_text: 'SFDX: デフォルトの組織を開く',
  org_open_default_scratch_org_container_error: '組織を開くレスポンスの処理中に予期せぬエラーが発生しました。',
  org_open_container_mode_message_text: '組織 %s にユーザ %s として次の URL: %s を使用してアクセス',

  project_retrieve_start_default_org_text: 'SFDX: デフォルトのスクラッチ組織からソースをプル',

  project_deploy_start_default_org_text: 'SFDX: デフォルトのスクラッチ組織へソースを転送',

  deploy_this_source_text: 'SFDX: このソースを組織へデプロイ',
  deploy_select_file_or_directory:
    'ソースファイルかディレクトリ上でのみ SFDX: このソースを組織へデプロイ を実行できます。',
  deploy_select_manifest: 'マニフェストファイル上でのみ SFDX マニフェストのソースを組織へデプロイ を実行できます。',
  retrieve_this_source_text: 'SFDX: このソースを組織から取得',
  retrieve_display_text: 'SFDX: このソースを組織から取得',

  retrieve_select_file_or_directory:
    'ソースファイルかディレクトリ上でのみ SFDX: このソースを組織から取得 を実行できます。',
  retrieve_select_manifest: 'マニフェストファイル上でのみ SFDX: マニフェストのソースを組織から取得 を実行できます。',
  delete_source_text: 'SFDX: プロジェクトおよび組織から削除',
  delete_source_manifest_unsupported_message:
    'SFDX: 組織およびプロジェクトから削除 はマニフェストファイルでサポートされていません。削除するソースファイルやディレクトリを選択してください。',
  delete_source_select_file_or_directory:
    'ソースファイルかディレクトリ上でのみ SFDX: プロジェクトおよび組織から削除 を実行できます。',
  delete_source_confirmation_message:
    'ソースファイルを削除すると、コンピュータからファイルが削除され、デフォルトの組織から対応するメタデータが取り除かれます。このソースをプロジェクトおよび組織から削除してもよろしいですか？',
  confirm_delete_source_button_text: 'ソースを削除',
  cancel_delete_source_button_text: 'キャンセル',

  view_all_changes_text: 'すべての変更を参照 (ローカルおよびスクラッチ組織内)',

  apex_generate_class_text: 'SFDX: Apex クラスを作成',
  visualforce_generate_component_text: 'SFDX: Visualforce コンポーネントを作成',
  visualforce_generate_page_text: 'SFDX: Visualforce ページを作成',
  lightning_generate_app_text: 'SFDX: Aura アプリケーションを作成',
  lightning_generate_aura_component_text: 'SFDX: Aura コンポーネントを作成',
  lightning_generate_event_text: 'SFDX: Aura イベントを作成',
  lightning_generate_interface_text: 'SFDX: Aura インタフェースを作成',

  view_local_changes_text: 'SFDX: ローカルの変更を表示',
  view_remote_changes_text: 'SFDX: デフォルトのスクラッチ組織の変更を参照',
  warning_prompt_file_overwrite:
    '指定されたパスを使用した 1 つ以上の %s ファイルがワークスペース上に既に存在します。上書きしてもよろしいですか？',
  warning_prompt_dir_overwrite:
    '指定されたプロジェクト名は選択されたディレクトリ上に既に存在します。上書きしてもよろしいですか？',
  warning_prompt_continue_confirm: '続ける',
  warning_prompt_overwrite_cancel: 'キャンセル',
  warning_prompt_overwrite_message: '上書きしてもよろしいですか？ %s:%s?\n\n%s\n\n%s',
  warning_prompt_overwrite: '上書き',
  warning_prompt_overwrite_all: 'すべて上書き',
  warning_prompt_skip: 'スキップ',
  warning_prompt_skip_all: 'すべてスキップ',
  warning_prompt_other_existing: '%s つの既存コンポーネント',
  warning_prompt_other_not_shown: '...表示されていない残り %s つのコンポーネント\n',
  config_list_text: 'SFDX: すべての設定変数を一覧表示',
  alias_list_text: 'SFDX: すべてのエイリアスを一覧表示',
  org_display_default_text: 'SFDX: デフォルトの組織の詳細を表示',
  org_display_username_text: 'SFDX: 組織の詳細を表示...',
  debugger_query_session_text: 'Apex デバッガセッションをクエリ',
  debugger_stop_text: 'SFDX: Apex デバッガセッションを停止',
  debugger_stop_none_found_text: 'Apex デバッガセッションが見つかりませんでした。',
  data_query_input_text: 'SFDX: SOQL クエリを実行...',
  data_query_selection_text: 'SFDX: 現在選択されているテキストで SOQL クエリを実行',
  parameter_gatherer_enter_soql_query: 'SOQL クエリを入力してください',
  anon_apex_execute_document_text: 'SFDX: エディタの内容で匿名 Apex コードを実行',
  anon_apex_execute_selection_text: 'SFDX: 現在選択されているテキストで匿名 Apex コードを実行',
  project_generate_text: 'SFDX: プロジェクトを作成',
  project_generate_open_dialog_create_label: 'プロジェクトを作成',
  project_generate_standard_template: '標準のプロジェクトテンプレート (デフォルト)',
  project_generate_standard_template_display_text: '標準',
  project_generate_empty_template_display_text: '空',

  project_generate_empty_template: '空のプロジェクトテンプレート',
  project_generate_analytics_template: 'Analytics のプロジェクトテンプレート',

  apex_generate_trigger_text: 'SFDX: Apex トリガを作成',
  start_apex_debug_logging: 'SFDX: Replay Debugger 用に Apex デバッグログを有効化',
  stop_apex_debug_logging: 'SFDX: Replay Debugger 用の Apex デバッグログを無効化',
  isv_debug_bootstrap_create_project: 'SFDX: ISV デバッガ 設定 ステップ 1/7: プロジェクトを作成しています',
  isv_debug_bootstrap_configure_project: 'SFDX: ISV デバッガ 設定 ステップ 2/7: プロジェクトを設定しています',
  isv_debug_bootstrap_configure_project_retrieve_namespace:
    'SFDX: ISV デバッガ 設定 ステップ 2/7: プロジェクトを設定しています: 名前空間を取得しています',
  isv_debug_bootstrap_retrieve_org_source:
    'SFDX: ISV デバッガ 設定 ステップ 3/7: パッケージ化されていない Apex コードを取得しています',
  isv_debug_bootstrap_list_installed_packages:
    'SFDX: ISV デバッガ 設定 ステップ 5/7: インストール済みパッケージをクエリしています',
  isv_debug_bootstrap_retrieve_package_source: 'SFDX: ISV デバッガ 設定 ステップ 6/7: パッケージを取得しています',
  isv_debug_bootstrap_processing_package: 'パッケージを処理しています: %s',
  isv_debug_bootstrap_generate_launchjson: '起動構成ファイルを作成しています',
  isv_debug_bootstrap_open_project: 'プロジェクトを新しい Visual Studio Code のウィンドウで開いています',

  error_creating_packagexml: 'package.xml の作成中にエラー: %s',
  error_extracting_org_source: 'ダウンロードされたApex ソースの抽出中にエラー: %s',
  error_extracting_packages: 'パッケージの抽出中にエラー: %s',
  error_updating_salesforce_project: 'sfdx-project.json の更新中にエラー: %s',
  error_writing_installed_package_info: 'installed-package.json の書き込み中にエラー: %s',
  error_cleanup_temp_files: '一時ファイルのクリーンアップ中にエラー: %s',

  demo_mode_status_tooltip:
    'VS Code のSalesforce 拡張機能をデモモードで実行しています。本番環境に接続するときに確認を求められます。',
  demo_mode_prompt:
    'デモモードまたは共有マシンで、ビジネスまたは本番組織を認証することは推奨されません。認証を続ける場合、組織を使用した後、必ず "SFDX: すべての認証済み組織からログアウト" を実行してください。',
  org_logout_all_text: 'SFDX: すべての認証済み組織からログアウト',

  manifest_editor_title_message: 'マニフェストエディタ',

  REST_API_description: 'REST API でクエリを実行',
  tooling_API_description: 'Tooling API でクエリを実行',
  telemetry_legal_dialog_message:
    'VS Code の Salesforce 拡張機能が製品の改善のために、利用状況、ユーザ環境、クラッシュレポートを収集することに同意しました。[オプトアウトの方法について参照する](%s)。',
  telemetry_legal_dialog_button_text: 'さらに表示',
  invalid_debug_level_id_error:
    '組織内の少なくとも1つのトレースフラグにデバッグログレベルが関連付けられていません。このコマンドを実行する前に、"sf data:query -t -q "SELECT Id FROM TraceFlag WHERE DebugLevelId = null"" を実行し、無効なトレースフラグを削除するために、"sf data:delete:record -t -s TraceFlag -i 7tfxxxxxxxxxxxxxxx" を実行してください。7tfxxxxxxxxxxxxxxx はデバッグログレベルがないトレースフラグの ID に置き換えてください。',
  auth_project_label: 'プロジェクトのデフォルト',
  auth_project_detail: 'sfdx-project.json で定義されたログインURL を使用',
  auth_prod_label: '本番環境',

  auth_custom_label: 'カスタム',
  auth_custom_detail: 'カスタムログイン URL を入力',
  auth_invalid_url: 'URL は http:// か https:// で始める必要があります。',

  error_fetching_auth_info_text:
    '保存時のプッシュまたはデプロイ実行中にエラー: デフォルトの組織に接続できませんでした。"SFDX: デフォルトのスクラッチ組織を作成" または "SFDX: 組織を認証" を実行して、保存したソースをプッシュまたはデプロイしてください。もしくは、保存時のプッシュまたはデプロイを無効化するため、VS Code のユーザまたはワークスペース設定で "salesforcedx-vscode-core.push-or-deploy-on-save.enabled" を false に設定してください。',
  error_no_package_directories_found_on_setup_text:
    '保存時のプッシュまたはデプロイ設定中にエラー: sfdx-project.json ファイルに "packageDirectories" プロパティが含まれていません。このプロパティを追加するか、もしくは、保存時のプッシュまたはデプロイを無効化するため、VS Code のユーザまたはワークスペース設定で "salesforcedx-vscode-core.push-or-deploy-on-save.enabled" を false に設定してください。sfdx-project.json についての詳細は https://developer.salesforce.com/docs/atlas.ja-jp.sfdx_dev.meta/sfdx_dev/sfdx_dev_ws_config.htm を参照してください。',
  error_no_package_directories_paths_found_text:
    '保存時のプッシュまたはデプロイ設定中にエラー: sfdx-project.json ファイルの "packageDirectories" プロパティに "path" の値が含まれていません。"path" プロパティへ値を追加するか、もしくは、保存時のプッシュまたはデプロイを無効化するため、VS Code のユーザまたはワークスペース設定で "salesforcedx-vscode-core.push-or-deploy-on-save.enabled" を false に設定してください。sfdx-project.json についての詳細は https://developer.salesforce.com/docs/atlas.ja-jp.sfdx_dev.meta/sfdx_dev/sfdx_dev_ws_config.htm を参照してください。',
  error_push_or_deploy_on_save_no_target_org:
    '保存時のプッシュまたはデプロイ実行中にエラー: デフォルトの組織が設定されていません。"SFDX: デフォルトのスクラッチ組織を作成" または "SFDX: 組織を認証" を実行して、保存したソースをプッシュまたはデプロイしてください。もしくは、保存時のプッシュまたはデプロイを無効化するため、VS Code のユーザまたはワークスペース設定で "salesforcedx-vscode-core.push-or-deploy-on-save.enabled" を false に設定してください。',
  error_source_path_not_in_package_directory_text:
    'ソースをデプロイまたは取得中にエラー: デプロイまたは取得しようとしたファイルかディレクトリが sfdx-project.json ファイルで指定されたパッケージディレクトリにありません。この場所を "packageDirectories" の値に追加するか、異なるファイルやディレクトリをデプロイまたは取得してください。sfdx-project.json についての詳細は https://developer.salesforce.com/docs/atlas.ja-jp.sfdx_dev.meta/sfdx_dev/sfdx_dev_ws_config.htm を参照してください。',
  org_select_text: 'デフォルトに設定する組織を選択',
  missing_default_org: 'デフォルトの組織が未設定',

  config_set_org_text: 'SFDX: デフォルトの組織を設定',
  error_parsing_sfdx_project_file: 'sfdx-project.json ファイル (%s) をパースできませんでした。パースエラー: %s',

  error_no_target_org:
    'デフォルトの組織が設定されていません。"SFDX: デフォルトのスクラッチ組織を作成" または "SFDX: 組織を認証" を実行し組織を設定してください。',
  error_no_target_dev_hub:
    'デフォルトの Dev Hub 組織が設定されていません。"SFDX: Dev Hub 組織を認証" を実行て組織を設定してください。',
  custom_output_directory: 'ディレクトリを選択',
  warning_using_global_username:
    'ローカルのプロジェクト設定にデフォルトのユーザ名が見つかりませんでした。グローバルのデフォルトユーザ名を使用します。"SFDX: 組織を認証" を実行して ローカルのプロジェクト設定にユーザ名を設定してください。',
  apex_class_message_name: 'Apex クラス',
  apex_trigger_message_name: 'Apex トリガ',
  visualforce_component_message_name: 'Visualforce コンポーネント',
  visualforce_page_message_name: 'Visualforce ページ',
  aura_bundle_message_name: 'Aura コンポーネントバンドル',
  lwc_message_name: 'Lightning Web コンポーネント',
  lightning_generate_lwc_text: 'SFDX: Lightning Web コンポーネントを作成',
  empty_components: '利用できるコンポーネントがありません',
  error_auth_token: '認証トークン更新中にエラーが発生しました。',
  error_no_org_found: '組織の認証情報が見つかりませんでした。',
  error_invalid_org_alias: '別名にはアンダースコアと英数字のみを使用できます。',
  error_invalid_expiration_days: '日数には 1 から 30 までの数値を指定してください。',
  error_fetching_metadata: '組織のメタデータ読み込み中にエラーが発生しました。',
  error_org_browser_text: '組織を認証するため、"SFDX: 組織を認証" を再度実行してください。',
  error_org_browser_init: '組織ブラウザが初期化されませんでした。',
  error_overwrite_prompt: '既存コンポーネントのワークスペース確認中にエラー',

  conflict_detect_error: '競合を検出中にエラーが発生しました。%s',
  conflict_detect_conflicts_during_deploy:
    'メタデータのデプロイ中に競合が検出されました。競合を上書きして進めるか、キャンセルして競合を表示するかを選択してください。',
  conflict_detect_conflicts_during_retrieve:
    'メタデータの取得中に競合が検出されました。競合を上書きして進めるか、キャンセルして競合を表示するかを選択してください。',
  conflict_detect_override_deploy: '競合を上書き',
  conflict_detect_show_conflicts_deploy: '競合を表示',

  conflict_detect_no_target_org: 'このプロジェクトにはデフォルトのユーザ名がありません',
  conflict_detect_no_default_package_dir: 'このプロジェクトにはデフォルトのパッケージディレクトリがありません',
  conflict_detect_view_init: '競合検出ビューが初期化されていません',
  conflict_detect_not_enabled:
    '組織との差分を表示するために、Detect Conflicts for Deploy and Retrieve 設定を有効化してください',

  conflict_detect_no_conflicts: '競合がありません',

  conflict_detect_diff_command_title: 'ファイルを比較',

  source_diff_text: 'SFDX: 組織のファイルとの差分を表示',

  source_diff_unsupported_type: 'このメタデータ型に対する差分は現在サポートされていません。',
  source_diff_title: '%s//%s ↔ ローカル //%s',

  aura_doc_url: 'https://developer.salesforce.com/tools/vscode/ja/aura/writing',
  apex_doc_url: 'https://developer.salesforce.com/tools/vscode/ja/apex/writing',
  soql_doc_url: 'https://developer.salesforce.com/tools/vscode/ja/soql/soql-builder',
  lwc_doc_url: 'https://developer.salesforce.com/tools/vscode/ja/lwc/writing',
  functions_doc_url: 'https://developer.salesforce.com/tools/vscode/ja/functions/overview',
  default_doc_url: 'https://developer.salesforce.com/tools/vscode/ja',
  parameter_gatherer_file_name_max_length_validation_error_message: 'ファイル名は {0} 文字を超えることはできません',

  conflict_detect_execution_name: '競合検出',
  conflict_detect_initialization_error: 'メタデータキャッシュの初期化中に予期せぬエラーが発生しました',
  conflict_detect_conflict_header_timestamp: '競合:\n    %d 個のファイルに競合が見つかりました:\n',
  conflict_detect_no_differences: '差分がありません',
  conflict_detect_remote_last_modified_date: '組織の最終更新日: %s \n',
  conflict_detect_local_last_modified_date: 'ローカルの最終同期日: %s',

  source_diff_folder_title: '%s - ファイル差分',
  beta_tapi_mdcontainer_error: 'メタデータコンテナ作成中に予期せぬエラーが発生しました',
  beta_tapi_membertype_error: '%s メンバー作成中に予期せぬエラーが発生しました',
  beta_tapi_car_error: 'コンテナ非同期リクエスト作成中に予期せぬエラーが発生しました',
  beta_tapi_queue_status: 'デプロイがまだキューに入っています',
  lib_retrieve_result_title: '取得されたソース',
  lib_retrieve_result_parse_error: '現在の結果を解析できません。',
  lib_retrieve_message_title: '取得警告',
  force_function_enter_function: 'ファンクション名を入力',
  force_function_enter_language: 'ファンクションの言語を選択',
  force_function_install_npm_dependencies_progress: 'NPM 依存関係をインストール中',
  force_function_install_npm_dependencies_error:
    "%s. NodeJS がインストールされていることを確認し (https://nodejs.org/)、'npm install' を実行して package.json から依存関係をインストールしてください",
  force_function_install_mvn_dependencies_error:
    "%s. Maven がインストールされていることを確認し (https://maven.apache.org/)、'mvn install' を実行して pom.xml から依存関係をインストールしてください",
  sobjects_refresh_needed:
    'ローカルにキャッシュされた sObject がありません。Apex コードで sObject の自動補完を利用するには、SFDX: Refresh SObject Definitions を実行してください。',
  sobjects_refresh_now: 'SFDX: Refresh SObject Definitions を実行',
  sobjects_refresh: 'SFDX: SObject 定義を更新',
  sobject_refresh_all: 'すべての SObject',
  sobject_refresh_custom: 'カスタム SObject',
  sobject_refresh_standard: '標準 SObject',
  sobjects_no_refresh_if_already_active_error_text:
    'sObject 定義の更新が既に進行中です。プロセスを再開する必要がある場合は、実行中のタスクをキャンセルしてください。',
  component_input_dup_error: 'コンポーネント名は LWC または Aura で既に使用されています',
  rename_component_input_dup_file_name_error:
    'このファイル名は現在のコンポーネントディレクトリで既に使用されています。別の名前を選択して再試行してください。',
  rename_component_input_placeholder: '一意のコンポーネント名を入力',
  rename_component_input_prompt: 'Enter で入力を確認、Escape でキャンセル',
  rename_component_warning:
    '警告: 古い名前への参照は更新されません。手動で更新し、すべての変更が完了したら再デプロイしてください。',
  rename_component_error:
    'コンポーネントの名前を変更できませんでした。手動でコンポーネントの名前を変更してから、変更を再デプロイしてみてください。',
  error_function_type: '実行中のファンクションの種類を判定できません。',
  error_unable_to_get_started_function: '"{0}" のファンクションにアクセスできません。',
  pending_org_expiration_expires_on_message: '%s\n(%s に期限切れ)',
  pending_org_expiration_notification_message:
    '警告: 今後 %d 日以内に期限切れになる組織が 1 つ以上あります。詳細については、出力パネルを確認してください。',
  pending_org_expiration_output_channel_message:
    '警告: 以下の組織が今後 %d 日以内に期限切れになります:\n\n%s\n\nこれらの組織に重要なデータや設定が含まれている場合は、組織が期限切れになる前にバックアップしてください。',
  source_status: 'ソースステータス',
  rename_not_supported: '複数コンポーネントの名前変更はサポートされていません',
  input_no_component_name: '入力にコンポーネント名が含まれていません',
  component_empty: 'コンポーネントは空にできません',
  create_not_supported: '複数コンポーネントの作成はサポートされていません',
  input_incorrect_properties: '入力に正しいコンポーネントプロパティが含まれていません',
  // eslint-disable-next-line prefer-template
  missing_label: MISSING_LABEL_MSG + ': %s'
};
