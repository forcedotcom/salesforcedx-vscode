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
  command_error_help_text: 'コマンドは次のエラーを返しました。',
  session_language_server_error_text: 'Apex 言語サーバは有効なブレークポイントに関する情報を提供できませんでした。',
  session_no_entity_access_text: '組織またはユーザに Apex をデバッグする権限がありません。',
  session_started_text: 'Apex デバッガセッションを ID %s で開始しました。',
  session_terminated_text: 'ID %s のApex デバッガセッションを終了しました。',
  streaming_connected_text: 'Streaming API のチャネル %s に接続しました。',
  streaming_disconnected_text: 'Streaming API のチャネル %s から切断しました。',
  streaming_handshake_error_text: 'Streaming API のハンドシェイクが次のエラーで失敗しました。',
  streaming_handshake_timeout_text:
    'Streaming API のハンドシェイクがソケットのタイムアウトで失敗しました。接続を確認し、再実行してください。',
  hotswap_warn_text:
    'Apex デバッガセッションの間に Apex クラスやトリガを修正することはできません。デバッグ完了後に変更を保存してください。',
  created_exception_breakpoint_text: '%s にブレークポイント例外を作成しました。',
  removed_exception_breakpoint_text: '%s のブレークポイント例外を削除しました。',
  idle_warn_text:
    '%d 分間アイドル状態です。デバッガセッションを終了させない場合は、%d 分以内に、コードを実行またはステップ実行するか、変数を検査してください。',
  idle_terminated_text: '%s 分間アイドル状態のため、デバッガセッションが終了されました。',
  invalid_isv_project_config:
    'ISV デバッグ用のプロジェクト設定が無効か未完了です。設定の Apex デバッガのページに戻り、新しいパートナーデバッグセッションを開始し、再実行してください。',
  unexpected_error_help_text:
    'デバッガセッションを起動する際に予期せぬエラーが発生しました。詳細は、デバッグコンソールを参照してください。',
};
