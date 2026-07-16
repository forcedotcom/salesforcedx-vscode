/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { OrgShape } from '../../context/workspaceContextUtil';

/** Org identity fields carried on the services identity bridge, cached onto reporters. */
export type OrgIdentity = {
  orgId?: string;
  orgShape?: OrgShape;
  devHubId?: string;
  orgEdition?: string;
};

export type TelemetryReporterConfig = {
  extName: string;
  version: string;
  aiKey: string;
  userId: string;
  reporterName: string;
  isDevMode: boolean;
  webUserId: string;
};

/** update existing telemetry reporters with new user ID and web user ID */
export type TelemetryReporterWithModifiableUserProperties = Pick<TelemetryReporterConfig, 'userId' | 'webUserId'> & {
  orgIdentity?: OrgIdentity;
};
