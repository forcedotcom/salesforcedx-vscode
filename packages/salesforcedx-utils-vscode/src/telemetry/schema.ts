/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { z } from 'zod';

export const extensionPackageJsonSchema = z.object({
  name: z.string({ error: 'Extension name is not defined in package.json' }),
  version: z.string({ error: 'Extension version is not defined in package.json' }),
  aiKey: z.string().optional(),
  otelConnectionString: z.string().optional(),
  // required for either original o11y OR PFT
  o11yUploadEndpoint: z.string().optional(),
  // original o11y (that is, sending most events and having them end up in splunk)
  enableO11y: z.stringbool().optional(),
  productFeatureId: z.string().startsWith('aJC').optional(),
  // Enable routing Effect spans to App Insights customEvents table via LogRecords
  enableCustomEventsFromSpans: z.boolean().optional(),
  // opt-in Falcon publishing for O11y (consumed by services sdkLayerConfig); absent = existing upload path.
  // falconApiKey must be a provisioned write-only client key; never commit ad-hoc/personal keys.
  falconApiKey: z.string().optional(),
  // 'dev' | 'prod'; kept loose so a typo can't fail parse (services drops unrecognized values → dev)
  falconEnvironment: z.string().optional(),
  falconEndpoint: z.string().optional()
});
