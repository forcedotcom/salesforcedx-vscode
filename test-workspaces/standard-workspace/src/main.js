import { createElement } from 'lwc';
import App from 'example-app';

const container = document.getElementById('main');
const element = createElement('example-app', { is: App });
container.appendChild(element);
