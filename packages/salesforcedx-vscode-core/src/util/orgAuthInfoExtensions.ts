/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthFields } from '@salesforce/core';
import { WorkspaceContext } from '../context';

/** Extensions to OrgAuthInfo that depend on WorkspaceContext */
export class OrgAuthInfoExtensions {
  /** Get the org API version from the workspace context */
  public static async getOrgApiVersion(): Promise<string | undefined> {
    const connection = await WorkspaceContext.getInstance().getConnection();
    const apiVersion = connection.getApiVersion();
    return apiVersion ? String(apiVersion) : undefined;
  }

  /** Get the user ID from the workspace context */
  public static async getUserId(): Promise<string | undefined> {
    const connection = await WorkspaceContext.getInstance().getConnection();
    const userId = connection.getAuthInfoFields().userId ?? (await connection.identity()).user_id;
    return userId;
  }

  /** Get auth fields from the workspace context */
  public static async getAuthFields(): Promise<AuthFields> {
    const connection = await WorkspaceContext.getInstance().getConnection();
    return connection.getAuthInfoFields();
  }
}
