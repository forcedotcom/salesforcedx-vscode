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
 * If omitted, we will assume _message.
 */
export const messages = {
  command_failure: '%s の実行に失敗しました。',
  command_canceled: '%s はキャンセルされました。',
  lightning_lwc_start_text: 'SFDX: ローカルの開発サーバを起動',
  lightning_lwc_start_not_found:
    'このコマンドを実行するには、最初に @salesforce/lwc-dev-server プラグインをインストールしてください。詳細は [https://developer.salesforce.com/docs/component-library/documentation/lwc/lwc.get_started_local_dev](https://developer.salesforce.com/docs/component-library/documentation/lwc/lwc.get_started_local_dev) を参照してください。',
  lightning_lwc_start_addr_in_use:
    'アドレスが既に使用されているため、ローカルの開発サーバを起動できませんでした。修正するには、次のいずれかの方法を試してください。\n 1) 他のインスタンスで起動しているローカルの開発サーバを停止する。\n2) デフォルトのポートを変更する。[プロジェクトの構成 (任意)](https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.get_started_local_dev_setup).\n 3) 指定したポートで起動しているプロセスを停止する。',
  lightning_lwc_inactive_scratch_org:
    'スクラッチ組織が有効ではないため、ローカルの開発サーバを起動できませんでした。「SFDX: デフォルトのスクラッチ組織を作成」を実行してスクラッチ組織を作成するか、「SFDX: デフォルトの組織を設定」を実行して有効なスクラッチ組織を選択してください。',
  lightning_lwc_start_failed: 'ローカルの開発サーバを起動できませんでした。',
  lightning_lwc_start_exited: 'ローカルの開発サーバがエラーコード %s で予期せず終了しました。',
  lightning_lwc_start_already_running: 'ローカルの開発サーバは既に起動しています。',
  lightning_lwc_stop_text: 'SFDX: ローカルの開発サーバを停止',
  lightning_lwc_stop_not_running: 'ローカルの開発サーバが起動していません。',
  lightning_lwc_stop_in_progress: 'ローカルの開発サーバを停止しています',
  lightning_lwc_preview_text: 'SFDX: コンポーネントをローカルでプレビュー',
  lightning_lwc_preview_file_undefined:
    'Lightning Web Component モジュールが見つかりません。ファイルパス %s が正しいか確認してください。',
  lightning_lwc_preview_file_nonexist:
    '%s 内に Lightning Web Component モジュールが見つかりません。モジュールが存在することを確認してください。',
  lightning_lwc_preview_unsupported:
    "ファイルパスが正しくありません。ローカルの開発サーバは Lightning Web Components module '%s.' を認識できません。",
  lightning_lwc_open_text: 'SFDX: ブラウザでローカルの開発サーバを開く',
  prompt_option_open_browser: 'ブラウザを開く',
  prompt_option_restart: '再起動',
  lwc_test_run_description_text: 'LWC テストを実行',
  lightning_lwc_test_navigate_to_test: 'SFDX: Lightning Web Component テストへ移動',
  no_lwc_jest_found_text:
    'sfdx-lwc-jest がインストールされていません。https://developer.salesforce.com/docs/component-library/documentation/lwc/lwc.unit_testing_using_jest_installation からインストールしてください。',
  no_lwc_testrunner_found_text: 'lwc-testrunner がインストールされていません。',
  no_workspace_folder_found_for_test_text: 'このテストのワークスペースフォルダを特定できませんでした',
  run_test_title: 'テストを実行',
  debug_test_title: 'テストをデバッグ',
  run_test_task_name: 'テストを実行',
  watch_test_task_name: 'テストをウォッチ',
  default_task_name: 'LWC テスト',
  task_windows_command_prompt_messaging: 'タスク実行時のデフォルトのシェルが cmd.exe に設定されます',
  lightning_lwc_no_mobile_plugin:
    'このコマンドを実行するには、@salesforce/lwc-dev-mobile プラグインをインストールしてください。',
  lightning_lwc_platform_selection: 'コンポーネントをプレビューするプラットフォームを選択',
  lightning_lwc_android_target_default: 'Android エミュレータの名前を入力 (デフォルトの場合は空)',
  lightning_lwc_ios_target_default: 'iOS シミュレータの名前を入力 (デフォルトの場合は空)',
  lightning_lwc_android_target_remembered: "Android エミュレータの名前を入力 ('%s' の場合は空)",
  lightning_lwc_ios_target_remembered: "iOS シミュレータの名前を入力 ('%s' の場合は空)",
  lightning_lwc_operation_cancelled: 'プレビュー操作がユーザによりキャンセルされました。',
  lightning_lwc_ios_label: 'iOS シミュレータを使用',
  lightning_lwc_ios_description: 'iOS 上でコンポーネントをプレビュー',
  lightning_lwc_android_label: 'Android エミュレータを使用',
  lightning_lwc_android_description: 'Android 上でコンポーネントをプレビュー',
  lightning_lwc_android_failure: "Android エミュレータ '%s' の起動に失敗しました。",
  lightning_lwc_ios_failure: "iOS シミュレータ '%s' の起動に失敗しました。",
  lightning_lwc_android_start: "Android エミュレータ '%s' を起動しています。",
  lightning_lwc_ios_start: "iOS シミュレータ '%s' を起動しています。",
  lightning_lwc_browserapp_label: 'ブラウザ',
  lightning_lwc_browserapp_description: 'モバイルブラウザ',
  lightning_lwc_preview_create_virtual_device_label: '新規...',
  lightning_lwc_preview_create_virtual_device_detail: '仮想デバイスを作成',
  lightning_lwc_preview_select_virtual_device: '仮想デバイスを選択...',
  lightning_lwc_preview_select_target_app: 'ターゲットアプリケーションを選択...',
  lightning_lwc_preview_desktop_label: 'デスクトップブラウザを使用',
  lightning_lwc_preview_desktop_description: 'デスクトップブラウザ上でコンポーネントをプレビュー',
  lwc_output_channel_name: 'LWC Extension',
  lightning_lwc_no_redhat_extension_found:
    'Salesforce js-meta.xml IntelliSense を使用するには、Red Hat XML 拡張機能が必要です。',
  lightning_lwc_deprecated_redhat_extension:
    'Salesforce js-meta.xml IntelliSense を使用するには、Red Hat XML 拡張機能のバージョン 0.14.0 以上が必要です。Red Hat XML 拡張機能をアップグレードしてください。',
  lightning_lwc_redhat_extension_regression:
    'Salesforce js-meta.xml IntelliSense は Red Hat XML 拡張機能のバージョン 0.15.0 では動作しません。Red Hat XML 拡張機能をアップグレードしてください。',
  lightning_lwc_fail_redhat_extension: 'Red Hat XML 拡張機能の設定に失敗しました'
};
