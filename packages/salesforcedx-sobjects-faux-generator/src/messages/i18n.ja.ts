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
  faux_generation_cancelled_text: '疑似クラスの作成がキャンセルされました',
  failure_fetching_sobjects_list_text:
    '組織から sObject のリストの取得に失敗しました。%s',
  failure_in_sobject_describe_text: 'sObject の記述に失敗しました。%s',
  no_sobject_output_folder_text:
    '利用できる出力フォルダ %s がありません。このフォルダを作成し再度更新してください。',
  fetched_sobjects_length_text:
    'デフォルトの組織から %s %s sObject を取得しました。\n',
  no_generate_if_not_in_project:
    'SFDX プロジェクトを開いていない場合、sObject の擬似クラスを生成できません。%s',
  class_header_generated_comment: `\/\/ This file is generated as an Apex representation of the
\/\/     corresponding sObject and its fields.
\/\/ This read-only file is used by the Apex Language Server to
\/\/     provide code smartness, and is deleted each time you
\/\/     refresh your sObject definitions.
\/\/ To edit your sObjects and their fields, edit the corresponding
\/\/     .object-meta.xml and .field-meta.xml files.

`
};
