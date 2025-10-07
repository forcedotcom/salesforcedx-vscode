import { LightningElement, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import AccountObj from '@salesforce/schema/Account';

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
