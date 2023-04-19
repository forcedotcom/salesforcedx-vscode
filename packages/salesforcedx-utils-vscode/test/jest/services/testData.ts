export const testData = {
  statusOutputRows: [
    {
      type: 'ApexClass',
      origin: 'local',
      state: 'add',
      fullName: 'ChangePasswordController',
      ignored: true,
      filepath: 'force-app/main/default/classes/ChangePasswordController.cls',
      conflict: false
    },
    {
      type: 'ApexClass',
      origin: 'local',
      state: 'add',
      fullName: 'ChangePasswordController',
      ignored: true,
      filePath:
        'force-app/main/default/classes/ChangePasswordController.cls-meta.xml',
      conflict: false
    },
    {
      type: 'Profile',
      origin: 'remote',
      state: 'add',
      fullName: 'Admin',
      conflict: false
    },
    {
      type: 'Audience',
      origin: 'remote',
      state: 'add',
      fullName: 'Default',
      conflict: false
    }
  ],
  statusSummaryString:
    'IGNORED  STATE       FULL NAME                 TYPE       PROJECT PATH                                                        \n───────  ──────────  ────────────────────────  ─────────  ────────────────────────────────────────────────────────────────────\ntrue     Local Add   ChangePasswordController  ApexClass                                                                      \ntrue     Local Add   ChangePasswordController  ApexClass  force-app/main/default/classes/ChangePasswordController.cls-meta.xml\n         Remote Add  Default                   Audience                                                                       \n         Remote Add  Admin                     Profile                                                                        \n'
};
