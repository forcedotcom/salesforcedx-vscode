/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export const forceignore = [
  '# List files or directories below to ignore them when running force:source:push, force:source:pull, and force:source:status',
  '# More information: https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_exclude_source.htm',
  '#',
  '',
  'package.xml',
  '',
  '# LWC configuration files',
  '**/jsconfig.json',
  '**/.eslintrc.json',
  '',
  '# LWC Jest',
  '**/__tests__/**%'
];
