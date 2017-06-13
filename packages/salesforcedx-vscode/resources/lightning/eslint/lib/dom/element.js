/*
 * Copyright (C) 2016 salesforce.com, inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

 "use strict";

module.exports = {
    // Standard Global Event handlers
    // https://developer.mozilla.org/en-US/docs/Web/API/GlobalEventHandlers
    onabort: true,
    onblur: true,
    onchange: true,
    onclick: true,
    onclose: true,
    oncontextmenu: true,
    ondblclick: true,
    onerror: true,
    onfocus: true,
    oninput: true,
    onkeydown: true,
    onkeypress: true,
    onkeyup: true,
    onload: true,
    onmousedown: true,
    onmousemove: true,
    onmouseout: true,
    onmouseover: true,
    onmouseup: true,
    onreset: true,
    onresize: true,
    onscroll: true,
    onselect: true,
    onsubmit: true,

    // Standard Element interface represents an object of a Document.
	// https://developer.mozilla.org/en-US/docs/Web/API/Element#Properties
	childElementCount: '*',
    classList: '*',
    className: '*',
    id: '*',
    tagName: '*',
    namespaceURI: '*',
	// Note: ignoring 'firstElementChild', 'lastElementChild',
	// 'nextElementSibling' and 'previousElementSibling' from the list
	// above.

	// Standard HTMLElement interface represents any HTML element
	// https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement#Properties
	accessKey: '*',
    accessKeyLabel: '*',
    contentEditable: '*',
    isContentEditable: '*',
    contextMenu: '*',
    dataset: '*',
    dir: '*',
    draggable: '*',
    dropzone: '*',
    hidden: '*',
    lang: '*',
    spellcheck: '*',
    style: '*',
    tabIndex: '*',
    title: '*',
    offsetHeight: '*',
    offsetLeft: '*',
    offsetParent: '*',
    offsetTop: '*',
    offsetWidth: '*',
    clientWidth: '*',
    clientHeight: '*',
    clientLeft: '*',
    clientTop: '*',
    nodeValue: '*',
    nodeType: '*',
    childNodes: '*',

    // other DOM methods
    getElementById: true,
    getElementsByClassName: true,
    getElementsByName: true,
    getElementsByTagName: true,
    getElementsByTagNameNS: true,
    querySelector: true,
    querySelectorAll: true
};
