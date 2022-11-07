---
title: Quick Start Apex Development
lang: en
---
  
## Overview
Complete this Quick Start to create, test and debug a workflow that is created using an Apex class, and sets off a Apex trigger.

You’ll create a custom object called `Book`, and add a custom field called `Price` to that custom object. You’ll update and test the updated Price field using Apex and learn how to work with Apex Code using the Salesforce Extensions.


Before you start, install [Salesforce Extensions for Desktop](./en/../../vscode-desktop/install.md) or [Set Up Code Builder](./en/../../codebuilder/cb-setup.md)


### Create a Custom Object
1. Log in to your Sandbox or Developer org.
2. Go to **Setup** > **Object Manager** > **Create** > **Custom Object**.
3. Enter `Book` for the label.
4. Enter `Books` for the plural label.
5. Click **Save.**
6. In the **Custom Fields & Relationships** section of the Book detail page, click **New**.
7. Select `Number` for the data type and click **Next**.
8. Enter `Price` for the field label.
9. Enter `16` in the length text box.
10. Enter `2` in the decimal places text box, and click **Next**.
11. Click **Next** to accept the default values for field-level security.
12. Click **Save**.

### Add an Apex Class
1. In VS Code, connect to the org that you added the custom object to using [Org Picker or Command Palette](../user-guide/default-org.md).
2. Run the **SFDX: Refresh SObject Definitions** command from the Command Palette to get code completion suggestions for your SObjects related code.
3. Click the Cloud icon in the Activity Bar to open the Org Browser.
4. Scroll down to Custom Object and locate the `Book_c` object. Click the retrieve icon to run **SFDX: Retrieve Source from Org**.
5. From the Command Palette run **SFDX:Create Apex Class** and create a class called `MyBooks`. 
6. Add a method called `applyDiscount` to this class. 
   
Make this method both public and static. Because it’s a static method, you don't need to create an instance of the class to access the method — you can just use the name of the class followed by a dot (.) and the name of the method.

This method takes one parameter, a list of Book records, which is assigned to the variable books. The method iterates through a list of books and applies a 10% discount to the current book price:

```
public with sharing class MyBooks {
    public MyBooks() {

    }
    public static void applyDiscount(Book__c[] books) {
        for (Book__c b : books){
           b.Price__c *= 0.9;
        }
     }
}
```
Next add a trigger that calls this `applyDiscount` method. 

### Add an Apex Trigger
An Apex trigger is a piece of code that executes before or after records of a particular type are inserted, updated, or deleted from the database. Every trigger runs with a set of context variables that provide access to the records that caused the trigger to fire.
1. From the Command Palette, run **SFDX: Create Apex Trigger** and create a new class called `MyBooksTrigger`. 
2. Update the default template to this trigger definition:

```
trigger MyBooksTrigger on Book__c (before insert) {

   Book__c[] books = Trigger.new;

   MyBooks.applyDiscount(books);
}
```

We now have the code that is needed to update the price of all books that get inserted. Next, let’s add a test class and add a unit test. Unit tests are an important part of writing code and are required. In addition to ensuring the quality of your code, unit tests enable you to meet the code coverage requirements for deploying or packaging Apex. To deploy Apex or package it for the Salesforce AppExchange, unit tests must cover at least 75% of your Apex code, and those tests must pass.

### Write a Unit Test
Now add a test class with one test method. Then run the test and verify code coverage. The test method exercises and validates the code in the trigger and class. Also, it enables you to reach 100% code coverage for the trigger and class.
For our example, create a test class that inserts a new book object which sets off the Apex trigger we wrote earlier. 
To create the test class:

1. From the Command Palette, run **SFDX:Create Apex Class** and create a class called `MyBooksTestClass`. 
2. Paste the following code in the `MyBooksTestClass.cls` file:

```
@isTest 
private class MyBooksTestClass {
    static testMethod void validateMyBooks() {
       Book__c b = new Book__c(Name='Behind the Cloud', Price__c=100);
       // Insert book
       insert b;    
       // Retrieve the new book
       Book b2 = [SELECT Price__c FROM Book__c WHERE Id =:b.Id];
      //Confirm that the price has been updated correctly
       System.assertEquals(90, b2.Price__c);
      }
}
```
**Note:** This test class is defined using the `@isTest` annotation. We recommend that classes defined this way only contain test methods and any methods required to support those test methods. One advantage to creating a separate class for testing is that classes defined with `@isTest` don’t count against your org’s limit of 6 MB of Apex code. You can also add the `@isTest` annotation to individual methods. For more information, see [isTest Annotation](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_isTest.htm) and [Execution Governors and Limits](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_gov_limits.htm).

3. To run the test you wrote, you must deploy your code to your org. Right-click within the file and run **SFDX: Deploy This Source to Org** to deploy your code. 
4.  Click **Run All Tests** in the `MyBooksTestClass` file to test your code.
