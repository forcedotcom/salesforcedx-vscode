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
  sfdx_cli_not_found: 'Salesforce CLI がインストールされていません。[%s](%s) からインストールしてください。',
  telemetry_legal_dialog_message:
    'VS Code の Salesforce 拡張機能が製品の改善のために、利用状況、ユーザ環境、クラッシュレポートを収集することに同意しました。[オプトアウトの方法について参照する](%s)。',
  telemetry_legal_dialog_button_text: 'さらに表示',

  progress_notification_text: '%s を実行しています。',
  notification_successful_execution_text: '%s が正常に実行されました。',
  notification_canceled_execution_text: '%s がキャンセルされました。',
  notification_unsuccessful_execution_text: '%s が失敗しました。',
  notification_show_button_text: '表示',
  notification_show_in_status_bar_button_text: 'ステータスバーだけに表示',

  error_no_target_org:
    'デフォルトの組織が設定されていません。"SFDX: デフォルトのスクラッチ組織を作成" または "SFDX: 組織を認証" を実行し組織を設定してください。',

  channel_name: 'Salesforce CLI',
  channel_starting_message: '開始しています: ',
  channel_end_with_exit_code: 'が終了コード %s で終了しました。',
  channel_end_with_sfdx_not_found:
    'Salesforce CLI がインストールされていません。https://developer.salesforce.com/tools/salesforcecli からインストールしてください。',
  channel_end_with_error: 'がエラーで終了しました。%s',
  channel_end: 'が終了しました。',
  predicates_no_folder_opened_text:
    'フォルダが開かれていません。VS Code で Salesforce DX 形式のプロジェクトを開いてください。',
  predicates_no_salesforce_project_found_text:
    '開かれたプロジェクトのルートディレクトリに sfdx-project.json ファイルが見つかりませんでした。VS Code で Salesforce DX 形式のプロジェクトを開いてください。'
};
