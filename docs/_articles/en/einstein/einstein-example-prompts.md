---
title: Example Prompts and Responses
lang: en
---

## Generated Code Quality

As with all LLM-based products, the technology behind Einstein for Developers is still new. The generated output often requires editing to be customized for your individual project. Some responses aren't optimal. We'd love to hear feedback from you on the generated output through the History & Feedback Panel in the IDE. Your feedback is critical to the continuous training of our large language model (LLM) during the beta program.

We strongly encourage you to let us know when you see examples of less optimal code, so that we can continue to improve generated responses. We recommend tools such as [Apex PMD](https://marketplace.visualstudio.com/items?itemName=chuckjonas.apex-pmd) (already in your Salesforce Extension Pack) and [Salesforce Code Analyzer](https://forcedotcom.github.io/sfdx-scanner/) to ensure the quality of your generated code.

## Prompt Writing Tips

Prompt writing is key to quality code generation. Here are some tips for improved prompt writing and a selection of sample prompts to start you on your generative AI code-assistance journey.

| Original Prompt                                         | Improved Prompt                                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Write Apex code that sorts the list of contacts.        | Write Apex code that sorts the list of contacts alphabetically by last name.   |
| Write a method that adds two numbers.                   | Write a method that adds two numbers and returns the result.                   |
| Write an Apex method that returns fields for an object. | Write an Apex method that accepts an SObject and returns a list of its fields. |

## Example Prompts and Responses

**Prompt:** Write an Apex method that accepts a list of sobjects and a field name and returns a set of non null field values.

**Response:**

```
public Set<String> getFieldValues(List<sObject> records, String fieldName) {
        Set<String> fieldValues = new Set<String>();

        for (sObject record : records) {
            try {
                Object fieldValue = record.get(fieldName);
                if (fieldValue != null) {
                    fieldValues.add((String) fieldValue);
                }
            } catch (Exception e) {
                system.debug('Error: ' + e.getMessage());
            }
        }
        return fieldValues;
    }


```

**Prompt:** Create an @invocable method that serializes an input list of sObjects and returns JSON.

**Response:**

```
@InvocableMethod(label='Create Account' description='Creates a new account with the specified name, number and symbol.' category='Account')
    public static List<String> createAccounts(List<Account> accounts) {
        List<String> response = new List<String>();

        for (Account account : accounts) {
            String jsonAccount = JSON.serialize(account);
            response.add(jsonAccount);
        }

        return response;
    }

```

**Prompt:** Write an Apex method that accepts product name as input and retrieves orderitems filtered on product name.

**Response**:

```
public List<OrderItem> getOrderItemsByProductName(String productName) {
List<OrderItem> orderItems = [SELECT Description FROM OrderItem WHERE ProductCode = :productName LIMIT 50];
return orderItems;
}

```

**Prompt:** Write an Apex trigger to add the number of contacts associated with an account. In the SOQL query ensure it is secure by adding WITH USER_MODE.

```
trigger AccountTrigger on Account (after update) {
    List<Account> accountsWithContacts = [
        SELECT Id, (SELECT Id FROM Contacts)
        FROM Account
        WHERE Id IN :Trigger.newMap.keySet()
        WITH USER_MODE
    ];
    
    for (Account account : accountsWithContacts) {
        Integer numberOfContacts = account.Contacts.size();
        
        // Update the Account's "Number_of_Contacts__c" field
        account.Number_of_Contacts__c = numberOfContacts;
    }
    
    update accountsWithContacts;
}
```

## Edit a Prompt and Regenerate Output

A well designed prompt is key to getting a good response from Einstein. We encourage you to modify your prompts until you get Apex code that helps you complete your task at hand. When you use the `Einstein: Generate Code` command from the command palette, use the **Retry** and **Accept** options. In the sidebar, edit the prompt and click **Ask**.

For example, the prompt, "Write code to provide the ability to update the FirstName for a list of users" generates this response.

```
public with sharing class AccountService {
  public Account createAccount( String accountName, String accountNumber, String tickerSymbol ) {
    Account newAcct = new Account(
      Name = accountName,
      AccountNumber = accountNumber,
      TickerSymbol = accountNumber
    );
    return newAcct;
  }
// Function to update the FirstName for a list of users
public static List<User> updateFirstName(List<User> users, String newFirstName) {
        for (User u : users) {
            if (String.isNotBlank(u.FirstName)) {
                u.FirstName = newFirstName;
            }
        }
        return users;
 }
```

This response is good, but you can edit the prompt to generate reusable code by creating a method.

Click **Retry** and edit the prompt for more specific output. Update the prompt to say, "Write code to provide the ability to update the FirstName for a list of users as a method". This is the new response.

```
public with sharing class AccountService {
  public Account createAccount( String accountName, String accountNumber, String tickerSymbol ) {
    Account newAcct = new Account(
      Name = accountName,
      AccountNumber = accountNumber,
      TickerSymbol = accountNumber
    );
    return newAcct;
  }
}

 //This is a method that allows updating the FirstName for a list of users
    public static void updateFirstName(List<User> users) {
        for (User usr : users) {
            if (usr.FirstName != null) {
                usr.FirstName = 'New First Name';
            }
        }
    }
```

If you like this output, click **Accept**. To update your prompt and regenerate new output, click **Retry**. 
