---
title: Apex Tasks
lang: en
---

This repository contains sample Apex tasks that you can complete in Code Builder or VS Code Extensions for desktop. We constantly add to this list, so make sure you visit this topic often. 


## Use Anonymous Apex to Mass Update Account Ratings

Say you have accounts with `Rating` set to `Cold` because of unfavorable business conditions. You now want to make mass updates to these accounts and change their rating to `Warm`.  You want to limit this update to mid-sized accounts with more than a certain amount of revenue. 

This anonymous Apex code updates ratings of accounts that have an annual revenue greater than `$10,000,000` and have more than `1000` employees:


1. In the `scripts/apex` folder create a new Anonymous Apex file using the `.apex` file extension.
Paste the code into the file:

      ```
      List<Account> acctList =[SELECT Name, Rating FROM Account
        WHERE AnnualRevenue > 500000 AND NumberOfEmployees > 100];
      for (Account acc: acctList){
          if (acc.Rating == 'Cold') {
              acc.Rating = 'Warm'; 
              update acc;
          }
              System.debug(acc.Name + acc.Rating);
      }
      ```

2. Click **Execute Anonymous Apex** to execute your code.

The `DEBUG CONSOLE` lists accounts and their updated ratings. 

## Resources

- [Introducing Apex Recipes](https://developer.salesforce.com/blogs/2020/10/introducing-apex-recipes)
