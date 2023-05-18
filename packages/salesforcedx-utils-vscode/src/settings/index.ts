import { SfdxCoreSettings } from './sfdxCoreSettings';

export * from './sfdxSettingsService';
export * from './sfdxCoreSettings';

export const sfdxCoreSettings = SfdxCoreSettings.getInstance();
