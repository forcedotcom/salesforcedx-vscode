export declare function gitClone(url: string, targetPath: string): Promise<void>;
export declare function gitCheckout(branch: string, targetPath?: string): Promise<void>;
export declare function gitRepoExists(url: string): Promise<boolean>;
export declare function getRepoNameFromUrl(repoUrl: string): string | null;
