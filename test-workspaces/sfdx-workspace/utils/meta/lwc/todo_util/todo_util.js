import { LightningElement, api, track } from 'lwc';

export default class TodoUtil extends LightningElement {
    @api
    info;

    @api
    iconName;

    @api
    upperCASE

    @track
    trackProperty;

    privateProperty;

    privateMethod() {
        return 'privateMethod';
    }
}