# Retrieve Puzzle

when I retrieve, I get an error saying Error: Not a Salesforce project: InvalidProjectWorkspaceError: memfs:/MyProject does not contain a valid Salesforce DX project.

To solve, we probably need to know what's in the filesystem at the time and to make sure it's using the same memfs instance/volume/etc so that it sees the files in our project.

## browser test

You can run the test via `npm run test:web -w salesforcedx-vscode-org-browser -- --grep="should retrieve metadata and check for project error"` (executed from the top of the salesforcedx-vscode project).

## Error text

Error:
notificationsAlerts.ts:42 Retrieve failed: Retrieve failed: Error: Not a Salesforce project: InvalidProjectWorkspaceError: memfs:/MyProject does not contain a valid Salesforce DX project.
c @ notificationsAlerts.ts:42
(anonymous) @ notificationsAlerts.ts:28
C @ event.ts:1219
D @ event.ts:1230
fire @ event.ts:1254
addNotification @ notifications.ts:228
notify @ notificationService.ts:234
(anonymous) @ mainThreadMessageService.ts:93
g @ mainThreadMessageService.ts:56
$showMessage @ mainThreadMessageService.ts:50
S @ rpcProtocol.ts:458
Q @ rpcProtocol.ts:443
M @ rpcProtocol.ts:373
L @ rpcProtocol.ts:299
(anonymous) @ rpcProtocol.ts:161
C @ event.ts:1219
fire @ event.ts:1250
D.o.onmessage @ webWorkerExtensionHost.ts:230
