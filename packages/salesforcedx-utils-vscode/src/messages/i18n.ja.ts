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

  channel_name: 'Salesforce CLI',
  channel_starting_message: '開始しています: ',
  channel_end_with_exit_code: 'が終了コード %s で終了しました。',
  channel_end_with_sfdx_not_found:
    'Salesforce CLI がインストールされていません。https://developer.salesforce.com/tools/sfdxcli からインストールしてください。',
  channel_end_with_error: 'がエラーで終了しました。%s',
  channel_end: 'が終了しました。'
};
