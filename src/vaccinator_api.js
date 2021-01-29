/**
 * vaccinatorJsClient class module
 * @license MIT License
 * @link https://www.datavaccinator.com
 * See github LICENSE file for license text.
 */
class vaccinator {
    url = "";           // current class connection to service URL
    userName = "";      // currently used userName
    password = "";      // currently used password
    appId = "";         // currently used App ID
    debugging = false;  // if debugging is activated
    headers = {};       // optional additional headers to add to fetch requests
    useCache = true;    // status for cache usage (initially true)
    cache = {};         // cache object (hold in memory)
    searchFields = [];  // currently used search fields
    sid = 0;            // current service provider id (enableDirectLogin)
    spwd = "";          // current service provider password (enableDirectLogin)

    /**
     * Initialize the vaccinator class
     * 
     * @param {string} url 
     * @param {string} userName
     * @param {string} appId (optional)
     * @param {string} password (optional)
     * @param {boolean} debugMode (optional)
     * @returns {boolean} success
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
            throw (new vaccinatorError("init: please use an up to date webbrowser (no IndexedDB supported)", 
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
        await this._ensureCacheLoaded();
        this._debug("Initialization done");
        return true;
    }

    /**
     * Pushes new vData to vaccinator service and returns
     * generated app-id. Updates local cache automatically.
     * 
     * @param {string} vData 
     * @returns {promise} vid
     */
    async new(vData) {
        if (vData === undefined || vData === "") {
            throw (new vaccinatorError("userNew: vData parameter is mandatory",
                    VACCINATOR_INVALID));
        }
        var that = this;
        return new Promise(function(resolve, reject) {
            that.getAppId().then(function(aid) {
                var request = {
                    op: "add", 
                    version: 2,
                    data:  that._encrypt(vData, that._getKey(), aid.substr(-2)),
                    uid: that.userName,
                    words: that._getSearchWords(vData)
                };
                if (that.sid > 0 && that.spwd !== "") {
                    request.sid = that.sid;
                    request.spwd = that.spwd;
                }
                var jsonString= JSON.stringify(request);
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
                })
                .then(function(jsonResult) {
                    if (jsonResult.status === "OK") {
                        that._storeCache(jsonResult.vid, vData)
                        .then(function() {
                           that._debug("userNew: Returning new VID ["+jsonResult.vid+"]");
                           resolve(jsonResult.vid); 
                        });
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
     * Updates new vData to vaccinator service and returns
     * vid. Updates local cache automatically.
     * 
     * @param {string} vid
     * @param {string} vData 
     * @returns {promise} vid
     */
    async update(vid, vData) {
        if (vid === undefined || vid === "" || 
            vData === undefined || vData === "") {
            throw (new vaccinatorError("userUpdate: vid and vData parameter are mandatory",
                    VACCINATOR_INVALID));
        }
        var that = this;
        return new Promise(function(resolve, reject) {
            that.getAppId().then(function(aid) {
                var request = {
                    op: "update",
                    version: 2,
                    vid: vid,
                    data:  that._encrypt(vData, that._getKey(), aid.substr(-2)),
                    uid: that.userName,
                    words: that._getSearchWords(vData)
                };
                if (that.sid > 0 && that.spwd !== "") {
                    request.sid = that.sid;
                    request.spwd = that.spwd;
                }
                var jsonString= JSON.stringify(request);
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
                        that._storeCache(vid, vData).then(function() {
                            that._debug("userUpdate: Returning updated VID ["+vid+"]");
                            resolve(vid);
                        });
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
     * Deletes from vaccinator service and also from local cache. 
     * TAKE CARE: The data is finally removed then!
     * vids may be multiple vids separated by space " " or as array.
     * 
     * @param {(string|string[])} vids
     * @returns {promise} vids
     */
    async delete(vids) {
        if (vids === undefined || vids === "") {
            throw (new vaccinatorError("userDelete: vids parameter is mandatory",
                    VACCINATOR_INVALID));
        }
        if (!Array.isArray(vids)) { vids = vids.split(" "); }

        if (vids.length > 500)  {
            // too many vids per request
            throw (new vaccinatorError("userDelete: Max 500 vids allowed per request! Please try to chunk your calls.",
            VACCINATOR_INVALID));

        }

        var that = this;
        return new Promise(function(resolve, reject) {
            var request = {
                op: "delete",
                version: 2,
                vid: vids.join(" "),
                uid: that.userName 
            };
            if (that.sid > 0 && that.spwd !== "") {
                request.sid = that.sid;
                request.spwd = that.spwd;
            }
            var jsonString= JSON.stringify(request);
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
                    return that._removeCache(vids).then(function() {
                        resolve(vids);
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
     * Get vData from vaccinator service.
     * vids may be multiple vids separated by space " " or as array.
     * 
     * @param {(string|string[])} vids
     * @returns {string}
     */
    async get(vids) {
        if (vids === undefined || vids === "") {
            throw (new vaccinatorError("userGet: vids parameter is mandatory",
                    VACCINATOR_INVALID));
        }
        if (!Array.isArray(vids)) { vids = vids.split(" "); }

        // check for the cached vids first

        var that = this;
        var uncached = []; // will get the uncached vids
        var finalResult = new Object(); // compose result
        var promises = []; // will hold the promises
        vids.map(function(vid) {
            // create an array of promises for cache check (use with Promise.all)
            promises.push(that._retrieveCache(vid)
            .then(function(vData) {
                if (vData === null || vData === undefined) {
                    uncached.push(vid);
                    that._debug("userGet: Add vid ["+vid+"] for getting from server");
                    return;
                }
                that._debug("userGet: Retrieve cached vData for vid ["+vid+"]");
                var r = {"status": "OK", "data": vData};
                finalResult[vid] = r;
                return;
            }));
        });

        return Promise.all(promises)
        .then(function() {

            // Retrieve missing VIDs from server

            if (uncached.length > 500)  {
                // too many vids per request
                throw (new vaccinatorError("userGet: Max 500 vids allowed per request! Please try to chunk your calls.",
                VACCINATOR_INVALID));
            }
            
            var requestVIDs = uncached.join(" ");
            if (requestVIDs === "") {
                // nothing to get from vaccinator service (all from cache)
                return new Promise(function(resolve, reject) {
                    resolve(finalResult);
                });
            }

            return new Promise(function(resolve, reject) {
                that.getAppId().then(function(aid) {
                    var request = {
                        op: "get",
                        version: 2,
                        vid: requestVIDs,
                        uid: that.userName 
                    };
                    if (that.sid > 0 && that.spwd !== "") {
                        request.sid = that.sid;
                        request.spwd = that.spwd;
                    }
                    var jsonString= JSON.stringify(request);
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
                            that._debug("userGet: Successfully received vData. Processing...");
                            // decrypt vData
                            var data = jsonResult.data;
                            var checksum = that.appId.substr(-2, 2); // current appId checksum
                            var storePromises = [];
                            for (var vid of Object.keys(data)) {
                                if (data[vid]["status"] === "OK") {
                                    try {
                                        data[vid]["data"] = that._decrypt(data[vid]["data"], 
                                                                          that._getKey(), 
                                                                          checksum);
                                        // update local cache
                                        storePromises.push(that._storeCache(vid, data[vid]["data"]));
                                    } catch (e) {
                                        // very likely the checksum did not match!
                                        console.error("Unable to decrypt vData ["+vid+
                                                "] because used appId seems not the correct one or "+
                                                "some crypto error occured! "+
                                                "Origin error: [" + e.toString() + "]");
                                        // cleanup failing dataset
                                        data[vid]["status"] = "ERROR";
                                        data[vid]["data"] = false;
                                    }
                                }
                            };
                            // merge cached and service results
                            return Promise.all(storePromises)
                            .then(function() {
                                finalResult = Object.assign({}, data, finalResult);
                                that._debug("userGet: Finished");
                                resolve(finalResult);
                            });
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
     * Wipes the cache entry for the given VID(s).
     * vids may be multiple vids separated by space " " or as array.
     * 
     * @param {(string|string[])} vids
     * @returns {promise} vids
     */
    async wipe(vids) {
        if (vids === undefined || vids === "") {
            throw (new vaccinatorError("userWipe: vids parameter is mandatory",
                    VACCINATOR_INVALID));
        }
        if (!Array.isArray(vids)) { vids = vids.split(" "); }

        var that = this;
        return new Promise(function(resolve, reject) {
            that._removeCache(vids).then(function() {
                resolve(vids);
            });
        });
    }
    
    /**
     * This is trying to re-encode all given vData after the app-id has changed.
     * The function also updates local cache. If you do not want all the data stay
     * here, either use userWipe() to remove specific items or wipeCache() to
     * cleanup all.
     * After the function ran, the newAppId is the current class app-id and overlays
     * the app-id given during initialization.
     * 
     * vids may be multiple vids separated by space " " or as array.
     * 
     * @param {(string|string[])} vids
     * @param {string} oldAppId
     * @param {string} newAppId
     * @returns {promise} affectedCount
     */
    async changeAppId(vids, oldAppId, newAppId) {
        if (vids === undefined || vids === "") {
            throw (new vaccinatorError("changeAppId: vids parameter is mandatory",
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
        
        if (!Array.isArray(vids)) { vids = vids.split(" "); }
        
        var that = this;
        return this.get(vids).then(function(vDataArray) {
            // vDataArray should contain absolut all vData to
            // re-encrypt
            
            // create new vaccinator class with new AppId
            var newVac = new vaccinator();
            newVac.setHeaders(that.headers); // duplicate headers to use
            return newVac.init(that.url, that.userName, newAppId, that.password, that.debugging)
            .then(function() {
                var promises = []; // will hold the promises
                for(let i = 0; i < vids.length; i++) {
                    // loop all vids and retrieved content
                    let vid = vids[i];
                    if (vDataArray[vid]["status"] === "OK") {
                        that._debug("Store new dataset for ["+vid+"]");
                        promises.push(newVac.update(vid, vDataArray[vid]["data"])
                            .then(function (vid) {
                               return vid; 
                            })
                        );
                    } else {
                        that._debug("Failed retrieving vData for VID [" + vid + "] (no data?).");
                    }
                }
                return Promise.all(promises)
                .then(function(vids) {
                    newVac = null; // destroy instance
                    // from now on, the new appId must get used:
                    return that._saveAppId(newAppId)
                    .then(function() {
                       return vids.length;
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
     * @returns {promise} boolean
     */
    async wipeCache(token) {
        var that = this;
        if (token !== undefined && token !== "") {
            // need to check if wipe is needed
            return localforage.getItem("payloadToken")
            .then(function(knownToken) {
                if (knownToken === token) {
                    that._debug("wipeCache: No need to wipe cache (known token)");
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
        this._debug("_wipeCache: Wiping cache");
        this.cache = {};
        return localforage.setItem("payload", this.cache)
        .then(function (value) {
            if (token !== undefined && token !== "") {
                // need to save payloadToken
                return localforage.setItem("payloadToken", token)
                .then(function() {
                    that._debug("_wipeCache: New cache token is [" + token + "]");
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
     * Requests server info from DataVaccinator server.
     * 
     * @returns {Promise} array
     */
    async getServerInfo() {
        var that = this;
        return new Promise(function(resolve, reject) {
            var jsonString= JSON.stringify( {
                op: "check",
                version: 2,
                uid: that.userName });
            var post = new FormData();
            post.append("json", jsonString);
            var params = { method:"POST",
                           body: post,
                           headers: that.headers
                         };
            that._debug("getServerInfo: Protocol call: [" + jsonString + 
                        "] to url ["+that.url+"]");
            fetch(that.url, params)
            .then(function(response) {
                if (response.status !== 200) {
                    throw(new vaccinatorError("getServerInfo: URL request failed with status " + 
                                response.status, VACCINATOR_SERVICE));
                }
                return response.json();
            }).then(function(jsonResult) {
                if (jsonResult.status === "OK") {
                    that._debug("getServerInfo: Success");
                    resolve(jsonResult);
                } else {
                    throw(new vaccinatorError("getServerInfo: Result was not OK (Code " +
                                jsonResult.code+"-" + jsonResult.desc + ")", 
                                VACCINATOR_SERVICE, jsonResult.code));
                }
            }).catch(function(e) {
                throw(new vaccinatorError("getServerInfo: URL request failed: [" + e + "]", 
                                VACCINATOR_SERVICE));
            });
        });
    }
    
    /**
     * Enable search functionality using given vData fields.
     * 
     * @param {string[]} fields
     * @returns {boolean}
     */
    enableSearchFunction(fields) {
        if (fields === undefined) { 
            fields = []; 
        }
        this.searchFields = fields;
        return true;
    }
    
    /**
     * Search DataVaccinator service for entries matching given search words
     * 
     * @param {string} searchTerm 
     * @returns {Promise} vids
     */
    async search(searchTerm) {
        var term = "";
        var words = searchTerm.split(/[\s,\.\+\-\/\\$]+/g);
        for (var w of words) {
            term += this._searchHash(w, false) + " ";
        }
        term = term.trim(); // remove last space
        if (term === "") {
            // no valid search term
            this._debug("search: Empty search does not trigger a call to server!");
            return new Promise(function(resolve, reject) {
                // resolve promise with empty result array
                resolve( [] );
            });
        }
        
        var that = this;
        return new Promise(function(resolve, reject) {
            var request = {
                op: "search",
                version: 2,
                words: term,
                uid: that.userName 
            };
            if (that.sid > 0 && that.spwd !== "") {
                request.sid = that.sid;
                request.spwd = that.spwd;
            }
            var jsonString= JSON.stringify(request);
            var post = new FormData();
            post.append("json", jsonString);
            var params = { method:"POST",
                           body: post,
                           headers: that.headers
                         };
            that._debug("search: Protocol call: [" + jsonString + 
                        "] to url ["+that.url+"]");
            fetch(that.url, params)
            .then(function(response) {
                if (response.status !== 200) {
                    throw(new vaccinatorError("search: URL request failed with status " + 
                                response.status, VACCINATOR_SERVICE));
                }
                return response.json();
            }).then(function(jsonResult) {
                if (jsonResult.status === "OK") {
                    that._debug("search: Success");
                    resolve(jsonResult.vids);
                } else {
                    throw(new vaccinatorError("search: Result was not OK (Code " +
                                jsonResult.code+"-" + jsonResult.desc + ")", 
                                VACCINATOR_SERVICE, jsonResult.code));
                }
            }).catch(function(e) {
                throw(new vaccinatorError("search: URL request failed: [" + e + "]", 
                                VACCINATOR_SERVICE));
            });
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
            this._debug("getAppId: Return already cached app-id");
            return new Promise(function(resolve, reject) {
                resolve(that.appId);
            });
        }
        // try getting it from database
        this._debug("getAppId: Read app-id from database");
        var dbKey = "appId-" + this.userName;
        return localforage.getItem(dbKey).then(function (value) {
            var appId = value;
            var key = that._getPasswordKey();
            if (key !== false) {
                appId = that._decrypt(value, key);
            }
            that._debug("getAppId: Return app-id [" + appId + "]");
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
     * Enable direct login. By this, the protocol is enhanced by adding
     * sid and spwd values (serviceProviderId and serviceProviderPwd).
     * This is needed to directly access the DataVaccinator without any
     * intermediate or proxy instance.
     * Set serviceProviderId = 0 and serviceProviderPwd = "" to turn off.
     * 
     * @param {int} serviceProviderId 
     * @param {string} serviceProviderPwd 
     */
    enableDirectLogin(serviceProviderId, serviceProviderPwd) {
        if (serviceProviderId == 0 || serviceProviderPwd == "") {
            this.sid = 0;
            this.spwd = "";
            this._debug("Disabled direct login");
            return true;
        }
        this.sid = serviceProviderId;
        this.spwd = serviceProviderPwd;
        this._debug("Enabled direct login for service provider id [" + serviceProviderId + "]");
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
        var key = this._getPasswordKey();
        var store = "";
        if (key !== false) {
            // save encrypted
            store = this._encrypt(appId, key);
        } else {
            store = appId;
        }
        this._debug("_saveAppId: Store/update app-id in local storage");
        var dbKey = "appId-" + this.userName;
        this.appId = appId; // keep local
        return localforage.setItem(dbKey, store);
    }

    /**
     * Calculates the SHA256 from the known user password.
     * Returns false in case there is no valid password.
     * Note: This is only used for storing the App-ID in local browser cache.
     * 
     * @returns {Uint8Array}
     */
    _getPasswordKey() {
        if (this.password !== undefined && this.password !== "") {
            this._debug("Calculate sha256 from password");
            var sha256 = this._hash(this.password);
            return this._hex2buf(sha256);
        }
        this._debug("No password defined (_getPasswordKey -> false)");
        return false;

    }
    
    /**
     * Calculates the SHA256 from the current App-ID.
     * Returns false in case there is no valid App-ID.
     * 
     * @returns {Uint8Array}
     */
    _getKey() {
        if (this.appId !== undefined) {
            this._debug("Calculate sha256 from appId as crypto key");
            var sha256 = this._hash(this.appId);
            return this._hex2buf(sha256);
        }
        this._debug("No App-ID defined (_getKey -> false)");
        return false;

    }

    /**
     * Generate some random number Array with given
     * byte length. Uses Math.random()!
     * 
     * @param {int} bytes
     * @returns {Array}
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
     * @param {array} key 
     * @param {string} addChecksum (optional)
     * @returns {string} encryptedHEX
     */
    _encrypt(data, key, addChecksum) {
        var iv = this._generateRandom(16); // 128 bits iv
        if (this.debugging) {
            this._debug("_encrypt: Encrypt with key ["+this._buf2hex(key)+"] "+
                        "and iv ["+this._buf2hex(iv)+"]"); 
        }
        
        var aesCbc = new aesjs.ModeOfOperation.cbc(key, iv);
        
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
     * @param {array} key
     * @param {string} verifyChecksum (optional)
     * @returns {string} decryptedText
     */
    _decrypt(data, key, verifyChecksum) {
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
            this._debug("_decrypt: Decrypt with key ["+this._buf2hex(key)+
                        "] and iv ["+this._buf2hex(iv)+"] and checksum [" + 
                        verifyChecksum + "]"); 
        }
        // var dec = new JSChaCha20(password, iv).decrypt(data);
        var aesCbc = new aesjs.ModeOfOperation.cbc(key, iv);
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
     * @param {string} vid 
     * @param {string} vData 
     * @returns {boolean}
     */
    async _storeCache(vid, vData) {
        if (!this.useCache) {
            return true;
        }
        var that = this;
        return this._ensureCacheLoaded()
        .then(function() {
            var dbKey = that._hash(vid);
            that._debug("_storeCache: Storing vData for VID " + vid + " in cache");
            that.cache[dbKey] = vData;
            return localforage.setItem("vData", that.cache).then(function (value) {
                return true;
            }).catch(function (error) {
                throw(new vaccinatorError("_storeCache: Failed storing vData (store) [" + 
                                          error + "]", VACCINATOR_UNKNOWN));
            });
        });
    }

    /**
     * Getdata from cache. Will return null if not found!
     * 
     * @param {string} vid 
     * @returns {string}
     */
    async _retrieveCache(vid) {
        if (!this.useCache) {
            return null;
        }
        var that = this;
        return this._ensureCacheLoaded()
        .then(function() {
            var dbKey = that._hash(vid);
            that._debug("_retrieveCache: Retrieve vData for VID " + vid + 
                        " from cache");
            // use cache object
            return new Promise(function(resolve, reject) {
                resolve(that.cache[dbKey]);
            });
        });
    }

    /**
     * Removes one given entry from the cache
     * 
     * @param {array} vids
     * @returns {boolean}
     */
    async _removeCache(vids) {
        var that = this;
        return this._ensureCacheLoaded().then(function() {
            vids.forEach(function(item, index) {
                var dbKey = that._hash(item);
                delete that.cache[dbKey];
            });
            return localforage.setItem("payload", that.cache).then(function (value) {
                that._debug("_removeCache: Removed payload for VID(s) " + 
                            JSON.stringify(vids) + " from cache");
                return true;
            }).catch(function (error) {
                throw(new vaccinatorError("_removeCache: Failed storing payload (remove) [" + 
                                          error + "]", VACCINATOR_UNKNOWN));
            });
        });
    }

    /**
     * Make sure that the local cache is read and actual
     * 
     * @returns {boolean}
     */
    async _ensureCacheLoaded() {
        if (!this.useCache) {
            return;
        }
        var that = this;
        if (Object.keys(this.cache).length === 0) {
            // initially, need to get cache from database
            this._debug("_ensureCacheLoaded: Restore cache from local storage");
            return localforage.getItem("payload")
            .then(function(payload) {
                if (payload === null) { payload = {}; }
                that.cache = payload;
                that._debug("_ensureCacheLoaded: Restored cache with " + 
                            Object.keys(that.cache).length + " objects");
                return;
            }).catch(function (error) {
                throw(new vaccinatorError("_ensureCacheLoaded: Failed database access [" + 
                                          error + "]", VACCINATOR_UNKNOWN));
            });
        }
        // nothing to do
        return new Promise(function(resolve, reject) {
            that._debug("_ensureCacheLoaded: Cache is loaded");
            resolve(true);
        });
    }
    
    /**
     * Generates the SearchHash from given word. If withRandom is true,
     * zero to 5 random bytes are getting added. See search Plugin documentation.
     * 
     * @param {string} word
     * @param {boolean} withRandom (optional)
     * @returns {string}
     */
    _searchHash(word, withRandom) {
        if (word === "" || word === undefined) { return ""; }
        if (withRandom === undefined) {
            withRandom = false;
        }
        var searchHash = "";
        // init, see docs
        var h = "f1748e9819664b324ae079a9ef22e33e9014ffce302561b9bf71a37916c1d2a3";
        var letters = word.split("");
        for (var l of letters) {
            h = this._hash(l.toLowerCase() + h + this.appId);
            searchHash += h.substr(0, 2);
        }
        if (withRandom) {
            var c = Math.floor(Math.random() * 6);
            // generate random hex bytes only (0-f), so we need double of c
            for (let i = 0; i < c*2; ++i) {
                searchHash += (Math.floor(Math.random() * 16)).toString(16);
            }
        }
        // Limit search hashes to 254 bytes (127 characters) to fit
        // dataVaccinator database table "search"."WORD" maximum length.
        return searchHash.substr(0, 254);
    }
    
    /**
     * Generate the array of SearchHash values for DataVaccinator protocol use.
     * Ued for userNew() and userUpdate() function.
     * Quickly returns empty array if search functionality is not used.
     * 
     * @param {string|object} vData
     * @returns {array} searchwords
     */
    _getSearchWords(vData) {
        if (this.searchFields.length === 0) {
            return [];
        }
        if (typeof vData === 'string') {
            // convert to object
            vData = JSON.parse(vData);
        }
        var ret = [];
        var words = [];
        for (var w of this.searchFields) {
            var value = vData[w];
            if (value === "") { continue; }
            // split single words using " ,.+-/\" and linebreak
            words = value.split(/[\s,\.\+\-\/\\$]+/g);
            for (var p of words) {
                if (p !== "" && p !== undefined) {
                    ret.push(this._searchHash(p, true));
                }
            }
        }
        this._debug("_getSearchWords: SearchWords are " + JSON.stringify(ret));
        return ret;
    }

    // Compatibility function calls to provide compatibility with
    // existing applications
    // May 2020
    async userNew(vData) { return this.new(vData); }
    async userUpdate(vid, vData) { return this.update(vid, vData); }
    async userDelete(vids) { return this.delete(vids); }
    async userGet(vids) { return this.get(vids); }
    async userWipe(vids) { return this.wipe(vids); }

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