/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { MessageKey } from './i18n';

export const messages: Partial<Record<MessageKey, string>> = {
  retrieving_tests_message: 'テストを取得しています…',
  apex_test_suites_parent_text: 'Apex テストスイート',
  apex_testing_vfs_org_badge_text: 'ORG',
  apex_testing_vfs_org_file_tooltip_text: '組織の仮想ファイル (読み取り専用)',
  apex_testing_vfs_readonly_prefix_text: 'apex-testing は読み取り専用です',
  apex_discovery_vfs_class_body_placeholder: '// ソースを取得できません: %s'
};
