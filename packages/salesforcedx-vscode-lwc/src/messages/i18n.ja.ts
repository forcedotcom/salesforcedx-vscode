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
  default_task_name: 'LWC テスト',
  task_windows_command_prompt_messaging:
    'Default shell for running tasks is set to cmd.exe',
  force_lightning_lwc_no_mobile_plugin:
    'To run this command, install the @salesforce/lwc-dev-mobile plugin.',
  force_lightning_lwc_platform_selection:
    'Select the platform for previewing the component',
  force_lightning_lwc_android_target_default:
    'Enter a name for the Android emulator (leave blank for default)',
  force_lightning_lwc_ios_target_default:
    'Enter a name for the iOS simulator (leave blank for default)',
  force_lightning_lwc_android_target_remembered:
    "Enter a name for the Android emulator (leave blank for '%s')",
  force_lightning_lwc_ios_target_remembered:
    "Enter a name for the iOS simulator (leave blank for '%s')",
  force_lightning_lwc_operation_cancelled:
    'Preview operation cancelled by user.',
  force_lightning_lwc_ios_label: 'Use iOS Simulator',
  force_lightning_lwc_ios_description: 'Preview component on iOS',
  force_lightning_lwc_android_label: 'Use Android Emulator',
  force_lightning_lwc_android_description: 'Preview component on Android',
  force_lightning_lwc_android_failure: "Failed to start Android Emulator '%s'.",
  force_lightning_lwc_ios_failure: "Failed to start iOS Simulator '%s'.",
  force_lightning_lwc_android_start: "Starting Android Emulator '%s'.",
  force_lightning_lwc_ios_start: "Starting iOS Simulator '%s'.",
  force_lightning_lwc_browserapp_label: 'Browser',
  force_lightning_lwc_browserapp_description: 'Your mobile browser.',
  force_lightning_lwc_preview_create_virtual_device_label: 'New...',
  force_lightning_lwc_preview_create_virtual_device_detail:
    'Create a Virtual Device',
  force_lightning_lwc_preview_select_virtual_device:
    'Select a Virtual Device...',
  force_lightning_lwc_preview_select_target_app:
    'Select a Target Application...',
  force_lightning_lwc_preview_desktop_label: 'Use Desktop Browser',
  force_lightning_lwc_preview_desktop_description:
    'Preview component on desktop browser',
  lwc_output_channel_name: 'LWC Extension'
};
