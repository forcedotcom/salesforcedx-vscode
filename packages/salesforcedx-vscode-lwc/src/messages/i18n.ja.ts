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
  command_failure: '%s の実行に失敗しました。',
  command_canceled: '%s はキャンセルされました。',
  force_lightning_lwc_start_text: 'SFDX: ローカルの開発サーバを開始',
  force_lightning_lwc_start_not_found:
    'このコマンドを実行するには、最初に @salesforce/lwc-dev-server プラグインをインストールしてください。詳細は [https://developer.salesforce.com/docs/component-library/documentation/lwc/lwc.get_started_local_dev](https://developer.salesforce.com/docs/component-library/documentation/lwc/lwc.get_started_local_dev) を参照してください。',
  force_lightning_lwc_start_failed:
    'ローカルの開発サーバを開始できませんでした。',
  force_lightning_lwc_start_exited:
    'ローカルの開発サーバがエラーコード %s で予期せず終了しました。',
  force_lightning_lwc_start_already_running:
    'ローカルの開発サーバは既に起動しています。',
  force_lightning_lwc_stop_text: 'SFDX: ローカルの開発サーバを停止',
  force_lightning_lwc_stop_not_running:
    'ローカルの開発サーバが起動していません。',
  force_lightning_lwc_stop_in_progress: 'ローカルの開発サーバを停止しています',
  force_lightning_lwc_preview_text:
    'SFDX: コンポーネントをローカルでプレビュー',
  force_lightning_lwc_preview_file_undefined:
    'Lightning Web Component モジュールが見つかりません。ファイルパス %s が正しいか確認してください。',
  force_lightning_lwc_preview_file_nonexist:
    '%s 内に Lightning Web Component モジュールが見つかりません。モジュールが存在することを確認してください。',
  force_lightning_lwc_preview_unsupported:
    "ファイルパスが正しくありません。ローカルの開発サーバは Lightning Web Components module '%s.' を認識できません。",
  force_lightning_lwc_open_text: 'SFDX: ブラウザでローカルの開発サーバを開く',
  prompt_option_open_browser: 'ブラウザを開く',
  prompt_option_restart: '再起動',
  force_lwc_test_run_description_text: 'LWC テストを実行',
  force_lightning_lwc_test_navigate_to_test:
    'SFDX: Lightning Web Component テストへ移動',
  no_lwc_jest_found_text:
    'sfdx-lwc-jest がインストールされていません。https://developer.salesforce.com/docs/component-library/documentation/lwc/lwc.unit_testing_using_jest_installation からインストールしてください。',
  no_workspace_folder_found_for_test_text:
    'このテストのワークスペースフォルダを特定できませんでした',
  run_test_title: 'テストを実行',
  debug_test_title: 'テストをデバッグ',
  run_test_task_name: 'テストを実行',
  watch_test_task_name: 'テストをウォッチ',
  default_task_name: 'LWC テスト'
};
