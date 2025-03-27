import * as utilities from './index';
import { TestSetup } from '../testSetup';
export declare function setUpScratchOrg(testSetup: TestSetup, scratchOrgEdition: utilities.OrgEdition): Promise<void>;
export declare function authorizeDevHub(testSetup: TestSetup): Promise<void>;
export declare function deleteScratchOrgInfo(testSetup: TestSetup): Promise<void>;
