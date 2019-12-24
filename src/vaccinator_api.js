/**
 * vaccinatorJsClient class module
 * 
 * Access and use vaccinator service with JavaScript.
 * 
 */
class vaccinator {
    url = "";
    userName = "";
    appId = "";
    password = "";
    debugging = false;
    cache = {};

    /**
     * Initialize the vaccinator class
     */
    constructor() {  }

    /**
     * Initialize the vaccinator class
     * @param {string} url 
     * @param {string} userName
     * @param {string} appId (optional)
     * @param {string} password (optional)
     * @param {boolean} debugMode (optional)
     * @return {boolean}
     */
    async init(url, userName, appId, password, debugMode) {
        // initialize the common parameters
        if (url === undefined || userName === undefined ||
            url === "" || userName === "") {
            throw (new vaccinatorError("init: url and userName parameter are mandatory", 
                                  VACCINATOR_INVALID));
        }
        if (debugMode !== undefined) { this.debugging = debugMode; }

        if (!localforage.supports(localforage.INDEXEDDB)) {
            throw (new vaccinatorError("Please use an up to date webbrowser (no IndexedDB supported)", 
                                  VACCINATOR_UNKNOWN));
        }

        this.url = url;
        this.userName = userName;
        this.appId = appId;
        this.password = password;
        if (appId !== undefined && appId !== "") {
            this._saveAppId(appId);
        } else {
            this.appId = undefined;
        }

        // init database
        localforage.config({
            name: 'vaccinator database'
        });

        // restore cache object
        var res = await this._ensureCacheLoaded();
        this._debug("Initialization done");
        return true;
    }

    /**
     * Pushes new payload to vaccinator service and returns
     * generated app-id
     * @param {string} payload 
     * @return {promise}
     */
    async userNew(payload) {
        if (payload === undefined || payload === "") {
            throw (new vaccinatorError("userNew: payload parameter is mandatory",
                    VACCINATOR_INVALID));
        }
        var that = this;
        return new Promise(function(resolve, reject) {
            that.getAppId().then(function(aid) {
                var jsonString= JSON.stringify( {
                    op: "add", 
                    data:  that._encrypt(payload, that._getKey(), aid.substr(-2)),
                    uid: that.userName });
                var post = new FormData();
                post.append("json", jsonString);
                var params = { method:"POST",
                               body: post };
                that._debug("userNew: Protocol call: [" + jsonString + 
                            "] to url ["+that.url+"]");
                fetch(that.url, params)
                .then(function(response) {
                    if (response.status != 200) {
                        throw(new vaccinatorError("userNew: URL request failed with status " + 
                                    response.status, VACCINATOR_SERVICE));
                    }
                    return response.json();
                }).then(function(jsonResult) {
                    if (jsonResult.status === "OK") {
                        that._debug("userNew: Returning new PID ["+jsonResult.pid+"]");
                        that._storeCache(jsonResult.pid, payload); // ignore promise!
                        resolve(jsonResult.pid);
                    } else {
                        throw(new vaccinatorError("userNew: Result was not OK (Code " +
                                    jsonResult.code+"-" + jsonResult.desc + ")", 
                                    VACCINATOR_SERVICE, jsonResult.code));
                    }
                }).catch(function(e) {
                    throw(new vaccinatorError("userNew: URL request failed: [" + e + "]", 
                                    VACCINATOR_SERVICE));
                });
            });
        });
    }

    /**
     * Updates new payload to vaccinator service and returns
     * pid app-id
     * @param {string} pid
     * @param {string} payload 
     * @return {promise}
     */
    async userUpdate(pid, payload) {
        if (pid === undefined || pid === "" || 
            payload === undefined || payload === "") {
            throw (new vaccinatorError("userUpdate: pid and payload parameter are mandatory",
                    VACCINATOR_INVALID));
        }
        var that = this;
        return new Promise(function(resolve, reject) {
            that.getAppId().then(function(aid) {
                var jsonString= JSON.stringify( {
                    op: "update",
                    pid: pid,
                    data:  that._encrypt(payload, that._getKey(), aid.substr(-2)),
                    uid: that.userName });
                var post = new FormData();
                post.append("json", jsonString);
                var params = { method:"POST",
                               body: post };
                that._debug("userUpdate: Protocol call: [" + jsonString + 
                            "] to url ["+that.url+"]");
                fetch(that.url, params)
                .then(function(response) {
                    if (response.status != 200) {
                        throw(new vaccinatorError("userUpdate: URL request failed with status " + 
                                    response.status, VACCINATOR_SERVICE));
                    }
                    return response.json();
                }).then(function(jsonResult) {
                    if (jsonResult.status === "OK") {
                        that._storeCache(pid, payload); // ignore promise (good?)
                        that._debug("userUpdate: Returning updated PID ["+pid+"]");
                        resolve(pid);
                    } else {
                        throw(new vaccinatorError("userUpdate: Result was not OK (Code " +
                                    jsonResult.code+"-" + jsonResult.desc + ")", 
                                    VACCINATOR_SERVICE, jsonResult.code));
                    }
                }).catch(function(e) {
                    throw(new vaccinatorError("userUpdate: URL request failed: [" + e + "]", 
                                    VACCINATOR_SERVICE));
                });
            });
        });
    }

