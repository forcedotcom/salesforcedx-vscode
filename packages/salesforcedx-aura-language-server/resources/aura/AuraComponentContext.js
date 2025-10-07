/*
 * Copyright (C) 2013 salesforce.com, inc.
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


/**
 * A glorified stack to keep track of which component we're working
 * on behalf of.  Stack frames may have arbitrary annotations attached.
 *
 * @constructor
 */
function AuraComponentContext() {
    /** Stack of components in nested-context order */
    this.stack = [];
}

/** Inner type for stack frames. */
AuraComponentContext.prototype.Frame = function(cmp) {
    this.cmp = cmp;
    this.notes = undefined;
};

/**
 * Pushes a new context frame onto the stack.
 *
 * @param {Component} cmp Incoming context component
 * @returns old (covered-over) context component, or undefined at top of stack
 */
AuraComponentContext.prototype.push = function(cmp) {
    var prior = this.stack.length ? this.stack[this.stack.length - 1].cmp : undefined;
    this.stack.push(new this.Frame(cmp));
    return prior;
};

/**
 * Pops an old context frame from the stack.  If the optional argument
 * is supplied, verifies that the expected the component matches the
 * popped context, causing a crash ($A.assert) if we have a mismatch.
 *
 * The severe death-on-mismatch behavior is because we expect the context
 * to control e.g. permissions for access, so a mismatch is a data security
 * hole.
 *
 * @param {Component} cmp Either undefined, or the expected current context
 *      to verify.
 * @returns component context that is no longer in effect
 */
AuraComponentContext.prototype.pop = function(cmp) {
    var oldFrame = this.stack.pop();
    if (cmp) {
        $A.assert(cmp === oldFrame.cmp, "ComponentContext mismatch detected.");
    }
    return oldFrame.cmp;
};

/**
 * Gets the current context's component.
 *
 * @return top-of-stack context, or undefined.
 */
AuraComponentContext.prototype.currentContext = function() {
    var len = this.stack.length;
    return len ? this.stack[len - 1].cmp : undefined;
};

/**
 * Sets an annotation for the current context frame.  Since annotations are specific to
 * the uses of the context stack, it is up to those users to ensure name collisions and
 * such are safely handled.
 */
AuraComponentContext.prototype.addNote = function(k, v) {
    if (!this.stack.length) {
        return;
    }
    var top = this.stack[this.stack.length - 1];
    if (top.notes === undefined) {
        top.notes = { };
    }
    top[k] = v;
};

/**
 * Gets an annotation from the current context frame.
 */
AuraComponentContext.prototype.getNote = function(k) {
    if (!this.stack.length) {
        return undefined;
    }
    var top = this.stack[this.stack.length - 1];
    if (!top.notes) {
        return undefined;
    }
    return top[k];
};

/**
 * Removes an annotation from the current context frame.
 */
AuraComponentContext.prototype.clearNote = function(k) {
    if (!this.stack.length) {
        return;
    }
    var top = this.stack[this.stack.length - 1];
    if (!top.notes) {
        return;
    }
    delete top[k];
};

Aura.Services.AuraComponentContext = AuraComponentContext;