/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthRemover, AuthInfo, AuthFields, Org, ConfigAggregator, OrgConfigProperties } from '@salesforce/core-bundle';
import {
  ContinueResponse,
  LibraryCommandletExecutor,
  SfWorkspaceChecker,
  Table,
  Column,
  Row,
  ConfigUtil
} from '@salesforce/salesforcedx-utils-vscode';
import { OUTPUT_CHANNEL, channelService } from '../channels';
import { nls } from '../messages';

import { getAuthFieldsFor } from '../util/orgUtil';
import { PromptConfirmGatherer, SfCommandlet } from './util';

/** Check actual connection status by testing the connection */
const determineConnectedStatusForNonScratchOrg = async (username: string): Promise<string | undefined> => {
  let org: Org | undefined;
  try {
    org = await Org.create({ aliasOrUsername: username });

    // Skip connection testing for scratch orgs (they have DEV_HUB_USERNAME)
    if (org.getField(Org.Fields.DEV_HUB_USERNAME)) {
      return undefined;
    }

    await org.refreshAuth();
    return 'Connected';
  } catch (err) {
    return authErrorHandler(err, org?.getUsername() ?? username);
  }
};

const authErrorHandler = (err: unknown, _username: string): string => {
  if (err instanceof Error) {
    // Orgs under maintenance return html as the error message
    if (err.message.includes('maintenance')) return 'Down (Maintenance)';

    // Handle other potential html responses
    if (err.message.includes('<html>') || err.message.includes('<!DOCTYPE HTML>')) return 'Bad Response';

    // Handle specific error codes/messages
    if (
      err.message.includes('expired access/refresh token') ||
      err.message.includes('INVALID_SESSION_ID') ||
      err.message.includes('Bad_OAuth_Token') ||
      err.message.includes('RefreshTokenAuthError')
    ) {
      return 'Unable to refresh session: expired access/refresh token';
    }
    return err.message;
  }

  return String(err);
};

/** Format time difference into human-readable string */
export const formatTimeDifference = (timeDiffInMs: number): string => {
  const totalMinutes = Math.floor(timeDiffInMs / (1000 * 60));
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);

  if (totalDays > 0) {
    const remainingHours = totalHours % 24;
    const remainingMinutes = totalMinutes % 60;

    if (remainingHours > 0 && remainingMinutes > 0) {
      return `${totalDays} day${totalDays > 1 ? 's' : ''}, ${remainingHours} hour${remainingHours > 1 ? 's' : ''}, ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}`;
    } else if (remainingHours > 0) {
      return `${totalDays} day${totalDays > 1 ? 's' : ''}, ${remainingHours} hour${remainingHours > 1 ? 's' : ''}`;
    } else {
      return `${totalDays} day${totalDays > 1 ? 's' : ''}`;
    }
  } else if (totalHours > 0) {
    const remainingMinutes = totalMinutes % 60;
    if (remainingMinutes > 0) {
      return `${totalHours} hour${totalHours > 1 ? 's' : ''}, ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}`;
    } else {
      return `${totalHours} hour${totalHours > 1 ? 's' : ''}`;
    }
  } else {
    return `${totalMinutes} minute${totalMinutes !== 1 ? 's' : ''}`;
  }
};

class OrgListCleanExecutor extends LibraryCommandletExecutor<{}> {
  constructor() {
    super(nls.localize('org_list_clean_text'), 'org_list_clean', OUTPUT_CHANNEL);
  }

  public async run(_response: ContinueResponse<{}>): Promise<boolean> {
    const removedOrgs = await this.removeExpiredAndDeletedOrgs();

    if (removedOrgs.length > 0) {
      channelService.appendLine(nls.localize('org_list_clean_success_message', removedOrgs.length));
    } else {
      channelService.appendLine(nls.localize('org_list_clean_no_orgs_message'));
    }

    await this.displayRemainingOrgs();

    return true;
  }

