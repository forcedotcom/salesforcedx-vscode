import { LightningElement, api, track, wire } from 'lwc';
import { fancyAdapterId, otherAdapterId } from 'local/foobar';
import myInitialValue from './relative/thing';

import apexMethodName from '@salesforce/apex/Namespace.Classname.apexMethodReference';

/** Foo doc */
export default class Foo extends LightningElement {
    _privateTodo;
    @api get todo () {
        return this._privateTodo;
    }
    set todo (val) {
        return this._privateTodo = val;
    }
    @api
    index;

    @api initializedAsApiNumber = 5;
    @track initializedAsTrackNumber = 5;

    @api indexSameLine;

    @api initializedWithImportedVal = myInitialValue;

    @api arrOfStuff = [1, 'a', false, undefined, null];

    @track
    trackedPrivateIndex;

    @api stringVal = 'foobar';
    @track trackedThing = 'withInitialValue';

    @track trackedArr = ['foo', 1, undefined, null];

    @api callback = () => {};

    @api fooNull = null;

    onclickAction() {
    }

    @api superComplex = {
        some: 'value',
        someOther: ['deep', 1, { value: 'here' }],
        andThen: null,
    };

    @api apiMethod() {
    }

    @wire(fancyAdapterId, { bar: 'baz', blip: 111 }) wiredProperty;
    @wire(fancyAdapterId, { bar: 'baz', blip: [111] }) wiredPropertyWithNestedParam;
    @wire(fancyAdapterId, { bar: 'baz', blip: { foo: 'bar' } }) wiredPropertyWithNestedObjParam;

    @wire(otherAdapterId, { foo: 'bar' })
    myWiredMethod(data) {
        // do something with data
    }

    @wire(apexMethodName, { searchKey: '$searchKey' }) apexWiredProperty;

    @wire(apexMethodName, { searchKey: '$searchKey' }) apexWiredInitVal = 5;

    @wire(apexMethodName, { searchKey: '$searchKey' }) apexWiredInitArr = [
        'hello',
        'world',
        12345,
        undefined,
        null,
        ['foo', 'bar'],
    ];

    get privateComputedValue() {
        return null;
    }

    methodWithArguments(a, b) {
    }
}

export { Foo };

export * from './something';
