(function (engine,App) {
'use strict';

App = App && App.hasOwnProperty('default') ? App['default'] : App;

const container = document.getElementById('main');
const element = engine.createElement('example-app', { is: App });
container.appendChild(element);

}(Engine,App));
