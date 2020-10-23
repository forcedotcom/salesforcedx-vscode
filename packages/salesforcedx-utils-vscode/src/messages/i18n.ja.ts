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
  sfdx_cli_not_found:
    'Salesforce CLI がインストールされていません。[%s](%s) からインストールしてください。',
  telemetry_legal_dialog_message:
    'VS Code の Salesforce 拡張機能が製品の改善のために、利用状況、ユーザ環境、クラッシュレポートを収集することに同意しました。[オプトアウトの方法について参照する](%s)。',
  telemetry_legal_dialog_button_text: 'さらに表示',

  notification_successful_execution_text: '%s が正常に実行されました。',
  notification_canceled_execution_text: '%s がキャンセルされました。',
  notification_unsuccessful_execution_text: '%s が失敗しました。',
  notification_show_button_text: '表示',
  notification_show_in_status_bar_button_text: 'ステータスバーだけに表示'
};
