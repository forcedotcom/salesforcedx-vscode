import { ConfigUtil } from '@salesforce/salesforcedx-utils-vscode/src';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import { WorkspaceContext } from '../../context/workspaceContext';

export async function setApiVersionOn(components: ComponentSet) {
  // Check the SFDX configuration to see if there is an overridden api version.
  // Project level local sfdx-config takes precedence over global sfdx-config at system level.
  const userConfiguredApiVersion:
    | string
    | undefined = await ConfigUtil.getUserConfiguredApiVersion();

  if (userConfiguredApiVersion) {
    components.apiVersion = userConfiguredApiVersion;
    return;
  }

  // If no user-configured Api Version is present, then get the version from the Org.
  const orgApiVersion = await getOrgApiVersion();
  components.apiVersion = orgApiVersion ?? components.apiVersion;
}

async function getOrgApiVersion(): Promise<string | undefined> {
  const connection = await WorkspaceContext.getInstance().getConnection();
  const apiVersion = connection.getApiVersion();
  return apiVersion ? String(apiVersion) : undefined;
}
