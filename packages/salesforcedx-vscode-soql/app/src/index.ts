// @ts-ignore
import { createElement } from 'lwc';
// @ts-ignore
import App from 'qb/app';

const app = createElement('qb-app', { is: App });
// @ts-ignore
document.querySelector('#main').appendChild(app);
