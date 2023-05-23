import { SfdxCoreSettings } from './sfdxCoreSettings';

let sfdxCoreSettingsInst: SfdxCoreSettings;
export const getSfdxCoreSettings = () => {
  if (!sfdxCoreSettingsInst) {
    sfdxCoreSettingsInst = SfdxCoreSettings.getInstance();
  }
  return sfdxCoreSettingsInst;
};

export * from './sfdxSettingsService';
export * from './sfdxCoreSettings';
