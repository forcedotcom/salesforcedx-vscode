export declare const WORKSPACE_SETTING_KEYS: {
    ENABLE_SOURCE_TRACKING_FOR_DEPLOY_AND_RETRIEVE: string;
    PUSH_OR_DEPLOY_ON_SAVE_ENABLED: string;
    PUSH_OR_DEPLOY_ON_SAVE_PREFER_DEPLOY_ON_SAVE: string;
};
export declare const LOG_LEVELS: readonly ["trace", "debug", "info", "warn", "error", "silent"];
export type LogLevel = (typeof LOG_LEVELS)[number];
