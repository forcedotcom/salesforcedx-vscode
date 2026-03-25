/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MISSING_LABEL_MSG } from '@salesforce/vscode-i18n';
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
  channel_end: 'が終了しました。',

  parameter_gatherer_enter_file_name: 'ファイル名を入力',
  parameter_gatherer_enter_dir_name: 'フォルダを入力 (Enter で確認または Esc でキャンセル)',
  parameter_gatherer_enter_project_name: 'プロジェクト名を入力',
  parameter_gatherer_select_lwc_type: 'LWC コンポーネントタイプを選択',

  project_retrieve_start_default_org_text: 'SFDX: デフォルトのスクラッチ組織からソースをプル',

  project_deploy_start_default_org_text: 'SFDX: デフォルトのスクラッチ組織へソースを転送',

  deploy_this_source_text: 'SFDX: このソースを組織へデプロイ',
  retrieve_this_source_text: 'SFDX: このソースを組織から取得',

  delete_source_text: 'SFDX: プロジェクトおよび組織から削除',
  delete_source_manifest_unsupported_message:
    'SFDX: 組織およびプロジェクトから削除 はマニフェストファイルでサポートされていません。削除するソースファイルやディレクトリを選択してください。',
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
  warning_prompt_dir_overwrite:
    '指定されたプロジェクト名は選択されたディレクトリ上に既に存在します。上書きしてもよろしいですか？',
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
  project_generate_text: 'SFDX: プロジェクトを作成',
  project_generate_open_dialog_create_label: 'プロジェクトを作成',
  project_generate_standard_template_display_text: '標準',
  project_generate_empty_template_display_text: '空',
  project_generate_empty_template: '空のプロジェクトテンプレート',
  project_generate_analytics_template: 'Analytics のプロジェクトテンプレート',
  project_generate_react_b2x_template_display_text: 'React 外部アプリ',
  project_generate_react_b2e_template_display_text: 'React 内部アプリ',
  project_generate_react_b2x_template: '組織外の顧客・パートナー向け (B2C)。サンプル: Property Rental App',
  project_generate_react_b2e_template:
    'Salesforce 認証でサインインする従業員向け (B2E)。サンプル: Property Management App',
  project_generate_agent_template_display_text: 'エージェント',
  project_generate_agent_template: 'エージェントのプロジェクトテンプレート',
  telemetry_legal_dialog_message:
    'VS Code の Salesforce 拡張機能が製品の改善のために、利用状況、ユーザ環境、クラッシュレポートを収集することに同意しました。[オプトアウトの方法について参照する](%s)。',
  telemetry_legal_dialog_button_text: 'さらに表示',
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
  missing_default_org: 'デフォルトの組織が未設定',
  error_parsing_sfdx_project_file: 'sfdx-project.json ファイル (%s) をパースできませんでした。パースエラー: %s',

  custom_output_directory: 'ディレクトリを選択',
  lightning_generate_lwc_text: 'SFDX: Lightning Web コンポーネントを作成',
  error_overwrite_prompt: '既存コンポーネントのワークスペース確認中にエラー',

  conflict_detect_error: '競合を検出中にエラーが発生しました。%s',
  conflict_detect_override_deploy: '競合を上書き',
  conflict_detect_show_conflicts_deploy: '競合を表示',

  conflict_detect_no_target_org: 'このプロジェクトにはデフォルトのユーザ名がありません',
  conflict_detect_view_init: '競合検出ビューが初期化されていません',
  conflict_detect_not_enabled:
    '組織との差分を表示するために、Detect Conflicts for Deploy and Retrieve 設定を有効化してください',

  conflict_detect_no_conflicts: '競合がありません',

  conflict_detect_diff_command_title: 'ファイルを比較',

  source_diff_text: 'SFDX: 組織のファイルとの差分を表示',

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
  lib_retrieve_result_title: '取得されたソース',
  lib_retrieve_message_title: '取得警告',
  component_input_dup_error: 'コンポーネント名は LWC または Aura で既に使用されています',
  rename_component_input_dup_file_name_error:
    'このファイル名は現在のコンポーネントディレクトリで既に使用されています。別の名前を選択して再試行してください。',
  rename_component_input_placeholder: '一意のコンポーネント名を入力',
  rename_component_input_prompt: 'Enter で入力を確認、Escape でキャンセル',
  rename_component_warning:
    '警告: 古い名前への参照は更新されません。手動で更新し、すべての変更が完了したら再デプロイしてください。',
  rename_component_error:
    'コンポーネントの名前を変更できませんでした。手動でコンポーネントの名前を変更してから、変更を再デプロイしてみてください。',
  source_status: 'ソースステータス',
  rename_not_supported: '複数コンポーネントの名前変更はサポートされていません',
  input_no_component_name: '入力にコンポーネント名が含まれていません',
  component_empty: 'コンポーネントは空にできません',
  create_not_supported: '複数コンポーネントの作成はサポートされていません',
  input_incorrect_properties: '入力に正しいコンポーネントプロパティが含まれていません',
  // eslint-disable-next-line prefer-template
  missing_label: MISSING_LABEL_MSG + ': %s'
};
