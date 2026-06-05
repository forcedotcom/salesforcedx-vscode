/*
 * Copyright (c) 2026, salesforce.com, inc.
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
  config_list_text: 'SFDX: すべての設定変数を一覧表示',
  alias_list_text: 'SFDX: すべてのエイリアスを一覧表示',
  telemetry_legal_dialog_message:
    'VS Code の Salesforce 拡張機能が製品の改善のために、利用状況、ユーザ環境、クラッシュレポートを収集することに同意しました。[オプトアウトの方法について参照する](%s)。',
  telemetry_legal_dialog_button_text: 'さらに表示',
  error_parsing_sfdx_project_file: 'sfdx-project.json ファイル (%s) をパースできませんでした。パースエラー: %s',

  aura_doc_url: 'https://developer.salesforce.com/tools/vscode/ja/aura/writing',
  apex_doc_url: 'https://developer.salesforce.com/tools/vscode/ja/apex/writing',
  soql_doc_url: 'https://developer.salesforce.com/tools/vscode/ja/soql/soql-builder',
  lwc_doc_url: 'https://developer.salesforce.com/tools/vscode/ja/lwc/writing',
  functions_doc_url: 'https://developer.salesforce.com/tools/vscode/ja/functions/overview',
  default_doc_url: 'https://developer.salesforce.com/tools/vscode/ja',

  component_input_dup_error: 'コンポーネント名は LWC または Aura で既に使用されています',
  rename_component_input_dup_file_name_error:
    'このファイル名は現在のコンポーネントディレクトリで既に使用されています。別の名前を選択して再試行してください。',
  rename_component_input_placeholder: '一意のコンポーネント名を入力',
  rename_component_input_prompt: 'Enter で入力を確認、Escape でキャンセル',
  rename_component_warning:
    '警告: 古い名前への参照は更新されません。手動で更新し、すべての変更が完了したら再デプロイしてください。',
  rename_component_error:
    'コンポーネントの名前を変更できませんでした。手動でコンポーネントの名前を変更してから、変更を再デプロイしてみてください。',
  rename_not_supported: '複数コンポーネントの名前変更はサポートされていません',
  input_no_component_name: '入力にコンポーネント名が含まれていません',
  component_empty: 'コンポーネントは空にできません'
};
