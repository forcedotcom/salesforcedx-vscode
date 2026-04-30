import { LightningElement } from 'lwc';
/** NoGetter doc */
export default class NoGetter extends LightningElement {
    _property = '';
    set property(value) {
        this._property = value;
    }
}