  private async removeExpiredAndDeletedOrgs(): Promise<string[]> {
    const removedOrgs: string[] = [];
    const now = new Date().getTime();

    try {
      const orgAuthorizations = await AuthInfo.listAllAuthorizations();
      if (!orgAuthorizations || orgAuthorizations.length === 0) {
        return removedOrgs;
      }

      const authRemover = await AuthRemover.create();

      for (const orgAuth of orgAuthorizations) {
        try {
          // Skip dev hubs
          if (orgAuth.isDevHub) {
            continue;
          }

          // Skip orgs with errors - they are likely already invalid
          if (orgAuth.error) {
            channelService.appendLine(
              nls.localize('org_list_clean_skipping_org_with_error', orgAuth.username, orgAuth.error)
            );
            continue;
          }

          const authFields: AuthFields = await getAuthFieldsFor(orgAuth.username);

          // Check if this is a scratch org with an expiration date
          if (authFields.expirationDate) {
            const expirationDate = new Date(authFields.expirationDate);

            // Validate that we have a valid expiration date
            if (isNaN(expirationDate.getTime())) {
              channelService.appendLine(
                nls.localize('org_list_clean_invalid_expiration_date', orgAuth.username, authFields.expirationDate)
              );
              continue;
            }

            // More precise expiration check: compare exact timestamps, not just dates
            // This accounts for the time of day when the org actually expires
            if (expirationDate.getTime() < now) {
              const timeDiff = now - expirationDate.getTime();
              const timeDiffFormatted = formatTimeDifference(timeDiff);

              channelService.appendLine(
                nls.localize(
                  'org_list_clean_removing_expired_org_detailed',
                  orgAuth.username,
                  authFields.expirationDate,
                  timeDiffFormatted
                )
              );
              await authRemover.removeAuth(orgAuth.username);
              removedOrgs.push(orgAuth.username);
            }
          }
        } catch (error) {
          // If we can't get auth fields, the org might be deleted/invalid - try to remove it
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (
            errorMessage.includes('INVALID_LOGIN') ||
            errorMessage.includes('No such org') ||
            errorMessage.includes('NamedOrgNotFound') ||
            errorMessage.includes('NoAuthInfoFound')
          ) {
            try {
              channelService.appendLine(
                nls.localize('org_list_clean_removing_invalid_org', orgAuth.username, errorMessage)
              );
              await authRemover.removeAuth(orgAuth.username);
              removedOrgs.push(orgAuth.username);
            } catch (removeError) {
              channelService.appendLine(
                nls.localize(
                  'org_list_clean_failed_to_remove_org',
                  orgAuth.username,
                  removeError instanceof Error ? removeError.message : String(removeError)
                )
              );
            }
          } else {
            channelService.appendLine(
              nls.localize('org_list_clean_error_checking_org', orgAuth.username, errorMessage)
            );
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(nls.localize('org_list_clean_general_error', errorMessage));
    }

    return removedOrgs;
  }

  /** Display remaining orgs in a table format */
  private async displayRemainingOrgs(): Promise<void> {
    try {
      const orgAuthorizations = await AuthInfo.listAllAuthorizations();
      if (!orgAuthorizations || orgAuthorizations.length === 0) {
        channelService.appendLine(`\n${nls.localize('org_list_no_orgs_found')}`);
        return;
      }

      const orgData: Row[] = [];
      const now = new Date().getTime();

      // Use ConfigAggregator for proper default org detection and resolve to usernames
      const configAggregator = await ConfigAggregator.create();
      const defaultDevHubProperty = configAggregator.getPropertyValue(OrgConfigProperties.TARGET_DEV_HUB);
      const defaultOrgProperty = configAggregator.getPropertyValue(OrgConfigProperties.TARGET_ORG);

      // Resolve aliases to usernames for comparison
      const defaultDevHubUsername = defaultDevHubProperty
        ? await ConfigUtil.getUsernameFor(String(defaultDevHubProperty))
        : undefined;
      const defaultOrgUsername = defaultOrgProperty
        ? await ConfigUtil.getUsernameFor(String(defaultOrgProperty))
        : undefined;

      for (const orgAuth of orgAuthorizations) {
        try {
          const authFields: AuthFields = await getAuthFieldsFor(orgAuth.username);

          // Skip non-admin scratch org users
          if (authFields && 'scratchAdminUsername' in authFields) {
            continue;
          }

          // Skip scratch orgs parented by other (non-default) devHub orgs
          if (authFields && 'devHubUsername' in authFields && authFields.devHubUsername !== defaultDevHubUsername) {
            continue;
          }

          // Determine org type
          let orgType = 'Scratch';
          if (orgAuth.isDevHub) {
            orgType = 'DevHub';
          } else if (authFields && !authFields.expirationDate) {
            orgType = authFields.isSandbox ? 'Sandbox' : 'Org';
          }

          // Get aliases
          const aliases = await ConfigUtil.getAllAliasesFor(orgAuth.username);
          const alias = aliases?.length > 0 ? aliases[0] : '';

          // Determine status by actually testing the connection
          let status: string;
          if (authFields.expirationDate) {
            const expirationDate = new Date(authFields.expirationDate).getTime();
            if (expirationDate < now) {
              continue; // Skip expired orgs (they should have been removed)
            }
            status = 'Active'; // For scratch orgs, we assume they're active if not expired
          } else {
            // For non-scratch orgs, test the actual connection
            const connectedStatus = await determineConnectedStatusForNonScratchOrg(orgAuth.username);
            status = connectedStatus ?? 'Connected';
          }

          // Determine expiration date display
          let expires = '';
          if (authFields.expirationDate) {
            const expirationDate = new Date(authFields.expirationDate);
            expires = expirationDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
          }

          // Determine default org markers like the CLI does
          let marker = '';
          const possibleDefaults = [alias, orgAuth.username].filter(Boolean);

          // Check if this org is the default DevHub (by property value or resolved username)
          const matchesDevHubProperty =
            defaultDevHubProperty && possibleDefaults.includes(String(defaultDevHubProperty));
          const matchesDevHubUsername = defaultDevHubUsername && orgAuth.username === defaultDevHubUsername;
          const isDefaultDevHub = orgAuth.isDevHub && (matchesDevHubProperty ?? matchesDevHubUsername);

          // Check if this org is the default org (by property value or resolved username)
          const matchesOrgProperty = defaultOrgProperty && possibleDefaults.includes(String(defaultOrgProperty));
          const matchesOrgUsername = defaultOrgUsername && orgAuth.username === defaultOrgUsername;
          const isDefaultOrg = matchesOrgProperty ?? matchesOrgUsername;

          if (isDefaultDevHub && isDefaultOrg) {
            marker = '🌳,🍁';
          } else if (isDefaultDevHub) {
            marker = '🌳';
          } else if (isDefaultOrg) {
            marker = '🍁';
          }

          orgData.push({
            '': marker,
            Type: orgType,
            Alias: alias,
            Username: orgAuth.username,
            'Org Id': authFields.orgId ?? '',
            Status: status,
            Expires: expires
          });
        } catch {
          // Skip orgs that we can't process
          continue;
        }
      }

      if (orgData.length === 0) {
        channelService.appendLine(`\n${nls.localize('org_list_no_orgs_found')}`);
        return;
      }

      // Create and display the table
      const columns: Column[] = [
        { key: '', label: '' },
        { key: 'Type', label: 'Type' },
        { key: 'Alias', label: 'Alias' },
        { key: 'Username', label: 'Username' },
        { key: 'Org Id', label: 'Org Id' },
        { key: 'Status', label: 'Status' },
        { key: 'Expires', label: 'Expires' }
      ];

      const table = new Table();
      const tableOutput = table.createTable(orgData, columns, '');
      channelService.appendLine(`\n${tableOutput}`);

      // Add legend
      channelService.appendLine('\nLegend:  🌳=Default DevHub, 🍁=Default Org');
    } catch (error) {
      channelService.appendLine(
        `\n${nls.localize('org_list_display_error', error instanceof Error ? error.message : String(error))}`
      );
    }
  }
}

export const orgList = (): void => {
  const parameterGatherer = new PromptConfirmGatherer(nls.localize('parameter_gatherer_placeholder_org_list_clean'));
  const executor = new OrgListCleanExecutor();
  const commandlet = new SfCommandlet(new SfWorkspaceChecker(), parameterGatherer, executor);
  void commandlet.run();
};
