/*
 * Copyright (c) 2026, salesforce.com, inc.
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

  preparing_deployment: 'デプロイの準備中...',
  preparing_retrieval: '取得の準備中...',
  preparing_deletion: '削除の準備中...',
  checking_for_conflicts: '競合を確認中...',

  deploy_on_save_error_no_target_org:
    '保存時のデプロイ実行中にエラー: デフォルトの組織が設定されていません。"SFDX: 組織を認証" を実行して、保存した変更をデプロイしてください。',

  package_install_text: 'SFDX: パッケージをインストール',
  package_install_id_prompt: 'インストールするパッケージの ID を入力してください',
  package_install_id_validation: 'パッケージ ID は 04t で始まる 15 文字または 18 文字の ID である必要があります',
  package_install_key_prompt:
    'キー保護されたパッケージのインストールキー (保護されていないパッケージの場合は空欄のままにしてください)',
  package_install_poll_prompt: 'パッケージのインストール完了を待ちますか？',
  package_install_poll_yes: 'はい',
  package_install_poll_no: 'いいえ',
  package_install_polling_progress: 'パッケージ %s をインストール中...',
  package_install_submitted_message: 'パッケージインストールリクエストを送信しました。リクエスト ID: %s',
  package_install_succeeded_message: 'パッケージ %s が正常にインストールされました。',
  package_install_cancelled_message:
    'ポーリングをキャンセルしました。インストールはサーバー上で続行されます。リクエスト ID: %s',
  package_install_failed_message: 'パッケージのインストールに失敗しました: %s'
};
