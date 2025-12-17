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
  config_name_text: 'Apex デバッガを起動',
  select_exception_text: '例外を選択',
  select_break_option_text: '中断オプションを選択',
  always_break_text: '常に中断',
  never_break_text: '中断しない',
  language_client_not_ready:
    '言語サーバからブレークポイントの情報を取得できませんでした。言語サーバが起動していません。',
  isv_debug_config_environment_error:
    '環境を設定している際に VS Code の Salesforce 拡張機能で問題が発生しました。一部の機能が動作しない可能性があります。詳細については、[ヘルプ] > [開発者ツールの切り替え] を参照するか、~/.sfdx/sfdx.log 内のSalesforce CLI のログを確認してください。',
  parameter_gatherer_enter_project_name: 'プロジェクト名を入力',
  parameter_gatherer_paste_forceide_url: '設定から forceide:// の URL をペースト',
  parameter_gatherer_paste_forceide_url_placeholder: '設定の forceide:// URL',
  parameter_gatherer_invalid_forceide_url:
    'forceide:// 形式の URL が無効です。登録者の組織から、設定の Apex デバッガのページに表示される forceide:// 形式の URL をコピー・ペーストしてください。',
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
  error_updating_salesforce_project: 'sfdx-project.json の更新中にエラー: %s',
  error_writing_installed_package_info: 'installed-package.json の書き込み中にエラー: %s',
  error_cleanup_temp_files: '一時ファイルのクリーンアップ中にエラー: %s',
  error_creating_launchjson: 'launch.json の作成中にエラー: %s',
  warning_prompt_dir_overwrite:
    '指定したプロジェクト名のフォルダが選択したディレクトリに既に存在します。上書きしますか?',
  warning_prompt_overwrite: '上書き',
  warning_prompt_overwrite_cancel: 'キャンセル',
  project_generate_open_dialog_create_label: 'プロジェクトを作成',
  debugger_query_session_text: 'Apex デバッガセッションをクエリ',
  debugger_stop_text: 'SFDX: Apex デバッガセッションを停止',
  debugger_stop_none_found_text: 'Apex デバッガセッションが見つかりませんでした。'
};
