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
    '環境を設定している際に VS Code の Salesforce 拡張機能で問題が発生しました。一部の機能が動作しない可能性があります。詳細については、[ヘルプ] > [開発者ツールの切り替え] を参照するか、~/.sfdx/sfdx.log 内のSalesforce CLI のログを確認してください。'
};
