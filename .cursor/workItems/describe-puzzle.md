# Describe Error Puzzle

Keep track, at the end of this file, of what has worked and not worked so we don't repeat steps.

We are successfully authed, and the orgBrowser is trying to use the metadata describe call.

You can run the test via npm run test:web -w salesforcedx-vscode-org-browser (executed from the top of the salesforcedx-vscode project).

The describeService returns this error
`Error: Describe failed: soapenv:Client: Content is not allowed in prolog.`

full stack trace

notificationsAlerts.ts:40 (FiberFailure) Error: Describe failed: soapenv:Client: Content is not allowed in prolog.
c @ notificationsAlerts.ts:40
(anonymous) @ notificationsAlerts.ts:28
C @ event.ts:1219
D @ event.ts:1230
fire @ event.ts:1254
addNotification @ notifications.ts:228
error @ notificationService.ts:189
(anonymous) @ mainThreadTreeViews.ts:292
Promise.then
then @ lazyPromise.ts:83
getChildrenBatch @ mainThreadTreeViews.ts:283
rze @ treeView.ts:1175
getChildrenBatch @ treeView.ts:411
rze @ treeView.ts:1175
(anonymous) @ treeView.ts:1216
setTimeout
e.setTimeout @ window.ts:120
(anonymous) @ treeView.ts:1212
getChildren @ treeView.ts:1211
I @ asyncDataTree.ts:1170
H @ asyncDataTree.ts:1128
(anonymous) @ asyncDataTree.ts:1103
yn @ async.ts:37
G @ asyncDataTree.ts:1102
F @ asyncDataTree.ts:1098
E @ asyncDataTree.ts:1068
C @ asyncDataTree.ts:813
updateChildren @ asyncDataTree.ts:791
(anonymous) @ treeView.ts:1096
Tb @ treeView.ts:1096
refresh @ treeView.ts:1026
set dataProvider @ treeView.ts:435
(anonymous) @ mainThreadTreeViews.ts:62
Promise.then
$registerTreeViewDataProvider @ mainThreadTreeViews.ts:45
S @ rpcProtocol.ts:458
Q @ rpcProtocol.ts:443
M @ rpcProtocol.ts:373
L @ rpcProtocol.ts:299
(anonymous) @ rpcProtocol.ts:161
C @ event.ts:1219
fire @ event.ts:1250
D.o.onmessage @ webWorkerExtensionHost.ts:230
