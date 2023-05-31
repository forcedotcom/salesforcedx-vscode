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
  channel_name: 'Salesforce CLI',
  channel_starting_message: '開始しています: ',
  channel_end_with_exit_code: 'が終了コード %s で終了しました。',
  channel_end_with_sfdx_not_found:
    'Salesforce CLI がインストールされていません。https://developer.salesforce.com/tools/sfdxcli からインストールしてください。',
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

  status_bar_text: `$(x) %s`,
  status_bar_tooltip: 'クリックしてコマンドをキャンセル',

  force_auth_web_login_authorize_dev_hub_text: 'SFDX: Dev Hub 組織を認証',
  force_auth_web_login_authorize_org_text: 'SFDX: 組織を認証',
  force_auth_access_token_authorize_org_text:
    'SFDX: Authorize an Org using Session ID',
  force_auth_access_token_login_bad_oauth_token_message:
    'The session ID that you are trying to use is not valid. Check if it has expired, or use a valid session ID.',

  parameter_directory_strict_not_available:
    '必要なメタデータフォルダ "%s" がこのワークスペースに存在しません。',

  parameter_gatherer_enter_file_name: 'ファイル名を入力',
  parameter_gatherer_enter_dir_name:
    'フォルダを入力 (Enter で確認または Esc でキャンセル)',
  parameter_gatherer_enter_username_name: '対象ユーザ名を入力',
  parameter_gatherer_enter_alias_name:
    '組織のエイリアスを入力またはデフォルトのエイリアスを使用',
  parameter_gatherer_enter_custom_url:
    'カスタムのログイン URL を入力またはデフォルトの URL を使用',
  parameter_gatherer_enter_instance_url: 'Enter Instance URL',
  parameter_gatherer_enter_session_id: 'Enter Session ID',
  parameter_gatherer_enter_session_id_placeholder: 'Session ID',
  parameter_gatherer_enter_session_id_diagnostic_message:
    'Enter a valid Session ID',
  parameter_gatherer_enter_scratch_org_expiration_days:
    'スクラッチ組織の有効日数を入力 (1 から 30 まで) またはデフォルト値 (7) を使用',
  parameter_gatherer_enter_project_name: 'プロジェクト名を入力',
  parameter_gatherer_paste_forceide_url:
    '設定から forceide:// の URL をペースト',
  parameter_gatherer_paste_forceide_url_placeholder: '設定の forceide:// URL',
  parameter_gatherer_invalid_forceide_url:
    'forceide:// 形式の URL が無効です。登録者の組織から、設定の Apex デバッガのページに表示される forceide:// 形式の URL をコピー・ペーストしてください。',

  force_org_create_default_scratch_org_text:
    'SFDX: デフォルトのスクラッチ組織を作成...',
  force_org_create_result_parsing_error:
    '組織を作成するレスポンスの処理中に予期せぬエラーが発生しました。',

  force_org_open_default_scratch_org_text: 'SFDX: デフォルトの組織を開く',
  force_org_open_default_scratch_org_container_error:
    '組織を開くレスポンスの処理中に予期せぬエラーが発生しました。',
  force_org_open_container_mode_message_text:
    '組織 %s にユーザ %s として次の URL: %s を使用してアクセス',

  force_source_pull_default_org_text:
    'SFDX: デフォルトのスクラッチ組織からソースをプル',
  force_source_pull_force_default_org_text:
    'SFDX: デフォルトのスクラッチ組織からソースをプルして競合を上書き',

  force_source_push_default_org_text:
    'SFDX: デフォルトのスクラッチ組織へソースを転送',
  force_source_push_force_default_org_text:
    'SFDX: デフォルトのスクラッチ組織へソースを転送して競合を上書き',

  force_source_deploy_text: 'SFDX: 組織へソースをデプロイ',
  force_source_deploy_select_file_or_directory:
    'ソースファイルかディレクトリ上でのみ SFDX: 組織へソースをデプロイ を実行できます。',
  force_source_deploy_select_manifest:
    'マニフェストファイル上でのみ SFDX マニフェストのソースを組織へデプロイ を実行できます。',
  force_source_retrieve_text: 'SFDX: 組織からソースを取得',
  force_source_retrieve_display_text: 'SFDX: 組織からソースを取得',
  force_source_retrieve_and_open_display_text: 'Retrieve and Open Source',
  force_source_retrieve_select_file_or_directory:
    'ソースファイルかディレクトリ上でのみ SFDX: 組織からソースを取得 を実行できます。',
  force_source_retrieve_select_manifest:
    'マニフェストファイル上でのみ SFDX: マニフェストのソースを組織から取得 を実行できます。',
  force_source_delete_text: 'SFDX: プロジェクトおよび組織から削除',
  force_source_delete_manifest_unsupported_message:
    'SFDX: 組織およびプロジェクトから削除 はマニフェストファイルでサポートされていません。削除するソースファイルやディレクトリを選択してください。',
  force_source_delete_select_file_or_directory:
    'ソースファイルかディレクトリ上でのみ SFDX: プロジェクトおよび組織から削除 を実行できます。',
  force_source_delete_confirmation_message:
    'ソースファイルを削除すると、コンピュータからファイルが削除され、デフォルトの組織から対応するメタデータが取り除かれます。このソースをプロジェクトおよび組織から削除してもよろしいですか？',
  confirm_delete_source_button_text: 'ソースを削除',
  cancel_delete_source_button_text: 'キャンセル',

  force_source_status_text:
    'すべての変更を参照 (ローカルおよびスクラッチ組織内)',

  force_apex_class_create_text: 'SFDX: Apex クラスを作成',
  force_visualforce_component_create_text:
    'SFDX: Visualforce コンポーネントを作成',
  force_visualforce_page_create_text: 'SFDX: Visualforce ページを作成',
  force_lightning_app_create_text: 'SFDX: Aura アプリケーションを作成',
  force_lightning_component_create_text: 'SFDX: Aura コンポーネントを作成',
  force_lightning_event_create_text: 'SFDX: Aura イベントを作成',
  force_lightning_interface_create_text: 'SFDX: Aura インタフェースを作成',
  force_source_status_local_text: 'SFDX: ローカルの変更を表示',
  force_source_status_remote_text:
    'SFDX: デフォルトのスクラッチ組織の変更を参照',
  warning_prompt_file_overwrite:
    '指定されたパスを使用した 1 つ以上の %s ファイルがワークスペース上に既に存在します。上書きしてもよろしいですか？',
  warning_prompt_dir_overwrite:
    '指定されたプロジェクト名は選択されたディレクトリ上に既に存在します。上書きしてもよろしいですか？',
  warning_prompt_continue_confirm: '続ける',
  warning_prompt_overwrite_cancel: 'キャンセル',
  warning_prompt_overwrite_message:
    '上書きしてもよろしいですか？ %s:%s?\n\n%s\n\n%s',
  warning_prompt_overwrite: '上書き',
  warning_prompt_overwrite_all: 'すべて上書き',
  warning_prompt_skip: 'スキップ',
  warning_prompt_skip_all: 'すべてスキップ',
  warning_prompt_other_existing: '%s つの既存コンポーネント',
  warning_prompt_other_not_shown:
    '...表示されていない残り %s つのコンポーネント\n',
  force_config_list_text: 'SFDX: すべての設定変数を一覧表示',
  force_alias_list_text: 'SFDX: すべてのエイリアスを一覧表示',
  force_org_display_default_text: 'SFDX: デフォルトの組織の詳細を表示',
  force_org_display_username_text: 'SFDX: 組織の詳細を表示...',
  force_debugger_query_session_text: 'Apex デバッガセッションをクエリ',
  force_debugger_stop_text: 'SFDX: Apex デバッガセッションを停止',
  force_debugger_stop_none_found_text:
    'Apex デバッガセッションが見つかりませんでした。',
  force_data_soql_query_input_text: 'SFDX: SOQL クエリを実行...',
  force_data_soql_query_selection_text:
    'SFDX: 現在選択されているテキストで SOQL クエリを実行',
  parameter_gatherer_enter_soql_query: 'SOQL クエリを入力してください',
  force_anon_apex_execute_document_text:
    'SFDX: エディタの内容で匿名 Apex コードを実行',
  force_anon_apex_execute_selection_text:
    'SFDX: 現在選択されているテキストで匿名 Apex コードを実行',
  force_project_create_text: 'SFDX: プロジェクトを作成',
  force_project_create_open_dialog_create_label: 'プロジェクトを作成',
  force_project_create_standard_template:
    '標準のプロジェクトテンプレート (デフォルト)',
  force_project_create_standard_template_display_text: '標準',
  force_project_create_empty_template_display_text: '空',
  force_project_create_analytics_template_display_text: 'Analytics',
  force_project_create_empty_template: '空のプロジェクトテンプレート',
  force_project_create_analytics_template:
    'Analytics のプロジェクトテンプレート',
  force_apex_trigger_create_text: 'SFDX: Apex トリガを作成',
  force_start_apex_debug_logging:
    'SFDX: Replay Debugger 用に Apex デバッグログを有効化',
  force_apex_debug_log_status_bar_text:
    '$(file-text) 詳細なログを記録しています。%s まで。',
  force_apex_debug_log_status_bar_hover_text:
    'Apex および Visualforce のデバッグログをログレベル %s で書き込んでいます。%s, %s まで。',
  force_stop_apex_debug_logging:
    'SFDX: Replay Debugger 用の Apex デバッグログを無効化',
  isv_debug_bootstrap_step1_create_project:
    'SFDX: ISV デバッガ 設定 ステップ 1/7: プロジェクトを作成しています',
  isv_debug_bootstrap_step2_configure_project:
    'SFDX: ISV デバッガ 設定 ステップ 2/7: プロジェクトを設定しています',
  isv_debug_bootstrap_step2_configure_project_retrieve_namespace:
    'SFDX: ISV デバッガ 設定 ステップ 2/7: プロジェクトを設定しています: 名前空間を取得しています',
  isv_debug_bootstrap_step3_retrieve_org_source:
    'SFDX: ISV デバッガ 設定 ステップ 3/7: パッケージ化されていない Apex コードを取得しています',
  isv_debug_bootstrap_step4_convert_org_source:
    'SFDX: ISV デバッガ 設定 ステップ 4/7: パッケージ化されていない Apex コードを変換しています',
  isv_debug_bootstrap_step5_list_installed_packages:
    'SFDX: ISV デバッガ 設定 ステップ 5/7: インストール済みパッケージをクエリしています',
  isv_debug_bootstrap_step6_retrieve_packages_source:
    'SFDX: ISV デバッガ 設定 ステップ 6/7: パッケージを取得しています',
  isv_debug_bootstrap_step7_convert_package_source:
    'SFDX: ISV デバッガ 設定 ステップ 7/7: パッケージを変換しています: %s',
  isv_debug_bootstrap_processing_package: 'パッケージを処理しています: %s',
  isv_debug_bootstrap_generate_launchjson: '起動構成ファイルを作成しています',
  isv_debug_bootstrap_open_project:
    'プロジェクトを新しい Visual Studio Code のウィンドウで開いています',

  error_creating_packagexml: 'package.xml の作成中にエラー: %s',
  error_extracting_org_source:
    'ダウンロードされたApex ソースの抽出中にエラー: %s',
  error_extracting_packages: 'パッケージの抽出中にエラー: %s',
  error_updating_sfdx_project: 'sfdx-project.json の更新中にエラー: %s',
  error_writing_installed_package_info:
    'installed-package.json の書き込み中にエラー: %s',
  error_cleanup_temp_files: '一時ファイルのクリーンアップ中にエラー: %s',

  demo_mode_status_text: `$(gist-secret) SFDX DEMO`,
  demo_mode_status_tooltip:
    'VS Code のSalesforce 拡張機能をデモモードで実行しています。本番環境に接続するときに確認を求められます。',
  demo_mode_prompt:
    'デモモードまたは共有マシンで、ビジネスまたは本番組織を認証することは推奨されません。認証を続ける場合、組織を使用した後、必ず "SFDX: すべての認証済み組織からログアウト" を実行してください。',
  force_auth_logout_all_text: 'SFDX: すべての認証済み組織からログアウト',
  force_auth_logout_default_text: 'SFDX: Log Out from Default Org',
  manifest_editor_title_message: 'マニフェストエディタ',
  REST_API: 'REST API',
  tooling_API: 'Tooling API',
  REST_API_description: 'REST API でクエリを実行',
  tooling_API_description: 'Tooling API でクエリを実行',
  telemetry_legal_dialog_message:
    'VS Code の Salesforce 拡張機能が製品の改善のために、利用状況、ユーザ環境、クラッシュレポートを収集することに同意しました。[オプトアウトの方法について参照する](%s)。',
  telemetry_legal_dialog_button_text: 'さらに表示',
  invalid_debug_level_id_error:
    '組織内の少なくとも1つのトレースフラグにデバッグログレベルが関連付けられていません。このコマンドを実行する前に、"sfdx force:data:soql:query -t -q "SELECT Id FROM TraceFlag WHERE DebugLevelId = null"" を実行し、無効なトレースフラグを削除するために、"sfdx force:data:record:delete -t -s TraceFlag -i 7tfxxxxxxxxxxxxxxx" を実行してください。7tfxxxxxxxxxxxxxxx はデバッグログレベルがないトレースフラグの ID に置き換えてください。',
  auth_project_label: 'プロジェクトのデフォルト',
  auth_project_detail: 'sfdx-project.json で定義されたログインURL を使用',
  auth_prod_label: '本番環境',
  auth_prod_detail: 'login.salesforce.com',
  auth_sandbox_label: 'Sandbox',
  auth_sandbox_detail: 'test.salesforce.com',
  auth_custom_label: 'カスタム',
  auth_custom_detail: 'カスタムログイン URL を入力',
  auth_invalid_url: 'URL は http:// か https:// で始める必要があります。',
  auth_logout_scratch_prompt:
    'Log out of this scratch org?\n\nBefore logging out, ensure that you or someone on your team has a username and password for %s scratch org. Otherwise you might lose all access to this scratch org.',
  auth_logout_scratch_logout: 'Logout',
  auth_logout_no_default_org: 'No default org to logout from',
  error_fetching_auth_info_text:
    '保存時のプッシュまたはデプロイ実行中にエラー: デフォルトの組織に接続できませんでした。"SFDX: デフォルトのスクラッチ組織を作成" または "SFDX: 組織を認証" を実行して、保存したソースをプッシュまたはデプロイしてください。もしくは、保存時のプッシュまたはデプロイを無効化するため、VS Code のユーザまたはワークスペース設定で "salesforcedx-vscode-core.push-or-deploy-on-save.enabled" を false に設定してください。',
  error_no_package_directories_found_on_setup_text:
    '保存時のプッシュまたはデプロイ設定中にエラー: sfdx-project.json ファイルに "packageDirectories" プロパティが含まれていません。このプロパティを追加するか、もしくは、保存時のプッシュまたはデプロイを無効化するため、VS Code のユーザまたはワークスペース設定で "salesforcedx-vscode-core.push-or-deploy-on-save.enabled" を false に設定してください。sfdx-project.json についての詳細は https://developer.salesforce.com/docs/atlas.ja-jp.sfdx_dev.meta/sfdx_dev/sfdx_dev_ws_config.htm を参照してください。',
  error_no_package_directories_paths_found_text:
    '保存時のプッシュまたはデプロイ設定中にエラー: sfdx-project.json ファイルの "packageDirectories" プロパティに "path" の値が含まれていません。"path" プロパティへ値を追加するか、もしくは、保存時のプッシュまたはデプロイを無効化するため、VS Code のユーザまたはワークスペース設定で "salesforcedx-vscode-core.push-or-deploy-on-save.enabled" を false に設定してください。sfdx-project.json についての詳細は https://developer.salesforce.com/docs/atlas.ja-jp.sfdx_dev.meta/sfdx_dev/sfdx_dev_ws_config.htm を参照してください。',
  error_push_or_deploy_on_save_no_default_username:
    '保存時のプッシュまたはデプロイ実行中にエラー: デフォルトの組織が設定されていません。"SFDX: デフォルトのスクラッチ組織を作成" または "SFDX: 組織を認証" を実行して、保存したソースをプッシュまたはデプロイしてください。もしくは、保存時のプッシュまたはデプロイを無効化するため、VS Code のユーザまたはワークスペース設定で "salesforcedx-vscode-core.push-or-deploy-on-save.enabled" を false に設定してください。',
  error_source_path_not_in_package_directory_text:
    'ソースをデプロイまたは取得中にエラー: デプロイまたは取得しようとしたファイルかディレクトリが sfdx-project.json ファイルで指定されたパッケージディレクトリにありません。この場所を "packageDirectories" の値に追加するか、異なるファイルやディレクトリをデプロイまたは取得してください。sfdx-project.json についての詳細は https://developer.salesforce.com/docs/atlas.ja-jp.sfdx_dev.meta/sfdx_dev/sfdx_dev_ws_config.htm を参照してください。',
  org_select_text: 'デフォルトに設定する組織を選択',
  missing_default_org: 'デフォルトの組織が未設定',
  force_config_set_org_text: 'SFDX: デフォルトの組織を設定',
  error_parsing_sfdx_project_file:
    'sfdx-project.json ファイル (%s) をパースできませんでした。パースエラー: %s',
  sfdx_cli_not_found:
    'Salesforce CLI がインストールされていません。[%s](%s) からインストールしてください。',
  table_header_errors: 'ERRORS',
  table_header_project_path: 'PROJECT PATH',
  table_header_type: 'TYPE',
  table_header_full_name: 'FULL NAME',
  table_header_state: 'STATE',
  table_no_results_found: 'No results found',
  table_title_deployed_source: 'Deployed Source',
  table_title_deploy_errors: 'Deploy Errors',
  table_title_pushed_source: 'Pushed Source',
  table_title_push_errors: 'Push Errors',
  push_conflicts_error:
    '競合のためソースをプッシュできませんでした。組織のメタデータをローカルファイルで上書きしても良い場合は、 "SFDX: ソースをデフォルトのスクラッチ組織にプッシュし競合を上書き" を実行してください。',
  error_no_default_username:
    'デフォルトの組織が設定されていません。"SFDX: デフォルトのスクラッチ組織を作成" または "SFDX: 組織を認証" を実行し組織を設定してください。',
  error_no_default_devhubusername:
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
  force_lightning_lwc_create_text: 'SFDX: Lightning Web コンポーネントを作成',
  empty_components: '利用できるコンポーネントがありません',
  error_auth_token: '認証トークン更新中にエラーが発生しました。',
  error_no_org_found: '組織の認証情報が見つかりませんでした。',
  error_invalid_org_alias: '別名にはアンダースコアと英数字のみを使用できます。',
  error_invalid_expiration_days:
    '日数には 1 から 30 までの数値を指定してください。',
  error_fetching_metadata: '組織のメタデータ読み込み中にエラーが発生しました。',
  error_org_browser_text:
    '組織を認証するため、"SFDX: 組織を認証" を再度実行してください。',
  error_org_browser_init: '組織ブラウザが初期化されませんでした。',
  error_overwrite_prompt: '既存コンポーネントのワークスペース確認中にエラー',
  force_list_metadata: 'SFDX: Force List Metadata',

  AccessControlPolicy: 'Access Control Policies',
  ActionLinkGroupTemplate: 'Action Link Group Templates',
  AIAssistantTemplate: 'AI Assistant Templates',
  AnalyticSnapshot: 'Analytic Snapshots',
  AnimationRule: 'Animation Rules',
  ApexClass: 'Apex Classes',
  ApexComponent: 'Visualforce Components',
  ApexPage: 'Visualforce Pages',
  ApexTestSuite: 'Apex Test Suites',
  ApexTrigger: 'Apex Triggers',
  AppMenu: 'App Menus',
  ApprovalProcess: 'Approval Processes',
  AssignmentRules: 'Assignment Rules',
  AssistantRecommendationType: 'Assistant Recommendation Types',
  AuraDefinitionBundle: 'Aura Components',
  AuthProvider: 'Auth Providers',
  AutoResponseRules: 'Auto Response Rules',
  BrandingSet: 'Branding Sets',
  BusinessProcess: 'Business Processes',
  CallCenter: 'Call Centers',
  CampaignInfluenceModel: 'Campaign Influence Models',
  CaseSubjectParticle: 'Case Subject Particles',
  Certificate: 'Certificates',
  ChannelLayout: 'Channel Layouts',
  ChatterExtension: 'Chatter Extensions',
  CleanDataService: 'Clean Data Services',
  CommandAction: 'Command Actions',
  Community: 'Communities',
  CommunityTemplateDefinition: 'Community Template Definitions',
  CommunityThemeDefinition: 'Community Theme Definitions',
  CompactLayout: 'Compact Layouts',
  ConnectedApp: 'Connected Apps',
  ContentAsset: 'Content Assets',
  CorsWhitelistOrigin: 'Cors Whitelist Origins',
  CspTrustedSite: 'Csp Trusted Sites',
  CustomApplication: 'Custom Applications',
  CustomApplicationComponent: 'Custom Application Components',
  CustomDataType: 'Custom Data Types',
  CustomExperience: 'Custom Experiences',
  CustomFeedFilter: 'Custom Feed Filters',
  CustomField: 'Custom Fields',
  CustomFieldTranslation: 'Custom Field Translations',
  CustomHelpMenuSection: 'Custom Help Menu Sections',
  CustomLabels: 'Custom Labels',
  CustomMetadata: 'Custom Metadatas',
  CustomNotificationType: 'Custom Notification Types',
  CustomObject: 'Custom Objects',
  CustomObjectTranslation: 'Custom Object Translations',
  CustomPageWebLink: 'Custom Page Web Links',
  CustomPermission: 'Custom Permissions',
  CustomSite: 'Custom Sites',
  CustomTab: 'Custom Tabs',
  Dashboard: 'Dashboards',
  DashboardFolder: 'Dashboard Folders',
  DataCategoryGroup: 'Data Category Groups',
  DataPipeline: 'Data Pipelines',
  DelegateGroup: 'Delegate Groups',
  Document: 'Documents',
  DocumentFolder: 'Document Folders',
  DuplicateRule: 'Duplicate Rules',
  EclairGeoData: 'Eclair Geo Datas',
  EmailFolder: 'Email Template Folders',
  EmailServicesFunction: 'Email Services Functions',
  EmailTemplate: 'Email Templates',
  EmbeddedServiceBranding: 'Embedded Service Brandings',
  EmbeddedServiceConfig: 'Embedded Service Configs',
  EmbeddedServiceFieldService: 'Embedded Service Field Services',
  EmbeddedServiceFlowConfig: 'Embedded Service Flow Configs',
  EmbeddedServiceLiveAgent: 'Embedded Service Live Agents',
  EntitlementProcess: 'Entitlement Processes',
  EntitlementTemplate: 'Entitlement Templates',
  EscalationRules: 'Escalation Rules',
  EventDelivery: 'Event Deliveries',
  EventSubscription: 'Event Subscriptions',
  EventType: 'Event Types',
  ExperienceBundle: 'Experience Bundles',
  ExternalDataSource: 'External Data Sources',
  ExternalServiceRegistration: 'External Service Registrations',
  FeatureParameterBoolean: 'Feature Parameter Booleans',
  FeatureParameterDate: 'Feature Parameter Dates',
  FeatureParameterInteger: 'Feature Parameter Integers',
  FieldSet: 'Field Sets',
  FlexiPage: 'Flexi Pages',
  Flow: 'Flows',
  FlowCategory: 'Flow Categories',
  FlowDefinition: 'Flow Definitions',
  Form: 'Forms',
  GlobalPicklist: 'Global Picklists',
  GlobalValueSet: 'Global Value Sets',
  GlobalValueSetTranslation: 'Global Value Set Translations',
  Group: 'Groups',
  HomePageComponent: 'Home Page Components',
  HomePageLayout: 'Home Page Layouts',
  Index: 'Indexes',
  InsightType: 'Insight Types',
  InstalledPackage: 'Installed Packages',
  IntegrationHubSettings: 'Integration Hub Settings',
  IntegrationHubSettingsType: 'Integration Hub Settings Types',
  KeywordList: 'Keyword Lists',
  Layout: 'Layouts',
  LeadConvertSettings: 'Lead Convert Settings',
  Letterhead: 'Letterheads',
  LicenseDefinition: 'License Definitions',
  LightningBolt: 'Lightning Bolts',
  LightningComponentBundle: 'Lightning Web Components',
  LightningExperienceTheme: 'Lightning Experience Themes',
  ListView: 'List Views',
  LiveChatAgentConfig: 'Live Chat Agent Configs',
  LiveChatButton: 'Live Chat Buttons',
  LiveChatDeployment: 'Live Chat Deployments',
  LiveChatSensitiveDataRule: 'Live Chat Sensitive Data Rules',
  ManagedTopics: 'Managed Topics',
  MarketingResourceType: 'Marketing Resource Types',
  MatchingRules: 'Matching Rules',
  MilestoneType: 'Milestone Types',
  ModerationRule: 'Moderation Rules',
  NamedCredential: 'Named Credentials',
  Network: 'Networks',
  NetworkBranding: 'Network Brandings',
  OauthCustomScope: 'OAuth Custom Scopes',
  Orchestration: 'Orchestrations',
  OrchestrationContext: 'Orchestration Contexts',
  PathAssistant: 'Path Assistants',
  PermissionSet: 'Permission Sets',
  PermissionSetGroup: 'Permission Set Groups',
  PlatformCachePartition: 'Platform Cache Partitions',
  PlatformEventChannel: 'Platform Event Channels',
  Portal: 'Portals',
  PostTemplate: 'Post Templates',
  PresenceDeclineReason: 'Presence Decline Reasons',
  PresenceUserConfig: 'Presence User Configs',
  Profile: 'Profiles',
  ProfilePasswordPolicy: 'Profile Password Policies',
  ProfileSessionSetting: 'Profile Session Settings',
  Prompt: 'Prompts',
  Queue: 'Queues',
  QueueRoutingConfig: 'Queue Routing Configs',
  QuickAction: 'Quick Actions',
  RecommendationStrategy: 'Recommendation Strategies',
  RecordActionDeployment: 'Record Action Deployments',
  RecordType: 'Record Types',
  RemoteSiteSetting: 'Remote Site Settings',
  Report: 'Reports',
  ReportFolder: 'Report Folders',
  ReportType: 'Report Types',
  Role: 'Roles',
  SamlSsoConfig: 'Saml Sso Configs',
  Scontrol: 'Scontrols',
  ServiceChannel: 'Service Channels',
  ServicePresenceStatus: 'Service Presence Status',
  Settings: 'Settings',
  SharingCriteriaRule: 'Sharing Criteria Rules',
  SharingOwnerRule: 'Sharing Owner Rules',
  SharingReason: 'Sharing Reasons',
  SharingRules: 'Sharing Rules',
  SharingSet: 'Sharing Sets',
  SharingTerritoryRule: 'Sharing Territory Rules',
  SiteDotCom: 'Sites',
  Skill: 'Skills',
  StandardValueSet: 'Standard Value Sets',
  StandardValueSetTranslation: 'Standard Value Set Translations',
  StaticResource: 'Static Resources',
  SynonymDictionary: 'Synonym Dictionaries',
  Territory2: 'Territory2',
  Territory2Model: 'Territory2 Models',
  Territory2Rule: 'Territory2 Rules',
  Territory2Type: 'Territory2 Types',
  Territory: 'Territories',
  TopicsForObjects: 'Topics For Objects',
  TransactionSecurityPolicy: 'Transaction Security Policies',
  Translations: 'Translations',
  UiPlugin: 'Ui Plugins',
  UserCriteria: 'User Criterias',
  ValidationRule: 'Validation Rules',
  VisualizationPlugin: 'Visualization Plugins',
  WaveApplication: 'Wave Applications',
  WaveDashboard: 'Wave Dashboards',
  WaveDataflow: 'Wave Dataflows',
  WaveDataset: 'Wave Datasets',
  WaveLens: 'Wave Lenses',
  WaveRecipe: 'Wave Recipes',
  WaveTemplateBundle: 'Wave Template Bundles',
  WaveXmd: 'Wave Xmds',
  WebLink: 'Web Links',
  Workflow: 'Workflows',
  XOrgHub: 'X Org Hubs',

  conflict_detect_error: '競合を検出中にエラーが発生しました。%s',
  conflict_detect_retrieve_org_source:
    '競合の検出: 組織のソースを取得しています',
  conflict_detect_convert_org_source:
    '競合の検出: 組織のソースを変換しています',
  conflict_detect_conflicts_during_deploy:
    'メタデータのデプロイ中に競合が検出されました。競合を上書きして進めるか、キャンセルして競合を表示するかを選択してください。',
  conflict_detect_conflicts_during_retrieve:
    'メタデータの取得中に競合が検出されました。競合を上書きして進めるか、キャンセルして競合を表示するかを選択してください。',
  conflict_detect_override: '競合を上書き',
  conflict_detect_show_conflicts: '競合を表示',
  conflict_detect_conflict_header:
    'Conflicts:\n    Found %s file(s) in conflict (scanned %s org files, %s local files):\n',
  conflict_detect_command_hint:
    '\nRun the following command to overwrite the conflicts:\n  %s',
  conflict_detect_no_default_username:
    'このプロジェクトにはデフォルトのユーザ名がありません',
  conflict_detect_no_default_package_dir:
    'このプロジェクトにはデフォルトのパッケージディレクトリがありません',
  conflict_detect_view_init: '競合検出ビューが初期化されていません',
  conflict_detect_not_enabled:
    '組織との差分を表示するために、Detect Conflicts at Sync 設定を有効化してください',
  conflict_detect_root_title: 'Org Differences',
  conflict_detect_view_root: '%s : %s file difference(s)',
  conflict_detect_no_conflicts: '競合がありません',
  conflict_detect_diff_title: '%s//%s ↔ local//%s',
  conflict_detect_diff_command_title: 'ファイルを比較',

  force_source_diff_text: 'SFDX: 組織のファイルとの差分を表示',
  force_source_diff_components_not_in_org:
    'Selected components are not available in the org',
  force_source_diff_unsupported_type:
    'このメタデータ型に対する差分は現在サポートされていません。',
  force_source_diff_title: '%s//%s ↔ ローカル //%s',
  package_id_validation_error:
    'Package ID should be a 15 or 18 character Id that starts with 04t',
  package_id_gatherer_placeholder: '04t...',
  aura_doc_url: 'https://developer.salesforce.com/tools/vscode/ja/aura/writing',
  apex_doc_url: 'https://developer.salesforce.com/tools/vscode/ja/apex/writing',
  soql_doc_url:
    'https://developer.salesforce.com/tools/vscode/ja/soql/soql-builder',
  lwc_doc_url: 'https://developer.salesforce.com/tools/vscode/ja/lwc/writing',
  functions_doc_url:
    'https://developer.salesforce.com/tools/vscode/ja/functions/overview',
  default_doc_url: 'https://developer.salesforce.com/tools/vscode/ja',
  parameter_gatherer_file_name_max_length_validation_error_message:
    'ファイル名は {0} 文字を超えることはできません'
};
