/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable */
import AccountObj from '@salesforce/schema/Account';
import { NavigationMixin } from 'lightning/navigation';
import { LightningElement, api } from 'lwc';

export default class NavMetadata extends NavigationMixin(LightningElement) {
    @api account;

    handleAccountClick() {
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: this.account.Id,
                objectApiName: AccountObj.objectApiName,
                actionName: 'view',
            },
        });
    }
}
