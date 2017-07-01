import { expect } from 'chai';

import { DEFAULT_SFDX_CHANNEL } from '../../src/channels';

describe('Channel tests', () => {
  describe('Default SFDX channel', () => {
    it('Should have proper name', () => {
      expect(DEFAULT_SFDX_CHANNEL.name).to.equal('SalesforceDX CLI');
    });
  });
});
