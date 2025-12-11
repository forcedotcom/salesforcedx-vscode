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
 *
 * This class provides mutual exclusion within and across browser tabs.
 *
 * Implemented based on "A Fast Mutual Exclusion Algorithm" (Leslie Lamport 1985)
 * http://research.microsoft.com/en-us/um/people/lamport/pubs/fast-mutex.pdf
 *
 * Algorithm (`_lockPriv` method):
 * 1.  Set X = i
 * 2.  If Y != 0: Restart
 * 3.  Set Y = i
 * 4.  If X != i:
 * 5.    Delay
 * 6.    If Y != i: Restart
 * 7.  [Has lock. Do work]
 * 8.  Set Y = 0
 *
 * In English:
 * 1. Always set X to the current client’s unique identifier.
 * 2. If Y is not zero then another client has the lock, so restart.
 * 3. If Y was zero, then set Y to the client ID.
 * 4. If X has changed, there’s a possibility of contention. So…
 * 5. Delay for long enough for another client to have seen Y as zero and tried to write it. (We added a random jitter here to minimize the chance of a client being starved.)
 * 6. If the client didn’t win Y, then restart the whole process.
 * 7. The lock was won, or there was no sign of contention, so now we can do our work.
 * 8. Clear Y to allow another client to take the lock.
 *
 * Note the use of window.requestAnimationFrame(). All modern browsers do not invoke the callback when
 * the tab is not active. This results in preferential treatment to the in-focus tab.
 *
 * @constructor
 * @export
 */

Aura.Utils.Mutex = function Mutex() {
    this.queue = [];
    this.lockAvailable = true;
};

Aura.Utils.Mutex.SET_MUTEX_WAIT = 15;
Aura.Utils.Mutex.RETRY_WAIT     = 15;
Aura.Utils.Mutex.MAX_LOCK_TIME  = 8000;
Aura.Utils.Mutex.CLIENT_ID      = Aura.Context.AuraContext.CLIENT_SESSION_ID;
Aura.Utils.Mutex.GLOBAL_KEY     = 'global';
Aura.Utils.Mutex.MUTEX_X_KEY    = '__MUTEX_X';
Aura.Utils.Mutex.MUTEX_Y_KEY    = '__MUTEX_Y';

/**
 * Returns the unique clientId.
 * @returns {String}
 * @export
 */
Aura.Utils.Mutex.prototype.getClientId = function () {
    return Aura.Utils.Mutex.CLIENT_ID;
};

/**
 * Acquires a lock.
 * @param {String} key The identifier of the lock.
 * @param {Function} callback The function to invoke after the lock is acquired, to which it is passed a function to unlock.
 * @param {Number} timeout the maximum time the lock may be held (milliseconds).
 * @export
 */
Aura.Utils.Mutex.prototype.lock = function (/* [key], callback, [timeout] */) {
    var xargs    = Array.prototype.slice.call(arguments);
    var key      = typeof arguments[0] === 'string' ? xargs.shift() : Aura.Utils.Mutex.GLOBAL_KEY;
    var callback = xargs.shift();
    var timeout  = xargs.shift() || Aura.Utils.Mutex.MAX_LOCK_TIME;

    $A.assert(typeof callback === 'function', 'Mutex needs a function to execute');

    if (this.lockAvailable && !this.queue.length) {
        this.lockAvailable = false;
        window.requestAnimationFrame(this._lockPriv.bind(this, key, callback, timeout));
    } else {
        this.queue.push({ key: key, callback: callback, timeout: timeout });
    }

};

Aura.Utils.Mutex.prototype._lockPriv = function (key, callback, timeout) {
    this._setX(key, function () {
        if (!this._isLockAvailable(key, timeout)) {
            this._retry(key, callback, timeout);
            return;
        }

        this._setY(key, function () {
            if (this._getX(key) !== Aura.Utils.Mutex.CLIENT_ID) {
                setTimeout(function () {
                    if (!this.hasLock(key)) {
                        this._retry(key, callback, timeout);
                    } else {
                        this._execute(key, callback);
                    }
                }.bind(this), Math.random() * Aura.Utils.Mutex.RETRY_WAIT);
            } else {
                this._execute(key, callback);
            }
        });
    });
};

Aura.Utils.Mutex.prototype.hasLock = function (key) {
    return this._getY(key) === Aura.Utils.Mutex.CLIENT_ID;
};

Aura.Utils.Mutex.prototype._execute = function (key, callback) {
    setTimeout(function () {
        callback(this._clearLock.bind(this, key));
    }.bind(this), 0);
};

Aura.Utils.Mutex.prototype._clearLock = function (key) {
    window.localStorage.removeItem(key + Aura.Utils.Mutex.MUTEX_Y_KEY);
    var lockTask = this.queue.shift();
    if (lockTask) {
        window.requestAnimationFrame(this._lockPriv.bind(this, lockTask.key, lockTask.callback, lockTask.timeout));
    } else {
        this.lockAvailable = true;
    }
};

Aura.Utils.Mutex.prototype._retry = function (key, callback, timeout) {
    window.setTimeout(function () {
        this._lockPriv(key, callback, timeout);
    }.bind(this), Math.random() * Aura.Utils.Mutex.RETRY_WAIT);
};

Aura.Utils.Mutex.prototype._isLockAvailable = function (key, timeout) {
    var item = window.localStorage.getItem(key + Aura.Utils.Mutex.MUTEX_Y_KEY);
    var token = item && item.split('|');
    var mutex_y_TS = token && parseInt(token[1], 10);

    // No token or token expired
    if (!token || Date.now() > mutex_y_TS + timeout) {
        return true;
    }
};

Aura.Utils.Mutex.prototype._getX = function (key) {
    var item = window.localStorage.getItem(key + Aura.Utils.Mutex.MUTEX_X_KEY);
    return item && item.split('|')[0];
};

Aura.Utils.Mutex.prototype._setX = function (key, callback) {
    window.localStorage.setItem(key + Aura.Utils.Mutex.MUTEX_X_KEY, Aura.Utils.Mutex.CLIENT_ID + '|' + Date.now());
    window.setTimeout(callback.bind(this), Math.random() * Aura.Utils.Mutex.SET_MUTEX_WAIT);
};

Aura.Utils.Mutex.prototype._getY = function (key) {
    var item = window.localStorage.getItem(key + Aura.Utils.Mutex.MUTEX_Y_KEY);
    return item && item.split('|')[0];
};

Aura.Utils.Mutex.prototype._setY = function (key, callback) {
    window.localStorage.setItem(key + Aura.Utils.Mutex.MUTEX_Y_KEY, Aura.Utils.Mutex.CLIENT_ID + '|' + Date.now());
    window.setTimeout(callback.bind(this), Math.random() * Aura.Utils.Mutex.SET_MUTEX_WAIT);
};