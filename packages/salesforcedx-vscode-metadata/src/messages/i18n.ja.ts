/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MessageKey } from './i18n';

/**
 * Japanese translations for keys moved from core.
 * Partial - only keys that were deleted from core and are used in metadata.
 */
export const messages: Partial<Record<MessageKey, string>> = {
  delete_source_confirmation_message:
    'ソースファイルを削除すると、コンピュータからファイルが削除され、デフォルトの組織から対応するメタデータが取り除かれます。このソースをプロジェクトおよび組織から削除してもよろしいですか？',
  confirm_delete_source_button_text: 'ソースを削除',
  cancel_delete_source_button_text: 'キャンセル',

  missing_default_org: 'デフォルトの組織が未設定',

  conflict_detect_override_deploy: '競合を上書き',
  conflict_detect_show_conflicts_deploy: '競合を表示',
  conflict_detect_no_conflicts: '競合がありません',
  conflict_detect_diff_command_title: 'ファイルを比較',
  conflict_detect_no_differences: '差分がありません',

  source_diff_title: '%s//%s ↔ ローカル //%s',

  apex_trigger_name_prompt: 'ファイル名を入力',
  apex_name_empty_error: 'トリガ名を入力してください',
  apex_name_format_error: 'トリガ名は文字で始まり、英数字とアンダースコアのみ使用できます',
  apex_class_name_max_length_error: 'ファイル名は %s 文字を超えることはできません',
  apex_trigger_output_dir_prompt: 'フォルダを入力 (Enter で確認または Esc でキャンセル)',
  apex_generate_trigger_success: 'Apex トリガが作成されました',

  deploy_on_save_error_no_target_org:
    '保存時のデプロイ実行中にエラー: デフォルトの組織が設定されていません。"SFDX: 組織を認証" を実行して、保存した変更をデプロイしてください。'
};
