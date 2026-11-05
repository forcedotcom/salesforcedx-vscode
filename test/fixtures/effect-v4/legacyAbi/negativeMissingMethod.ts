import type { FullLegacyServicesApi } from '../bridgeHost/legacyClasses.js';
type Body = ConstructorParameters<FullLegacyServicesApi['services']['ConnectionService']>[0];
declare const incomplete: Omit<Body, 'getConnectionForOrg'>;
const checked: Body = incomplete;
void checked;
