---
title: Example Prompts and Responses
lang: en
---

## Example Prompts and Responses

Prompt writing is key to quality code generation. Here’s some tips for improved prompt writing and a selection of sample prompts to start you on your generative AI code assistance journey.

| <b>Original Prompt                                      | Improved Prompt</b>                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Write Apex code that sorts the list of contacts.        | Write Apex code that sorts the list of contacts alphabetically by last name.   |
| Write a method that adds two numbers.                   | Write a method that adds two numbers and returns the result.                   |
| Write an apex method that returns fields for an object. | Write an apex method that accepts an SObject and returns a list of its fields. |

<br>

**Prompt:** Write an apex method that accepts a List of sObjects and a field name and returns a Set of non null field values.

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

**Prompt:** Write an apex method that accepts product name as input and retrieves orderitems filtered on product name.

**Response**:

```
public List<OrderItem> getOrderItemsByProductName(String productName) {
List<OrderItem> orderItems = [SELECT Description FROM OrderItem WHERE ProductCode = :productName LIMIT 50];
return orderItems;
}

```

**Prompt:** Write an Apex trigger to add the number of contacts associated with an account.

```
trigger gptcontacttrigger on Account (after insert, after update) {
    List<Contact> listContacts = new List<Contact>();

    for (Account acc : Trigger.new) {
        List<Contact> listaccContacts = [SELECT Id, Name, AccountId FROM Contact WHERE AccountId = :acc.Id];
        if (acc.Contacts.size() < listaccContacts.size()) {
            acc.addError('Not enough contacts');
        }

    }
}
```

## Edit a Prompt and Regenerate Output

A well designed prompt is key to getting a good response from Einstein. We encourage you to modify your prompts until you get Apex code that helps you complete your task at hand. For example, the prompt, "_Write code to provide the ability to update the FirstName for a list of users_" generates the following response:

<pre>
public with sharing class AccountService {
  public Account createAccount( String accountName, String accountNumber, String tickerSymbol ) {
    Account newAcct = new Account(
      Name = accountName,
      AccountNumber = accountNumber,
      TickerSymbol = accountNumber
    );
    return newAcct;
  }    

<b>
// Function to update the FirstName for a list of users
public static List<User> updateFirstName(List<User> users, String newFirstName) {
        for (User u : users) {
            if (String.isNotBlank(u.FirstName)) {
                u.FirstName = newFirstName;
            }
        }
        return users;
 }
<b>
</pre>

This response is good, but you can make an edit to generate reusable code by creating a method.

Click **Retry** and edit the prompt for a more specific output. Update the prompt to say, "_Write code to provide the ability to update the FirstName for a list of users as a method_". The new response is –

<pre>
public with sharing class AccountService {
  public Account createAccount( String accountName, String accountNumber, String tickerSymbol ) {
    Account newAcct = new Account(
      Name = accountName,
      AccountNumber = accountNumber,
      TickerSymbol = accountNumber
    );
    return newAcct;
  }

<b>
    //This is a method that allows updating the FirstName for a list of users
    public static void updateFirstName(List<User> users) {
        for (User usr : users) {
            if (usr.FirstName != null) {
                usr.FirstName = 'New First Name';
            }
        }
    }
<b>
</pre>

Click **Accept** if you like this output or **Retry** again to update your prompt and regenerate a new output.

## Generated Code Quality Feedback

As with all LLM-based products, the technology behind this product is still new. The generated output will often require editing to be customized for your individual project and responses may not be optimal. We'd love to hear feedback from you on the generated output through the History & Feedback Panel in the IDE - your feedback will be critical to the continuous training of our large language model (LLM) during the beta program.

We strongly encourage you to let us know when you see examples of less optimal code, so that we can continue to improve generated responses. Please use tools such as [Apex PMD](https://marketplace.visualstudio.com/items?itemName=chuckjonas.apex-pmd) (already in your Salesforce Extension Pack) and [Salesforce Code Analyzer](https://forcedotcom.github.io/sfdx-scanner/) to ensure the quality of your generated code.
