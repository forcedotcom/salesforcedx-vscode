import { LightningElement, api } from 'lwc';

export default class Line extends LightningElement {
    @api hover;

    internalText;

    set text(value) {
        this.internalText = value;
    }

    @api get text() {
        return this.internalText;
    }

    @api focus() {
        this.root.querySelector('p').focus();
    }
}