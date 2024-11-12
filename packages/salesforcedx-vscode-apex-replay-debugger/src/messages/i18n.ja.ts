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
  config_name_text: 'Apex Replay Debugger を起動',
  session_language_server_error_text: 'Apex 言語サーバは有効なブレークポイントに関する情報を提供できませんでした。',
  up_to_five_checkpoints:
    '最大 5 つのうち、%s つのチェックポイントを設定しています。5 つ以下になるようチェックポイントを削除または無効化してください。',
  no_enabled_checkpoints: 'チェックポイントが 1 つも設定されていません。チェックポイントを設定し、再実行してください。',
  checkpoints_can_only_be_on_valid_apex_source:
    'チェックポイントApex ソースの有効な行に設定できます。無効なチェックポイントの位置 : URI=%s, 行=%s',
  local_source_is_out_of_sync_with_the_server:
    'ローカルソースはサーバーと同期していません。ローカルで行った変更を組織にプッシュし、組織で行った変更をローカルプロジェクトにプルしてください。',
  long_command_start: '開始しています',
  long_command_end: '終了しています',
  sf_update_checkpoints_in_org: 'SFDX: 組織のチェックポイントを更新',
  checkpoint_creation_status_org_info: 'ステップ 1/6: 組織の情報を取得しています。',
  checkpoint_creation_status_source_line_info: 'ステップ 2/6: ソースと行の情報を取得しています。',
  checkpoint_creation_status_setting_typeref: 'ステップ 3/6: チェックポイントに typeRef を設定しています。',
  checkpoint_creation_status_clearing_existing_checkpoints: 'ステップ 4/6: 既存のチェックポイントをクリアしています。',
  checkpoint_creation_status_uploading_checkpoints: 'ステップ 5/6: チェックポイントをアップロードしています。',
  checkpoint_creation_status_processing_complete_success:
    'ステップ 6/6: チェックポイントが正常に作成されたことを確認しています。',
  checkpoint_upload_in_progress:
    '組織へのチェックポイントの更新が進行中です。チェックポイントを新たに追加、削除する前に更新の完了をお待ちください。',
  checkpoint_upload_error_wrap_up_message:
    'チェックポイントにはエラーがあります。出力されるエラーを修正し、%s を再度実行してください。',
  // These strings are going to be re-worked to become better, Salesforce appropriate, error messages.
  cannot_determine_workspace: 'ワークスペースのフォルダを特定できませんでした。',
  cannot_delete_existing_checkpoint: '既存のチェックポイントを削除できません。',
  unable_to_parse_checkpoint_query_result: 'チェックポイントのクエリ結果をパースできませんでした。',
  unable_to_retrieve_active_user_for_sf_project: 'SFDX プロジェクトの有効なユーザを取得できませんでした。',
  unable_to_query_for_existing_checkpoints: '既存のチェックポイントをクエリできませんでした。',
  unable_to_load_vscode_core_extension: 'salesforce.salesforcedx-vscode-core の拡張機能を読み込めませんでした。',
  no_line_breakpoint_information_for_current_project:
    '現在のプロジェクトにはブレークポイントの情報を含む行がありません。',
  line_breakpoint_information_success: '言語サーバからブレークポイントの行を取得しました。',
  language_client_not_ready:
    '言語サーバからブレークポイントの情報を取得できませんでした。言語サーバが起動していません。',
  unable_to_retrieve_org_info: 'OrgInfo を取得できませんでした。',
  error_no_target_org:
    'デフォルトの組織が設定されていません。"SFDX: デフォルトのスクラッチ組織を作成" または "SFDX: 組織を認証" を実行し、デフォルトの組織を設定してください。',
  debug_test_exec_name: 'テストをデバッグ',
  debug_test_no_results_found: 'テスト結果が見つかりませんでした',
  debug_test_no_debug_log: 'テスト結果に関連するデバッグログが見つかりませんでした',
  channel_name: 'Apex Replay デバッガ'
};
