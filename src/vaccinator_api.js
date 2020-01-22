/**
 * vaccinatorJsClient class module
 * 
 * Access and use vaccinator service with JavaScript.
 * 
 * TODO: Validate APP-ID during setting
 * 
 */
class vaccinator {
    url = "";           // current class connection to service URL
    userName = "";      // currently used userName
    password = "";      // currently used password
    appId = "";         // currently used App ID
    debugging = false;  // if debugging is activated
    headers = {};       // optional additional headers to add to fetch requests
    cache = {};         // cache object (hold in memory)

    /**
     * Initialize the vaccinator class
     */
    constructor() {  }

    /**
     * Initialize the vaccinator class
     * 
     * @param {string} url 
     * @param {string} userName
     * @param {string} appId (optional)
     * @param {string} password (optional)
     * @param {boolean} debugMode (optional)
     * @returns {boolean}
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
        
        if (appId !== undefined && appId !== "") {
            if (!this.validateAppId(appId)) {
                throw (new vaccinatorError("init: given appId does not validate!", 
                                  VACCINATOR_INVALID));
            }
        };

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
     * 
     * @param {string} payload 
     * @returns {promise}
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
                               body: post,
                               headers: that.headers
                             };
                that._debug("userNew: Protocol call: [" + jsonString + 
                            "] to url ["+that.url+"]");
                fetch(that.url, params)
                .then(function(response) {
                    if (response.status !== 200) {
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
     * 
     * @param {string} pid
     * @param {string} payload 
     * @returns {promise}
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
                               body: post,
                               headers: that.headers
                             };
                that._debug("userUpdate: Protocol call: [" + jsonString + 
                            "] to url ["+that.url+"]");
                fetch(that.url, params)
                .then(function(response) {
                    if (response.status !== 200) {
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
     * 
     * @param {*} pids
     * @returns {promise}
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
                           body: post,
                           headers: that.headers
                         };
            that._debug("userDelete: Protocol call: [" + jsonString + 
                        "] to url ["+that.url+"]");
            fetch(that.url, params)
            .then(function(response) {
                if (response.status !== 200) {
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
     * 
     * @param {*} pids
     * @returns {string}
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
                                   body: post,
                                   headers: that.headers
                                 };
                    that._debug("userGet: Protocol call: [" + jsonString + 
                                "] to url ["+that.url+"]");
                    fetch(that.url, params)
                    .then(function(response) {
                        if (response.status !== 200) {
                            throw(new vaccinatorError("userGet: URL request failed with status " + 
                                        response.status, VACCINATOR_SERVICE));
                        }
                        return response.json();
                    }).then(function(jsonResult) {
                        if (jsonResult.status === "OK") {
                            that._debug("userGet: Successfully received payloads. Processing...");
                            // decrypt payloads
                            var data = jsonResult.data;
                            var checksum = that.appId.substr(-2, 2); // current appId checksum
                            for (var pid of Object.keys(data)) {
                                if (data[pid]["status"] === "OK") {
                                    try {
                                        data[pid]["data"] = that._decrypt(data[pid]["data"], 
                                                                          that._getKey(), 
                                                                          checksum);
                                        // update local cache
                                        that._storeCache(pid, data[pid]["data"]); // ignore promise (?)
                                    } catch (e) {
                                        // very likely the checksum did not match!
                                        console.error("Unable to decrypt payload ["+pid+
                                                "] because used appId seems not the correct one or "+
                                                "some crypto error occured! "+
                                                "Origin error: [" + e.toString() + "]");
                                        // cleanup failing dataset
                                        data[pid]["status"] = "ERROR";
                                        data[pid]["data"] = false;
                                    }
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
     * 
     * @param {*} pids
     * @returns {promise}
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
     * This is trying to re-encode all given payloads after the app-id has changed.
     * The function also updates local cache. If you do not want all the data stay
     * here, either use userWipe() to remove specific items or wipeCache() to
     * cleanup all.
     * After the function ran, the newAppId is the current class app-id and overlays
     * the app-id given during initialization.
     * 
     * @param {*} pids
     * @param {string} oldAppId
     * @param {string} newAppId
     * @returns {promise}
     */
    async changeAppId(pids, oldAppId, newAppId) {
        if (pids === undefined || pids === "") {
            throw (new vaccinatorError("changeAppId: pids parameter is mandatory",
                    VACCINATOR_INVALID));
        }
        if (oldAppId === undefined || oldAppId === "" ||
                newAppId === undefined || newAppId === "")  {
            throw (new vaccinatorError("changeAppId: oldAppId and newAppId are mandatory",
                    VACCINATOR_INVALID));
        }
        if (oldAppId !== this.appId) {
            throw (new vaccinatorError("changeAppId: oldAppId must be identical to current appId",
                    VACCINATOR_INVALID));
        }
        if (!this.validateAppId(newAppId)) {
            throw (new vaccinatorError("changeAppId: given new appId does not validate!", 
                    VACCINATOR_INVALID));
        }
        
        if (!Array.isArray(pids)) { pids = pids.split(" "); }
        
        var that = this;
        return this.userGet(pids).then(function(payloadArray) {
            // payloadArray should contain absolut all payloads to
            // re-encrypt
            
            // create new vaccinator class with new AppId
            var newVac = new vaccinator();
            return newVac.init(that.url, that.userName, newAppId, that.password, that.debugging)
            .then(function() {
                var promises = new Array(); // will hold the promises
                for(let i = 0; i < pids.length; i++) {
                    // loop all pids and retrieved content
                    let pid = pids[i];
                    if (payloadArray[pid]["status"] === "OK") {
                        that._debug("Store new dataset for ["+pid+"]");
                        promises.push(newVac.userUpdate(pid, payloadArray[pid]["data"])
                            .then(function (pid) {
                               return pid; 
                            })
                        );
                    } else {
                        that._debug("Failed retrieving payload for PID [" + pid + "] (no data?).");
                    }
                }
                return Promise.all(promises)
                .then(function(pids) {
                    newVac = null; // destroy instance
                    // from now on, the new appId must get used:
                    return that._saveAppId(newAppId)
                    .then(function() {
                       return pids.length;
                    });
                });
                
            });
        });
    }  

