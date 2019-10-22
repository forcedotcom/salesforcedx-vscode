import { lwcTestIndexer } from '../testIndexer';

export function forceLwcTestRefreshTestExplorer() {
  lwcTestIndexer.resetIndex();
}