    /**
     * Updates new payload to vaccinator service and returns
     * pid app-id
     * @param {*} pids
     * @return {promise}
     */
    async userDelete(pids) {
        if (pids === undefined || pids === "") {
            throw (new vaccinatorError("userDelete: pids parameter is mandatory",
                    VACCINATOR_INVALID));
        }
        if (!Array.isArray(pids)) { pids = pids.split(" "); }

        // TODO: chunk requests with more than 500 PIDs

        var that = this;
        return new Promise(function(resolve, reject) {
            var jsonString= JSON.stringify( {
                op: "delete",
                pid: pids.join(" "),
                uid: that.userName });
            var post = new FormData();
            post.append("json", jsonString);
            var params = { method:"POST",
                           body: post };
            that._debug("userDelete: Protocol call: [" + jsonString + 
                        "] to url ["+that.url+"]");
            fetch(that.url, params)
            .then(function(response) {
                if (response.status != 200) {
                    throw(new vaccinatorError("userDelete: URL request failed with status " + 
                                response.status, VACCINATOR_SERVICE));
                }
                return response.json();
            }).then(function(jsonResult) {
                if (jsonResult.status === "OK") {
                    that._debug("userDelete: Success");
                    return that._removeCache(pids).then(function() {
                        resolve(pids);
                    });
                } else {
                    throw(new vaccinatorError("userDelete: Result was not OK (Code " +
                                jsonResult.code+"-" + jsonResult.desc + ")", 
                                VACCINATOR_SERVICE, jsonResult.code));
                }
            }).catch(function(e) {
                throw(new vaccinatorError("userDelete: URL request failed: [" + e + "]", 
                                VACCINATOR_SERVICE));
            });
        });
    }

    /**
     * Get payload from vaccinator service
     * pids may be multiple pids separated by space " " or as array
     * @param {*} pids
     * @return {string}
     */
    async userGet(pids) {
        if (pids === undefined || pids === "") {
            throw (new vaccinatorError("userGet: pid parameter is mandatory",
                    VACCINATOR_INVALID));
        }
        if (!Array.isArray(pids)) { pids = pids.split(" "); }

        // check for the cached pids first

        var that = this;
        var uncached = new Array(); // will get the uncached pids
        var finalResult = new Object(); // compose result
        var promises = new Array(); // will hold the promises
        pids.map(function(pid) {
            // create an array of promises for cache check (use with Promise.all)
            promises.push(that._retrieveCache(pid)
            .then(function(payload) {
                if (payload === null || payload === undefined) {
                    uncached.push(pid);
                    that._debug("userGet: Add pid ["+pid+"] for getting from server");
                    return;
                }
                that._debug("userGet: Retrieve cached payload for pid ["+pid+"]");
                var r = {"status": "OK", "data": payload};
                finalResult[pid] = r;
                return;
            }));
        })

        return Promise.all(promises)
        .then(function() {

            // Retrieve missing PIDs from server
            
            var requestPids = uncached.join(" ");
            if (requestPids === "") {
                // nothing to get from vaccinator service (all from cache)
                return new Promise(function(resolve, reject) {
                    resolve(finalResult);
                });
            }

            // TODO: chunk requests with more than 500 PIDs

            return new Promise(function(resolve, reject) {
                that.getAppId().then(function(aid) {
                    var jsonString= JSON.stringify( {
                        op: "get",
                        pid: requestPids,
                        uid: that.userName });
                    var post = new FormData();
                    post.append("json", jsonString);
                    var params = { method:"POST",
                                body: post };
                    that._debug("userGet: Protocol call: [" + jsonString + 
                                "] to url ["+that.url+"]");
                    fetch(that.url, params)
                    .then(function(response) {
                        if (response.status != 200) {
                            throw(new vaccinatorError("userGet: URL request failed with status " + 
                                        response.status, VACCINATOR_SERVICE));
                        }
                        return response.json();
                    }).then(function(jsonResult) {
                        if (jsonResult.status === "OK") {
                            that._debug("userGet: Successfully received payloads. Processing...");
                            // decrypt payloads
                            var data = jsonResult.data;
                            for (var pid of Object.keys(data)) {
                                if (data[pid]["status"] == "OK") {
                                    data[pid]["data"] = that._decrypt(data[pid]["data"], 
                                                                      that._getKey());
                                    // update local cache
                                    that._storeCache(pid, data[pid]["data"]); // ignore promise!
                                }
                            };
                            // merge cached and service results
                            finalResult = Object.assign({}, data, finalResult); 
                            resolve(finalResult);
                        } else {
                            throw(new vaccinatorError("userGet: Result was not OK (Code " +
                                        jsonResult.code+"-" + jsonResult.desc + ")", 
                                        VACCINATOR_SERVICE, jsonResult.code));
                        }
                    }).catch(function(e) {
                        throw(new vaccinatorError("userGet: URL request failed: [" + e + "]", 
                                        VACCINATOR_SERVICE));
                    });
                });
            });
        });
    }

