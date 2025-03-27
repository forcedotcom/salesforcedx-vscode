import { ExtensionId } from './extensionUtils';
export type OrgEdition = 'developer' | 'enterprise';
export type SfCommandRunResults = {
    stdout: string;
    stderr: string;
    exitCode: number;
};
export declare enum ProjectShapeOption {
    NONE = 0,
    ANY = 1,
    NEW = 2,
    NAMED = 3
}
export type ProjectConfig = {
    projectShape: ProjectShapeOption;
    folderPath?: string;
    githubRepoUrl?: string;
};
export type TestReqConfig = {
    projectConfig: ProjectConfig;
    isOrgRequired: boolean;
    scratchOrgEdition?: OrgEdition;
    excludedExtensions?: ExtensionId[];
    testSuiteSuffixName: string;
};
