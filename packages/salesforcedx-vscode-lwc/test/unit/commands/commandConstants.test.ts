import { expect } from 'chai';
import {
  DEV_SERVER_BASE_URL,
  DEV_SERVER_PREVIEW_ROUTE
} from '../../../src/commands/commandConstants';

describe('force:lightning:lwc:start constants', () => {
  describe('base url', () => {
    it('should include localhost', async () => {
      expect(DEV_SERVER_BASE_URL).to.include('localhost');
    });
  });

  describe('preview route', () => {
    it('should include the base url', async () => {
      expect(DEV_SERVER_PREVIEW_ROUTE).to.include(DEV_SERVER_BASE_URL);
    });
  });
});