    /**
     * Wipes the cache entry for the given PID
     * @param {*} pids
     * @return {promise}
     */
    async userWipe(pids) {
        if (pids === undefined || pids === "") {
            throw (new vaccinatorError("userWipe: pids parameter is mandatory",
                    VACCINATOR_INVALID));
        }
        if (!Array.isArray(pids)) { pids = pids.split(" "); }

        var that = this;
        return new Promise(function(resolve, reject) {
            that._removeCache(pids).then(function() {
                resolve(pids);
            });
        });
    }

    /**
     * Wiping the complete cache. If token is given and known,
     * it will not wipe. If given and unknown it will wipe
     * and remember that token.
     * @param {string} token (optional)
     * @return {promise}
     */
    async wipeCache(token) {
        var that = this;
        if (token !== undefined && token !== "") {
            // need to check if wipe is needed
            return localforage.getItem("payloadToken")
            .then(function(knownToken) {
                if (knownToken === token) {
                    that._debug("No need to wipe cache (known token)");
                    return false; // no need to wipe
                }
                return that._wipeCache(token).then(function() {
                    return true;
                });
            }).catch(function (error) {
                throw(new vaccinatorError("Failed reading payloadToken [" + error + "]", 
                                VACCINATOR_UNKNOWN));
            });
        }
        // without token, we're always wiping the cache
        return this._wipeCache().then(function() {
            return true;
        });
    }

    /**
     * Internal: wiping the cache (no token check!)
     * Will save token if given.
     * @param {string} token (optional)
     * @return {promise}
     */
    async _wipeCache(token) {
        // wipe
        var that = this;
        this._debug("Wiping cache");
        this.cache = {};
        return localforage.setItem("payload", this.cache)
        .then(function (value) {
            if (token !== undefined && token !== "") {
                // need to save payloadToken
                return localforage.setItem("payloadToken", token)
                .then(function() {
                    that._debug("New cache token is [" + token + "]");
                    return true;
                });
            }
            return true;
        }).catch(function (error) {
            throw(new vaccinatorError("Failed storing wiped cache [" + error + "]", 
                            VACCINATOR_UNKNOWN));
        });
    }
    
    /**
     * Returns the current active AppId
     */
    async getAppId() {
        var that = this;
        if (this.appId !== undefined) {
            // return known app-id
            this._debug("Return already cached app-id");
            return new Promise(function(resolve, reject) {
                resolve(that.appId);
            });
        }
        // try getting it from database
        this._debug("Read app-id from database");
        var dbKey = "appId-" + this.userName;
        return localforage.getItem(dbKey).then(function (value) {
            var appId = value;
            var key = that._getKey();
            if (key !== false) {
                appId = that._decrypt(value, key);
            }
            that._debug("Return app-id [" + appId + "]");
            that.appId = appId; // cache
            return appId;
        }).catch(function (error) {
            throw(new vaccinatorError("No AppId saved, you have to supply it during "+
                                 "initialization [" + error + "]", VACCINATOR_INVALID));
        });
    }

    /**
     * Validates the given AppId. Returns true if it is valid.
     * Please refer to APP-ID description for details.
     * @param {string} appId 
     * @return {boolean}
     */
    validateAppId(appId) {
        if (appId === undefined || appId === "" || appId.length < 4) {
            return false;
        }
        var cs = appId.substr(-2); // CheckSum from given AppId
        var sha256 = this._hash(appId.substr(0, appId.length-2)); // hash from AppId - checksum
        var calcCs = sha256.substr(-2); // calculated checksum
        return (cs === calcCs); // must be identical
    }

