import { LightningElement } from "lwc";

export default class LightningDatatableExample extends LightningElement{
    columns = [
        {label: 'Opportunity name', fieldName: 'opportunityName', type: 'text'},
        {label: 'Confidence', fieldName: 'confidence', type: 'percent'},
        {label: 'Amount', fieldName: 'amount', type: 'currency', typeAttributes: { currencyCode: 'EUR'}},
        {label: 'Contact Email', fieldName: 'contact', type: 'email'},
        {label: 'Contact Phone', fieldName: 'phone', type: 'phone'},
        {label: 'Date', fieldName: 'date', type: 'date'},
        {label: 'Website', fieldName: 'url', type: 'url'},
        {label: 'GPS Location', fieldName: 'location', type: 'location'},
        {label: 'Employees', fieldName: 'number', type: 'number'},
    ];

    data = [{
        id: 'a',
        opportunityName: 'Cloudhub',
        confidence: 0.2,
        amount: 25000,
        contact: 'jrogers@cloudhub.com',
        phone: '2352235235',
        date: "3-7-2015",
        url: "www.cloudhub.com",
        location: {latitude:37.793846, longitude: -122.394837},
        number: 4304
    },
    {
        id: 'b',
        opportunityName: 'Quip',
        confidence: 0.78,
        amount: 740000,
        contact: 'quipy@quip.com',
        phone: '2352235235',
        date:  "6-1-2017",
        url: "www.quip.com",
        location: {latitude:37.793846, longitude: -122.394837},
        number: 500
    }];
}
