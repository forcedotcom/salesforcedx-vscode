/*
 * Delete VSE_NestedSub_* seed data (Account VSE_NestedSub_Root and related Contacts/Cases).
 *
 *   sf apex run --file .../cleanup-nested-subquery-test.apex -o <your-org-alias>
 */

String prefix = 'VSE_NestedSub_';
String rootName = prefix + 'Root';

List<Account> roots = [SELECT Id, (SELECT Id FROM Contacts) FROM Account WHERE Name = :rootName];
for (Account a : roots) {
  List<Id> contactIds = new List<Id>();
  for (Contact c : a.Contacts) {
    contactIds.add(c.Id);
  }
  if (!contactIds.isEmpty()) {
    delete [SELECT Id FROM Case WHERE ContactId IN :contactIds];
  }
  delete [SELECT Id FROM Opportunity WHERE AccountId = :a.Id];
  delete a.Contacts;
}
delete roots;

System.debug('Cleanup complete for ' + prefix + 'Root');