    /**
     * Saves the given AppId to the local database (using current userName).
     * If a password is known, it will save it encrypted!
     * 
     * @param {string} appId 
     */
    _saveAppId(appId) {
        var key = this._getKey();
        var store = "";
        if (key !== false) {
            // save encrypted
            store = this._encrypt(appId, key);
        } else {
            store = appId;
        }
        // console.log("Storing " + store);
        this._debug("Store/update app-id in local storage");
        var dbKey = "appId-" + this.userName;
        localforage.setItem(dbKey, store);
        this.appId = appId; // keep local
    }

    /**
     * Calculates the SHA256 from the known user password.
     * Returns false in case there is no valid password.
     * @return {Uint8Array}
     */
    _getKey() {
        if (this.password !== undefined && this.password !== "") {
            this._debug("Calculate sha256 from password as crypto key");
            var sha256 = this._hash(this.password);
            return this._hex2buf(sha256);
        }
        this._debug("No crypto key available (getKey -> false)");
        return false;

    }

    /**
     * Generate some random number Uint8Array with given
     * byte length. Uses Math.random()!
     * @param {int} bytes
     * @return  {Uint8Array}
     */
    _generateRandom(bytes) {
        return Uint8Array.from({length: bytes}, () => Math.floor(Math.random() * 255));
    }

    /**
     * Convert string to Uint8Array using utf8 encoding 
     * (eg for encryption)
     * @param {string} str 
     * @return {Uint8Array} 
     */
    _utf8AbFromStr(str) {
        var strUtf8 = unescape(encodeURIComponent(str));
        var ab = new Uint8Array(strUtf8.length);
        for (var i = 0; i < strUtf8.length; i++) {
            ab[i] = strUtf8.charCodeAt(i);
        }
        return ab;
    }
    
    /**
     * Convert utf8 encoded Uint8Array to string 
     * (eg after decryption)
     * @param {Uint8Array} ab 
     * @return {string}
     */
    _strFromUtf8Ab(ab) {
        return decodeURIComponent(escape(String.fromCharCode.apply(null, ab)));
    }

    /**
     * Convert some array to hex encoded string
     * @param {Array} buffer
     * @return {string}
     */
    _buf2hex(buffer) { // buffer is an ArrayBuffer
        return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
    }

    /**
     * Convert some hex encoded string to Uint8Array
     * @param {string} hexString 
     * @return {Uint8Array}
     */
    _hex2buf(hexString) {
        return new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    }

    /**
     * Calculate SHA256 from some given string and
     * return hex encoded hash.
     * @param {string} someString 
     * @return {string}
     */
    _hash(someString) {
        return forge_sha256(someString);
    }

    /**
     * Encrypt some string with given key array.
     * Standard:
     * recipt:iv:data
     * If useChecksum is provided, it is added like
     * recipt:checksum:iv:data
     * @param {string} data 
     * @param {array} password 
     * @param {string} useChecksum (optional)
     * @return {string} encryptedHEX
     */
    _encrypt(data, password, useChecksum) {
        var nonce = this._generateRandom(12);
        if (this.debugging) {
            this._debug("Encrypt with key ["+this._buf2hex(password)+"] "+
                        "and nonce ["+this._buf2hex(nonce)+"]"); 
        }
        var enc = new JSChaCha20(password, nonce).encrypt(this._utf8AbFromStr(data));
        if (useChecksum !== undefined && useChecksum !== "") {
            return "chacha20/12:" + useChecksum + ":" + 
                   this._buf2hex(nonce) + ":" + this._buf2hex(enc);
        }
        return "chacha20/12:" + this._buf2hex(nonce) + ":" + this._buf2hex(enc);
    }

    /**
     * Decrypt some encrypted with given key array. Returns string.
     * If useChesum is fiven, it must match the one from
     * given data. Otherwise it throws an error.
     * @param {string} data
     * @param {array} password
     * @param {string} useChecksum (optional)
     * @return {string} decryptedText
     */
    _decrypt(data, password, useChecksum) {
        var parts = data.split(":");
        if (parts[0] !== "chacha20/12") {
            throw(new vaccinatorError("unknown crypto recipt [" + parts[0] + "]",
                           VACCINATOR_UNKNOWN));
        }
        var nonce = "";
        var data = "";
        if (useChecksum !== undefined && useChecksum !== "") {
            if (useChecksum != parts[1]) {
                throw(new vaccinatorError("_decrypt: Checksum does not match!", 
                               VACCINATOR_UNKNOWN));
            }
        }
        if (parts.length == 4) {
            nonce = this._hex2buf(parts[2]);
            data = this._hex2buf(parts[3]);
        } else {
            nonce = this._hex2buf(parts[1]);
            data = this._hex2buf(parts[2]);
        }
        if (this.debugging) {
            // do not concat if no debugging is used (save time)
            this._debug("Decrypt with key ["+this._buf2hex(password)+
                        "] and nonce ["+nonce+"]"); 
        }
        var dec = new JSChaCha20(password, nonce).decrypt(data);
        return this._strFromUtf8Ab(dec);
    }

