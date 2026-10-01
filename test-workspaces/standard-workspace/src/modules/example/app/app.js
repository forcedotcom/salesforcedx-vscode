import { LightningElement } from 'lwc';

export default class App extends LightningElement {
    state = {
        title: 'Example App',
        titleHover: 'title hover',
        pIfTrue: true,
        todos: [{text: 'todo-1'}, {text: 'todo-2'}, {text: 'todo-3'}],
        message: 'the message',
        name: 'John'
    };

    // state = 4;  // example type error if checkJs is enabled

    reverseMessage(event) {
        this.state.message = this.state.message.split('').reverse().join('');
    }

    get computedMessage() {
        return 'hello ' + this.state.name;
    }

    get lineStyle() {
        return 'color: green';
    }

    // lifecycle hooks

    constructor() {
        super();
        console.log('App.constructor');
    }

    connectedCallback() {
        console.log('App.connectedCallback');
    }

    disconnectedCallback() {
        console.log('App.disconnectedCallback');
    }
}