import { expect } from 'chai';
import { ForceOrgListExecutor } from '../../../src/commands/forceOrgList';
import { nls } from '../../../src/messages';

describe('Force Org List', () => {
  it('Should build the list command with --clean option', async () => {
    const forceOrgList = new ForceOrgListExecutor();
    const listCommand = forceOrgList.build({});
    expect(listCommand.toCommand()).to.equal(
      'sfdx force:org:list --clean --noprompt'
    );
    expect(listCommand.description).to.equal(
      nls.localize('force_org_list_clean_text')
    );
  });
});