    /**
     * Outputs vaccinator class related text to debug console
     * if debugging is activated
     * @param {string} message 
     */
    _debug (message) {
        if (!this.debugging) { return; }
        console.debug("VACCINATOR: " + message);
    }

    // Cache functions

    /**
     * Store data in cache
     * @param {string} pid 
     * @param {string} payload 
     * @return {boolean}
     */
    async _storeCache(pid, payload) {
        var that = this;
        this._ensureCacheLoaded().then(function() {
            var dbKey = that._hash(pid);
            that._debug("Storing payload for PID " + pid + " in cache");
            that.cache[dbKey] = payload;
            return localforage.setItem("payload", that.cache).then(function (value) {
                return true;
            }).catch(function (error) {
                throw(new vaccinatorError("Failed storing payload (store) [" + error + "]", 
                                VACCINATOR_UNKNOWN));
            });
        });
    }

    /**
     * Getdata from cache. Will return null if not found!
     * @param {string} pid 
     * @return {string}
     */
    async _retrieveCache(pid) {
        var that = this;
        return this._ensureCacheLoaded().then(function() {
            var dbKey = that._hash(pid);
            that._debug("Retrieve payload for PID " + pid + " from cache");
            // use cache object
            return new Promise(function(resolve, reject) {
                resolve(that.cache[dbKey]);
            });
        });
    }

    /**
     * Removes one given entry from the cache
     * @param {array} pids
     * @return {boolean}
     */
    async _removeCache(pids) {
        var that = this;
        return this._ensureCacheLoaded().then(function() {
            pids.forEach(function(item, index) {
                var dbKey = that._hash(item);
                delete that.cache[dbKey];
            });
            return localforage.setItem("payload", that.cache).then(function (value) {
                that._debug("Removed payload for PID(s) " + JSON.stringify(pids) + " from cache");
                return true;
            }).catch(function (error) {
                throw(new vaccinatorError("Failed storing payload (remove) [" + error + "]", 
                                VACCINATOR_UNKNOWN));
            });
        });
    }

    async _ensureCacheLoaded() {
        if (Object.keys(this.cache).length === 0) {
            // initially, need to get cache from database
            this._debug("Restore cache from local storage");
            var that = this;
            return localforage.getItem("payload").then(function(payload) {
                if (payload === null) { payload = {}; }
                that.cache = payload;
                that._debug("Restored cache with " + Object.keys(that.cache).length + " objects");
                return;
            }).catch(function (error) {
                throw(new vaccinatorError("Failed database access [" + error + "]", 
                                VACCINATOR_UNKNOWN));
            });
        }
        // nothing to do
        return new Promise(function(resolve, reject) {
            resolve(true);
        });
    }
}

const VACCINATOR_SERVICE = 0; // error is related to vaccinator service
const VACCINATOR_INVALID = 1; // error is related to bad input parameters
const VACCINATOR_UNKNOWN = 9; // unknown relation of error

/** vaccinatorError error class (extends Error())
 * 
 * @param {string} message 
 * @param {int} reason VACCINATOR_n
 * @return {object}
 */
function vaccinatorError(message, reason, vaccinatorCode) {
    var err = new Error(message);
    Object.setPrototypeOf(err, vaccinatorError.prototype);

    err.reason = reason;
    err.vaccinatorCode = vaccinatorCode;

    return err;
}

vaccinatorError.prototype = Object.create(
    Error.prototype,
    {name: {value: 'vaccinatorError', enumerable: false}}
);

/*
Example codes notepad:
 
Encryption:
const key = Uint8Array([...]); // 32 bytes key
const nonce = Uint8Array([...]); // 12 bytes nonce
const message = Uint8Array([...]); // some data as bytes array
// Encrypt //
const encrypt = new JSChaCha20(key, nonce).encrypt(message);
// now encrypt contains bytes array of encrypted message

Decryption:
const key = Uint8Array([...]); // 32 bytes key
const nonce = Uint8Array([...]); // 12 bytes nonce
const encrypt = Uint8Array([...]); // some data as bytes array
// Decrypt //
const message = new JSChaCha20(key, nonce).decrypt(encrypt);
// now message contains bytes array of original message
 */
