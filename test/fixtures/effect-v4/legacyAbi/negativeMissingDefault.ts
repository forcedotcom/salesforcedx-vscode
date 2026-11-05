import type { FullLegacyServicesApi } from '../bridgeHost/legacyClasses.js';
type Constructor = FullLegacyServicesApi['services']['ConnectionService'];
type Incomplete = Omit<Constructor, 'DefaultWithoutDependencies'> &
  (new (...args: ConstructorParameters<Constructor>) => InstanceType<Constructor>);
declare const incomplete: Incomplete;
const checked: Constructor = incomplete;
void checked;
