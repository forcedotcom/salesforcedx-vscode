/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConfigUtil } from '@salesforce/salesforcedx-utils-vscode';
import { SUM_TOKEN_MAX_LIMIT, IMPOSED_FACTOR } from '..';
import { workspaceContext } from '../../../context';
import { hasAuraFrameworkCapability } from '../../../oasUtils';
import {
  ApexClassOASEligibleResponse,
  ApexClassOASGatherContextResponse,
  PromptGenerationStrategyBid
} from '../../schemas';
import { buildClassPrompt } from '../buildPromptUtils';
import { GenerationStrategy } from '../generationStrategy';
import { openAPISchema_v3_0_guided } from '../openapi3.schema';

const MIN_ORG_VERSION = 65.0;

export class AuraEnabledStrategy extends GenerationStrategy {
  private isDefaultOrg: boolean;
  private isOrgVersionCompatible: boolean;

  constructor(metadata: ApexClassOASEligibleResponse, context: ApexClassOASGatherContextResponse) {
    super(
      metadata,
      context,
      'AuraEnabled',
      0,
      SUM_TOKEN_MAX_LIMIT * IMPOSED_FACTOR,
      'OpenAPI documents generated from Apex classes using @AuraEnabled annotations are in beta.'
    );
    this.servicePrompts = new Map();
    this.serviceResponses = new Map();
    this.serviceRequests = new Map();
    this.classPrompt = buildClassPrompt(this.context.classDetail);
    this.oasSchema = JSON.stringify(openAPISchema_v3_0_guided);
    this.isDefaultOrg = false;
    this.isOrgVersionCompatible = false;
  }
  get openAPISchema(): string {
    return this.oasSchema;
  }

  private async checkOrgVersion(): Promise<void> {
    try {
      const targetOrg = await ConfigUtil.getTargetOrgOrAlias();
      this.isDefaultOrg = targetOrg !== undefined;

      if (this.isDefaultOrg) {
        const connection = await workspaceContext.getConnection();
        const apiVersion = connection.getApiVersion();
        // Convert API version to number by handling decimal format (e.g. "58.0")
        const numericVersion = parseFloat(apiVersion);
        this.isOrgVersionCompatible = numericVersion >= MIN_ORG_VERSION;
      }
    } catch (err) {
      console.error('Failed to initialize org checks:', err);
      this.isDefaultOrg = false;
      this.isOrgVersionCompatible = false;
    }
  }

  public async bid(): Promise<PromptGenerationStrategyBid> {
    // Initialize org checks
    await this.checkOrgVersion();

    // Check if any method has @AuraEnabled annotation
    const hasAuraEnabled = hasAuraFrameworkCapability(this.context);

    // Only bid if we have Aura-enabled methods AND we're in the default org AND the org version is compatible
    const shouldBid = hasAuraEnabled && this.isDefaultOrg && this.isOrgVersionCompatible;

    return {
      result: {
        maxBudget: shouldBid ? this.maxBudget : 0,
        callCounts: shouldBid ? 1 : 0
      }
    };
  }

  public async generateOAS(): Promise<string> {
    const responses: string[] = [];

    // Get the connection and make the API call
    const connection = await workspaceContext.getConnection();
    const className = this.context.classDetail.name;
    const apiVersion = connection.getApiVersion();
    const endpoint = `${connection.instanceUrl}/services/data/v${apiVersion}/specifications/oas3/apex/${className}`;

    try {
      const result = await connection.request({
        method: 'GET',
        url: endpoint
      });
      responses.push(JSON.stringify(result));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to fetch OAS specification from org: ${errorMessage}`);
    }
    this.oasSchema = responses.join('\n');
    return this.oasSchema;
  }
}