    /**
     * Wiping the complete cache. If token is given and known,
     * it will not wipe. If given and unknown it will wipe
     * and remember that token.
     * 
     * @param {string} token (optional)
     * @returns {promise}
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
     * 
     * @param {string} token (optional)
     * @returns {promise}
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
     * 
     * @returns {string}
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
     * 
     * @param {string} appId 
     * @returns {boolean}
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
     * Set some additional header values.
     * Example:
     * .setHeaders( { 'Cache-Control': 'max-age=60' } );
     * 
     * @param {object} headersObj
     * @returns {Boolean}
     */
    setHeaders(headersObj) {
        this._debug("Set additional headers for the class [" + 
                    JSON.stringify(headersObj) + "]");
        this.headers = headersObj;
        return true;
    }

    /**
     * Saves the given AppId to the local database (using current userName).
     * If a password is known, it will save it encrypted!
     * 
     * @param {string} appId
     * @returns {promise}
     */
    async _saveAppId(appId) {
        var key = this._getKey();
        var store = "";
        if (key !== false) {
            // save encrypted
            store = this._encrypt(appId, key);
        } else {
            store = appId;
        }
        this._debug("Store/update app-id in local storage");
        var dbKey = "appId-" + this.userName;
        this.appId = appId; // keep local
        return localforage.setItem(dbKey, store);
    }

    /**
     * Calculates the SHA256 from the known user password.
     * Returns false in case there is no valid password.
     * 
     * @returns {Uint8Array}
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
     * Generate some random number Array with given
     * byte length. Uses Math.random()!
     * 
     * @param {int} bytes
     * @returns  {Array}
     */
    _generateRandom(bytes) {
        return Array.from({length: bytes}, () => Math.floor(Math.random() * 255));
    }

    /**
     * Convert some array to hex encoded string
     * 
     * @param {Array} buffer
     * @returns {string}
     */
    _buf2hex(buffer) { // buffer is an ArrayBuffer
        return aesjs.utils.hex.fromBytes(buffer);
    }

    /**
     * Convert some hex encoded string to Uint8Array
     * 
     * @param {string} hexString 
     * @returns {Uint8Array}
     */
    _hex2buf(hexString) {
        return aesjs.utils.hex.toBytes(hexString);
    }

