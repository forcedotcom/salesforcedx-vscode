import { expect } from 'chai';
import {
  lwcDevServerBaseUrl,
  lwcDevServerPreviewRoute
} from '../../../src/commands/commandConstants';

describe('force:lightning:lwc:start constants', () => {
  describe('base url', () => {
    it('should include localhost', async () => {
      expect(lwcDevServerBaseUrl).to.include('localhost');
    });
  });

  describe('preview route', () => {
    it('should include the base url', async () => {
      expect(lwcDevServerPreviewRoute).to.include(lwcDevServerBaseUrl);
    });
  });
});
