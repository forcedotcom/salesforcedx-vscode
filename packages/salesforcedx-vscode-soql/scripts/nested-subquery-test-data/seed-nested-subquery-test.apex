/*
 * Seed data for nested-subquery + flatten/CSV limits (Account → Contacts → Cases).
 *
 * Run in the same Salesforce org you use for SOQL extension testing, e.g.:
 *   sf apex run --file packages/salesforcedx-vscode-soql/scripts/nested-subquery-test-data/seed-nested-subquery-test.apex -o <your-org-alias>
 *
 * Prefix VSE_NestedSub_ keeps records easy to find and delete.
 * Optional cleanup first: run cleanup-nested-subquery-test.apex
 */

String prefix = 'VSE_NestedSub_';
String rootName = prefix + 'Root';

// Remove prior seed (children first)
for (Account a : [SELECT Id, (SELECT Id FROM Contacts) FROM Account WHERE Name = :rootName]) {
  List<Id> contactIds = new List<Id>();
  for (Contact c : a.Contacts) {
    contactIds.add(c.Id);
  }
  if (!contactIds.isEmpty()) {
    delete [SELECT Id FROM Case WHERE ContactId IN :contactIds];
  }
  delete [SELECT Id FROM Opportunity WHERE AccountId = :a.Id];
  delete a.Contacts;
  delete a;
}

Account root = new Account(Name = prefix + 'Root');
insert root;

List<Contact> contacts =
  new List<Contact>{
    new Contact(AccountId = root.Id, FirstName = 'Alpha', LastName = 'TwoCases'),
    new Contact(AccountId = root.Id, FirstName = 'Beta', LastName = 'NoCases'),
    new Contact(AccountId = root.Id, FirstName = 'Gamma', LastName = 'OneCase'),
    new Contact(AccountId = root.Id, FirstName = 'Delta', LastName = 'ThreeCases')
  };
insert contacts;

// Two cases on first contact, one on third, three on fourth — exercises inner subquery sizes
List<Case> cases = new List<Case>();
cases.add(
  new Case(
    AccountId = root.Id,
    ContactId = contacts[0].Id,
    Subject = prefix + 'Case_A1',
    Status = 'New',
    Origin = 'Web'
  )
);
cases.add(
  new Case(
    AccountId = root.Id,
    ContactId = contacts[0].Id,
    Subject = prefix + 'Case_A2',
    Status = 'New',
    Origin = 'Web'
  )
);
cases.add(
  new Case(
    AccountId = root.Id,
    ContactId = contacts[2].Id,
    Subject = prefix + 'Case_C1',
    Status = 'New',
    Origin = 'Web'
  )
);
cases.add(
  new Case(
    AccountId = root.Id,
    ContactId = contacts[3].Id,
    Subject = prefix + 'Case_D1',
    Status = 'New',
    Origin = 'Web'
  )
);
cases.add(
  new Case(
    AccountId = root.Id,
    ContactId = contacts[3].Id,
    Subject = prefix + 'Case_D2',
    Status = 'New',
    Origin = 'Web'
  )
);
cases.add(
  new Case(
    AccountId = root.Id,
    ContactId = contacts[3].Id,
    Subject = prefix + 'Case_D3',
    Status = 'New',
    Origin = 'Web'
  )
);
insert cases;

// Second top-level subquery on Account (stacks with Contacts in the grid/CSV row model)
List<Opportunity> opps =
  new List<Opportunity>{
    new Opportunity(
      Name = prefix + 'Opp_One',
      AccountId = root.Id,
      StageName = 'Prospecting',
      CloseDate = Date.today().addDays(30)
    ),
    new Opportunity(
      Name = prefix + 'Opp_Two',
      AccountId = root.Id,
      StageName = 'Prospecting',
      CloseDate = Date.today().addDays(31)
    )
  };
insert opps;

System.debug('Nested subquery seed OK: Account ' + root.Id);