    /**
     * Calculate SHA256 from some given string and
     * return hex encoded hash.
     * 
     * @param {string} someString 
     * @returns {string}
     */
    _hash(someString) {
        return forge_sha256(someString);
    }

    /**
     * Encrypt some string with given key array using
     * AES in CBC mode (key must me 256 bits).
     * Recipt is aes-256-cbc
     * 
     * Result if Standard:
     * recipt:iv:data (3 parts)
     * 
     * If addChecksum is provided, it is added like
     * recipt:addChecksum:iv:data (4 parts)
     * 
     * @param {string} data 
     * @param {array} password 
     * @param {string} addChecksum (optional)
     * @returns {string} encryptedHEX
     */
    _encrypt(data, password, addChecksum) {
        var iv = this._generateRandom(16); // 128 bits iv
        if (this.debugging) {
            this._debug("Encrypt with key ["+this._buf2hex(password)+"] "+
                        "and iv ["+this._buf2hex(iv)+"]"); 
        }
        
        var aesCbc = new aesjs.ModeOfOperation.cbc(password, iv);
        
        var dataBytes = aesjs.utils.utf8.toBytes(data); // convert to array
        dataBytes = aesjs.padding.pkcs7.pad(dataBytes); // apply padding
        var enc = aesCbc.encrypt(dataBytes);
        
        if (addChecksum !== undefined && addChecksum !== "") {
            return "aes-256-cbc:" + addChecksum + ":" + 
                   this._buf2hex(iv) + ":" + this._buf2hex(enc);
        }
        return "aes-256-cbc:" + this._buf2hex(iv) + ":" + this._buf2hex(enc);
    }

    /**
     * Decrypt some encrypted with given key array. Returns string.
     * If verifyChecksum is given, it must match the one from
     * given input data. Otherwise it throws an error.
     * 
     * Currently only supporting "aes-256-cbc" for AES in CBC mode 
     * (key must me 256 bits)
     * 
     * @param {string} data
     * @param {array} password
     * @param {string} verifyChecksum (optional)
     * @returns {string} decryptedText
     */
    _decrypt(data, password, verifyChecksum) {
        var parts = data.split(":");
        if (parts[0] !== "aes-256-cbc") {
            throw(new vaccinatorError("unknown crypto recipt [" + parts[0] + "]",
                           VACCINATOR_UNKNOWN));
        }
        var iv = "";
        var data = "";
        if (verifyChecksum !== undefined && verifyChecksum !== "") {
            if (verifyChecksum !== parts[1]) {
                throw(new vaccinatorError("_decrypt: Checksum does not match!", 
                               VACCINATOR_UNKNOWN));
            }
        }
        if (parts.length === 4) {
            iv = this._hex2buf(parts[2]);
            data = this._hex2buf(parts[3]);
        } else {
            iv = this._hex2buf(parts[1]);
            data = this._hex2buf(parts[2]);
        }
        if (this.debugging) {
            // do not concat if no debugging is used (save time)
            this._debug("Decrypt with key ["+this._buf2hex(password)+
                        "] and iv ["+this._buf2hex(iv)+"] and checksum [" + 
                        verifyChecksum + "]"); 
        }
        // var dec = new JSChaCha20(password, iv).decrypt(data);
        var aesCbc = new aesjs.ModeOfOperation.cbc(password, iv);
        var decryptedBytes = aesCbc.decrypt(data);
        decryptedBytes = aesjs.padding.pkcs7.strip(decryptedBytes);
        
        return aesjs.utils.utf8.fromBytes(decryptedBytes);
    }

    /**
     * Outputs vaccinator class related text to debug console
     * if debugging is activated
     * 
     * @param {string} message 
     */
    _debug (message) {
        if (!this.debugging) { return; }
        console.debug("VACCINATOR: " + message);
    }

    // Cache functions

    /**
     * Store data in cache
     * 
     * @param {string} pid 
     * @param {string} payload 
     * @returns {boolean}
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
     * 
     * @param {string} pid 
     * @returns {string}
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
     * 
     * @param {array} pids
     * @returns {boolean}
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
 * @param {int} vaccinatorCode
 * @returns {object}
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