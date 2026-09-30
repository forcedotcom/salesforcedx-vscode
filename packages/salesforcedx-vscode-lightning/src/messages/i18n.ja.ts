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
  client_name: 'Aura 言語サーバ',
  aura_language_server_loading: 'Aura ファイルをインデックス化しています。しばらくお待ちください… $(sync~spin)',
  aura_language_server_loaded: 'インデックス化が完了しました $(check)',
  aura_generate_app_success: 'Aura アプリが正常に作成されました',
  aura_generate_component_success: 'Aura コンポーネントが正常に作成されました',
  aura_generate_event_success: 'Aura イベントが正常に作成されました',
  aura_generate_interface_success: 'Aura インターフェースが正常に作成されました',
  template_type_prompt: 'テンプレートの種類を選択',
  aura_builtin_templates_label: '組み込みテンプレート',
  aura_custom_templates_label: 'カスタムテンプレート',
  aura_component_default_template_description: '標準の Aura コンポーネント',
  aura_event_default_template_description: '標準の Aura イベント',
  aura_interface_default_template_description: '標準の Aura インターフェース',
  aura_app_default_template_description: '標準の Aura アプリ',
  rename_component_warning:
    '警告: 古い名前への参照は更新されません。手動で更新し、すべての変更が完了したら再デプロイしてください。',
  rename_component_input_dup_file_name_error:
    'このファイル名は現在のコンポーネントディレクトリで既に使用されています。別の名前を選択して再試行してください。',
  component_input_dup_error: 'コンポーネント名は LWC または Aura で既に使用されています'
};
