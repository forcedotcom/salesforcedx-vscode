/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { WebSdk } from '@effect/opentelemetry';
import { ConsoleSpanExporter, BatchSpanProcessor } from '@opentelemetry/sdk-trace-web';

export const WebSdkLayer = WebSdk.layer(() => ({
  resource: {
    serviceName: 'salesforcedx-vscode-services',
    timestamp: '2025-08-14T18:41:30.000Z',
    // serviceVersion: '0.0.1',
    attributes: {}
  },
  spanProcessor: new BatchSpanProcessor(new ConsoleSpanExporter())
}));
