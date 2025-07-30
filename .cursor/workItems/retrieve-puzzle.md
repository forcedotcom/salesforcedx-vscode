# Retrieve Puzzle

when I retrieve, I get an error saying Error: Not a Salesforce project: InvalidProjectWorkspaceError: memfs:/MyProject does not contain a valid Salesforce DX project.

# test enhancement

You can run the test via npm run test:web -w salesforcedx-vscode-org-browser (executed from the top of the salesforcedx-vscode project).

1. let's add a step to our orgBrowser test that will do a retrieve of a piece of metadata. a CustomObject is fine since we're already opening that.
   The test should assert that the file opens when we retrieve it.

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
