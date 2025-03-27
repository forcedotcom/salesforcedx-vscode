export declare function inWorkspaceSettings<T>(): Promise<void>;
export declare function inUserSettings<T>(): Promise<void>;
export declare function enableBooleanSetting(id: string, settingsType?: 'user' | 'workspace'): Promise<boolean>;
export declare function disableBooleanSetting(id: string, settingsType?: 'user' | 'workspace'): Promise<boolean>;
export declare function isBooleanSettingEnabled(id: string, settingsType?: 'user' | 'workspace'): Promise<boolean>;
