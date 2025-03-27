import * as utilities from './utilities/index';
import { ProjectConfig } from './utilities/index';
export declare class TestSetup {
    testSuiteSuffixName: string;
    tempFolderPath: string;
    projectFolderPath: string | undefined;
    aliasAndUserNameWereVerified: boolean;
    scratchOrgAliasName: string | undefined;
    scratchOrgId: string | undefined;
    private constructor();
    get tempProjectName(): string;
    static setUp(testReqConfig: utilities.TestReqConfig): Promise<TestSetup>;
    tearDown(checkForUncaughtErrors?: boolean): Promise<void>;
    private initializeNewSfProject;
    setUpTestingWorkspace(projectConfig: ProjectConfig): Promise<void>;
    private throwError;
    updateScratchOrgDefWithEdition(scratchOrgEdition: utilities.OrgEdition): void;
    private setJavaHomeConfigEntry;
    private setWorkbenchHoverDelay;
}
