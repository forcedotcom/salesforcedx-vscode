/*
 * Copyright (c) 2018, salesforce.com, inc.
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
  session_language_server_error_text:
    'Apex 言語サーバは有効なブレークポイントに関する情報を提供できませんでした。',
  session_started_text:
    'Apex Replay Debugger セッションをログファイル %s で開始しました。',
  session_terminated_text: 'Apex Replay Debugger セッションを終了しました。',
  no_log_file_text:
    'ログファイルが見つからないか、ファイルにログの行が含まれていません。',
  incorrect_log_levels_text:
    'ログは、ログカテゴリを Apex が FINEST レベルに、Visualforce が FINER レベルで生成する必要があります。',
  unable_to_retrieve_org_info: 'OrgInfo の取得ができませんでした',
  heap_dump_error:
    'ヒープダンプ情報を取得する際に問題が発生しました。メッセージ=%s, エラーコード=%s, ヒープダンプ情報=%s',
  heap_dump_error_wrap_up_text:
    'ヒープダンプ情報を取得する際に問題が発生しました。詳細については、上記のメッセージを参照してください。指定された行について、詳細なヒープダンプ変数の情報が使用できません。',
  fetching_heap_dump:
    'サーバからヒープダンプ情報を取得しています。ヒープダンプ情報=%s',
  malformed_log_line:
    "不正な HEAP_DUMP のログの行が見つかりました。この行をスキップします。ログの行番号=%d、ログの行='%s'",
  reconcile_heapdump_error:
    'ヒープダンプ情報を取得する際に問題が発生しました: %s。 Tooling API を使用して ApexExecutionOverlayResult オブジェクトのレコード (ID %s) を削除してください。ターミナルから、"sf data:delete:record -t -s ApexExecutionOverlayResult -i %s" を実行してください。'
};
