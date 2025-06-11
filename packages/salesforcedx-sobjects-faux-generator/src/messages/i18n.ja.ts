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
  faux_generation_cancelled_text: '疑似クラスの作成がキャンセルされました',
  failure_fetching_sobjects_list_text: '組織から sObject のリストの取得に失敗しました。%s',
  failure_in_sobject_describe_text: 'sObject の記述に失敗しました。%s',
  processed_sobjects_length_text: 'デフォルトの組織から %d %s sObject を取得しました。\n',
  no_sobject_output_folder_text: '利用できる出力フォルダ %s がありません。このフォルダを作成し再度更新してください。',
  no_generate_if_not_in_project: 'SFDX プロジェクトを開いていない場合、sObject の擬似クラスを生成できません。%s'
};
