/** @type {Date} */
var a = getSomething();
a; //: Date

a.getTime; //: fn() -> number

/** @type {{x: Integer, y: [String]}} */
var c = somethingElse();
c; //:: {x: number, y: [string]}

/**
 * This is a function
 * @return {[Number]}
 * @param {Number} a
 * @param {String} b
 */
function foo(a, b) { return hohoho(); }
foo; //: fn(a: number, b: string) -> [number]

/** @this Date */
var abc = function() {
  this; //: Date
};

/** @this Abc */
var Abc = function() {
  this; //: Abc
};

/** @class */
var AbcCls = function() {
  this; //: AbcCls
};

/** @constructor */
var AbcCtor = function() {
  this; //: AbcCtor
};

/**
 * This is also a function
 * @returns {string}
 * @arg {Number} a
 */
var bar = function(a, b) { return goop(); };
bar(gulp(), 10);
bar; //: fn(a: number, b: number) -> string

var o = {
  /** @type {String} */
  prop1: mystery(),

  /** @returns {Number} */
  prop2: function() { return anything(); }
};

/** @returns {String} */
o.prop3 = function() { return something(); };

o.prop1; //: string
o.prop2; //: fn() -> number
o.prop3; //: fn() -> string

/** @type {Array.<string>} */
var closureArray = anotherThing();
closureArray[1]; //: string

/** @type {Object.<number,boolean>} */
var closureMap = yetAnotherThing();
closureMap[1]; //: bool

/** @param {Number=} a */
function takesOpt(a) { console.log(a || 20); }

takesOpt; //: fn(a?: number)

/** @typedef {Array.<boolean>} Bitset */

/**
 * @typedef {Object} MyType
 * @property {boolean} one - Property one
 * @property {integer} two - And two
 */

someNonDeclarationStatement();

/** @type {Bitset} */
var myBitset = getABitset();

myBitset; //: [bool]

/** @type {MyType} */
var myObj;

myObj.one //: bool
myObj.two //: number
({}).one //: ?

function NonAscïį() { this.length = "hi"; }

/** @type {NonAscïį} */
var inst;

inst.length; //: string

/** @type {bogus.Type} */
var bogus = abcdef();

bogus; //: bogus.Type

/** @type {bogus.Overridden} */
var again = 10;

again; //: number

/**
 * @return {bogus.Retval}
 * @param {bogus.Arg} a
 */
function functionBogus(a) { return hohoho(); }

functionBogus; //: fn(a: bogus.Arg) -> bogus.Retval

/** @type {string|number} */
var stringOrNumber;

stringOrNumber; //: string|number

/**
 * @param {string|null} a
 * @return {Array.<Foo|number>}
 */
function unionFunction(a) { return argh(); }

unionFunction; //: fn(a: string) -> [Foo|number]

/**
 * @returns {string}
 */
function ui() {}

ui(); //: string

/**
 * @param {?string} [somebody=John Doe] - Somebody's name.
 */
function sayHello(somebody) {
  somebody; //: string
}

/**
 * Testing jsdoc with properties for an object
 * @param {!Object} employee - The employee who is responsible for the project.
 * @param {string} employee.name - The name of the employee.
 * @param {string} employee.department - The employee's department.
 */
function paramProperties(employee) {
  employee; //:: {department: string, name: string}
}

/**
 * Testing jsdoc with properties for objects in an array
 * @param {Object[]} employees - The employees who are responsible for the project.
 * @param {string} employees[].name - The name of an employee.
 * @param {string} employees[].department - The employee's department.
 */
function arrayParamProperties(employees) {
  employees; //:: [{department: string, name: string}]
}
