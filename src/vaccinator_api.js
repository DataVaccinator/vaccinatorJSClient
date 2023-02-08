/// <reference path="./vaccinator_api.d.ts" />

/**
 * vaccinatorJsClient class module
 * @license MIT License
 * @link https://www.datavaccinator.com
 * See github LICENSE file for license text.
 */
class vaccinator {
  constructor() {
    /** @private */
    this.url = "";           // current class connection to service URL
    /** @private */
    this.userName = "";      // currently used userName
    /** @private */
    this.password = "";      // currently used password
    /** @public */
    this.appId = "";         // currently used App ID
    /** @public */
    this.debugging = false;  // if debugging is activated
    /** @private */
    this.headers = {};       // optional additional headers to add to fetch requests
    /** @public */
    this.useCache = true;    // status for cache usage (initially true)
    /** @private */
    this.cache = {};         // cache object (hold in memory)
    /** @private */
    this.searchFields = [];  // currently used search fields
    /** @private */
    this.sid = 0;            // current service provider id (enableDirectLogin)
    /** @private */
    this.spwd = "";          // current service provider password (enableDirectLogin)
    /** @private */
    this.db;                 // current database handle
    /** @public */
    this.fromCache = [];     // a list of vids retrieved from cache in last get call
  }

  /**
   * @param {string} url 
   * @param {string} userName
   * @param {string?} appId
   * @param {string?} password
   * @param {boolean?} debugMode
   * @returns {Promise<boolean>} self
   */
  async init(url, userName, appId, password, debugMode) {
    // initialize the common parameters
    var that = this;
    return new Promise(async (resolve, reject) => {
      if (url === undefined || userName === undefined ||
        url === "" || userName === "") {
        reject(new vaccinatorError("init: url and userName parameter are mandatory",
          VACCINATOR_INVALID));
        return;
      }
      if (debugMode !== undefined) { that.debugging = debugMode; }

      if (appId !== undefined && appId !== "") {
        if (!that.validateAppId(appId)) {
          reject(new vaccinatorError("init: given appId does not validate!",
            VACCINATOR_INVALID));
          return;
        }
      };

      // init database
      that.db = localforage.createInstance({ name: 'vaccinator-' + userName });

      if (!that.db.supports(localforage.INDEXEDDB)) {
        reject(new vaccinatorError("init: please use an up to date webbrowser (no IndexedDB supported)",
          VACCINATOR_UNKNOWN));
        return;
      }

      that.url = url;
      that.userName = userName;
      that.appId = appId;
      that.password = password;
      if (appId !== undefined && appId !== "") {
        that._saveAppId(appId);
      } else {
        that.appId = undefined;
      }

      // remove possible artefacts from a previous caching bug
      // this can get removed in Q1/2022
      await localforage.dropInstance({ name: 'vaccinator database' });

      // restore cache object
      that._debug("Initialization done");
      resolve(true);
    });
  }

  /**
   * 
   * @private
   * @param {string} vData 
   * @param {boolean} publishing 
   * @param {string} password 
   * @param {int} duration 
   * @returns {Promise<string>} vid
   */
  async _new(vData, publishing, password, duration) {
    var that = this;
    return new Promise((resolve, reject) => {
      if (vData === undefined || vData === "") {
        reject(new vaccinatorError("new: vData parameter is mandatory",
          VACCINATOR_INVALID));
        return;
      }
      that.getAppId()
      .then((aid) => {
        var operation, payload;
        if (publishing) {
          var sha256 = that._hash(password);
          payload = that._encrypt(vData, that._hex2buf(sha256));
          operation = "publish";
        } else {
          payload = that._encrypt(vData, that._getKey(), aid.substr(-2));
          operation = "add";
        }

        var request = {
          op: operation,
          version: 2,
          data: payload,
          uid: that.userName,
          words: that._getSearchWords(vData)
        };
        if (that.sid > 0 && that.spwd !== "") {
          request.sid = that.sid;
          request.spwd = that.spwd;
        }
        if (publishing) {
          request.duration = duration;
        }
        var jsonString = JSON.stringify(request);
        var post = new FormData();
        post.append("json", jsonString);
        var params = {
          method: "POST",
          body: post,
          headers: that.headers
        };
        that._debug("new: Protocol call: [" + jsonString +
          "] to url [" + that.url + "]");
        fetch(that.url, params)
          .then((response) => {
            if (response.status !== 200) {
              reject(new vaccinatorError("new: URL request failed with status " +
                response.status, VACCINATOR_SERVICE));
              return;
            }
            return response.json();
          })
          .then((jsonResult) => {
            if (jsonResult.status === "OK") {
              if (publishing) {
                that._debug("new: Returning new published VID [" + jsonResult.vid + "]");
                resolve(jsonResult.vid);
              } else {
                that._storeCache(jsonResult.vid, vData)
                  .then(() => {
                    that._debug("new: Returning new VID [" + jsonResult.vid + "]");
                    resolve(jsonResult.vid);
                  });
              }
            } else {
              reject(new vaccinatorError("new: Result was not OK (Code " +
                jsonResult.code + " - " + jsonResult.desc + ")",
                VACCINATOR_SERVICE, jsonResult.code));
              return;
            }
          }).catch((e) => {
            reject(new vaccinatorError("new: Generic issue: [" + e + "]",
              VACCINATOR_UNKNOWN));
          });
      });
    });
  }

  /**
   * @param {string} vData 
   * @returns {Promise<string>} vid
   */
  async new(vData) {
    // TODO: Enhance memory footprint by submitting vData to _new() by reference
    return await this._new(vData, false, "", 0);
  }

  /**
   * @param {string} vData 
   * @returns {Promise<Promise<string>>} vid
   */
  async publish(vData, password, duration) {
    var that = this;
    return new Promise((resolve, reject) => {
      if (password === undefined || password === "") {
        reject(new vaccinatorError("publish: password is not set",
          VACCINATOR_INVALID));
        return;
      }
      if (duration === undefined || duration < 1 || duration > 365) {
        reject(new vaccinatorError("publish: duration out of range",
          VACCINATOR_INVALID));
        return;
      }
      // TODO: Enhance memory footprint by submitting vData to _new() by reference
      resolve(that._new(vData, true, password, duration));
    });
  }

  /**
   * @param {string} vid
   * @param {string} vData 
   * @returns {Promise<string>} vid
   */
  async update(vid, vData) {
    var that = this;
    return new Promise((resolve, reject) => {
      if (vid === undefined || vid === "" ||
        vData === undefined || vData === "") {
        reject(new vaccinatorError("update: vid and vData parameter are mandatory",
          VACCINATOR_INVALID));
        return;
      }
      that.getAppId()
        .then((aid) => {
          var request = {
            op: "update",
            version: 2,
            vid: vid,
            data: that._encrypt(vData, that._getKey(), aid.substr(-2)),
            uid: that.userName,
            words: that._getSearchWords(vData)
          };
          if (that.sid > 0 && that.spwd !== "") {
            request.sid = that.sid;
            request.spwd = that.spwd;
          }
          var jsonString = JSON.stringify(request);
          var post = new FormData();
          post.append("json", jsonString);
          var params = {
            method: "POST",
            body: post,
            headers: that.headers
          };
          that._debug("update: Protocol call: [" + jsonString +
            "] to url [" + that.url + "]");
          fetch(that.url, params)
            .then((response) => {
              if (response.status !== 200) {
                reject(new vaccinatorError("update: URL request failed with status " +
                  response.status, VACCINATOR_SERVICE));
                return;
              }
              return response.json();
            }).then((jsonResult) => {
              if (jsonResult.status === "OK") {
                that._storeCache(vid, vData).then(() => {
                  that._debug("update: Returning updated VID [" + vid + "]");
                  resolve(vid);
                });
              } else {
                reject(new vaccinatorError("update: Result was not OK (Code " +
                  jsonResult.code + " - " + jsonResult.desc + ")",
                  VACCINATOR_SERVICE, jsonResult.code));
                return;
              }
            }).catch((e) => {
              reject(new vaccinatorError("update: Generic issue: [" + e + "]",
                VACCINATOR_UNKNOWN));
            });
        });
    });
  }

  /**
   * @param {string|string[]} vids
   * @returns {Promise<string>} vids
   */
  async delete(vids) {
    var that = this;
    return new Promise((resolve, reject) => {
      if (vids === undefined || vids === "") {
        reject(new vaccinatorError("delete: vids parameter is mandatory",
          VACCINATOR_INVALID));
      }
      if (!Array.isArray(vids)) { vids = vids.split(" "); }
  
      if (vids.length > 500) {
        // too many vids per request
        reject(new vaccinatorError("delete: Max 500 vids allowed per request! Please try to chunk your calls.",
          VACCINATOR_INVALID));
      }
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
      var jsonString = JSON.stringify(request);
      var post = new FormData();
      post.append("json", jsonString);
      var params = {
        method: "POST",
        body: post,
        headers: that.headers
      };
      that._debug("delete: Protocol call: [" + jsonString +
        "] to url [" + that.url + "]");
      fetch(that.url, params)
      .then((response) => {
        if (response.status !== 200) {
          reject(new vaccinatorError("delete: URL request failed with status " +
            response.status, VACCINATOR_SERVICE));
          return;
        }
        return response.json();
      }).then((jsonResult) => {
        if (jsonResult.status === "OK") {
          that._debug("delete: Success");
          // TODO: Do not remove from cache if it was published.
          return that._removeCache(vids).then(() => {
            resolve(vids);
          });
        } else {
          reject(new vaccinatorError("delete: Result was not OK (Code " +
            jsonResult.code + " - " + jsonResult.desc + ")",
            VACCINATOR_SERVICE, jsonResult.code));
          return;
        }
      }).catch((e) => {
        reject(new vaccinatorError("delete: Generic issue: [" + e + "]",
          VACCINATOR_UNKNOWN));
      });
    });
  }

  /**
   * @param {string|string[]} vids
   * @returns {Promise<string>}
   */
  async get(vids) {
    var that = this;
    return new Promise((resolve, reject) => {

      if (vids === undefined || vids === "") {
        reject(new vaccinatorError("get: vids parameter is mandatory",
          VACCINATOR_INVALID));
      }
      if (!Array.isArray(vids)) { vids = vids.split(" "); }

      // check for the cached vids first

      var uncached = []; // will get the uncached vids
      var finalResult = new Object(); // compose result
      var promises = []; // will hold the promises
      that.fromCache = []; // init
      vids.map((vid) => {
        // create an array of promises for cache check (use with Promise.all)
        promises.push(that._retrieveCache(vid)
          .then((vData) => {
            if (vData === null || vData === undefined) {
              uncached.push(vid);
              that._debug("get: Add vid [" + vid + "] for getting from server");
              return;
            }
            that.fromCache.push(vid);
            that._debug("get: Retrieve cached vData for vid [" + vid + "]");
            var r = { "status": "OK", "data": vData };
            finalResult[vid] = r;
            return;
          }));
      });

      return Promise.all(promises)
      .then(() => {
        // Retrieve missing VIDs from server
        if (uncached.length > 500) {
          // too many vids per request
          reject(new vaccinatorError("get: Max 500 vids allowed per request! Please try to chunk your calls.",
            VACCINATOR_INVALID));
          return;
        }

        var requestVIDs = uncached.join(" ");
        if (requestVIDs === "") {
          // nothing to get from vaccinator service (all from cache)
          resolve(finalResult);
          return;
        }

        that.getAppId() // ensure appid is in memory
        .then((aid) => {
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
          var jsonString = JSON.stringify(request);
          var post = new FormData();
          post.append("json", jsonString);
          var params = {
            method: "POST",
            body: post,
            headers: that.headers
          };
          that._debug("get: Protocol call: [" + jsonString +
            "] to url [" + that.url + "]");
          fetch(that.url, params)
          .then((response) => {
            if (response.status !== 200) {
              reject(new vaccinatorError("get: URL request failed with status " +
                response.status, VACCINATOR_SERVICE));
              return;
            }
            return response.json();
          }).then((jsonResult) => {
            if (jsonResult.status !== "OK") {
              reject(new vaccinatorError("get: Result was not OK (Code " +
                jsonResult.code + " - " + jsonResult.desc + ")",
                VACCINATOR_SERVICE, jsonResult.code));
              return;
            }
            that._debug("get: Successfully received vData. Processing...");
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
                  console.error("Unable to decrypt vData [" + vid +
                    "] because used appId seems not the correct one or " +
                    "some crypto error occured! " +
                    "Origin error: [" + e.toString() + "]");
                  // cleanup failing dataset
                  data[vid]["status"] = "ERROR";
                  data[vid]["data"] = false;
                }
              };
            }
            // merge cached and service results
            return Promise.all(storePromises)
              .then(() => {
                finalResult = Object.assign({}, data, finalResult);
                that._debug("get: Finished");
                resolve(finalResult);
              });
          }).catch((e) => {
            reject(new vaccinatorError("get: Generic issue: [" + e + "]",
              VACCINATOR_UNKNOWN));
          });
        });
      });
    });
  }

  /**
   * @param {string|string[]} vids
   * @returns {Promise<string>}
   */
  async getPublished(vids, password) {
    var that = this;
    return new Promise((resolve, reject) => {
      if (vids === undefined || vids === "") {
        reject(new vaccinatorError("getPublished: vids parameter is mandatory",
          VACCINATOR_INVALID));
        return;
      }
      if (password === undefined || password === "") {
        reject(new vaccinatorError("getPublished: password is not set",
          VACCINATOR_INVALID));
        return;
      }
      if (!Array.isArray(vids)) { vids = vids.split(" "); }

      if (vids.length > 500) {
        // too many vids per request
        reject(new vaccinatorError("getPublished: Max 500 vids allowed per request! Please try to chunk your calls.",
          VACCINATOR_INVALID));
        return;
      }

      // prepare POST call
      vids = vids.join(" ");

      that.getAppId()
      .then((aid) => {
        var request = {
          op: "getpublished",
          version: 2,
          vid: vids,
          uid: that.userName
        };
        if (that.sid > 0 && that.spwd !== "") {
          request.sid = that.sid;
          request.spwd = that.spwd;
        }
        var jsonString = JSON.stringify(request);
        var post = new FormData();
        post.append("json", jsonString);
        var params = {
          method: "POST",
          body: post,
          headers: that.headers
        };
        that._debug("getPublished: Protocol call: [" + jsonString +
          "] to url [" + that.url + "]");
        fetch(that.url, params)
        .then((response) => {
          if (response.status !== 200) {
            reject("getPublished: URL request failed with status " + response.status);
            return null;
          }
          return response.json();
        }).then((jsonResult) => {
          if (jsonResult === null) {
            reject("getPublished: URL request returned no json.");
            return;
          }
          if (jsonResult.status === "OK") {
            that._debug("getPublished: Successfully received vData. Processing...");
            // decrypt vData
            var data = jsonResult.data;
            var checksum = that.appId.substr(-2, 2); // current appId checksum
            var pwd = that._hex2buf(that._hash(password)); // prepare password
            for (var vid of Object.keys(data)) {
              if (data[vid]["status"] === "OK") {
                try {
                  data[vid]["data"] = that._decrypt(data[vid]["data"], pwd);
                } catch (e) {
                  // very likely the checksum did not match!
                  console.error("Unable to decrypt vData [" + vid +
                    "] because used password seems not the correct one or " +
                    "some crypto error occured! " +
                    "Origin error: [" + e.toString() + "]");
                  // cleanup failing dataset
                  data[vid]["status"] = "ERROR";
                  data[vid]["data"] = false;
                }
              }
            };
            resolve(data);

          } else {
            reject("getPublished: Result was not OK (Code " +
              jsonResult.code + " - " + jsonResult.desc + ")");
            return;
          }
        });
      }).catch((e) => {
        reject(new vaccinatorError("getPublished: Generic issue: [" + e + "]",
          VACCINATOR_SERVICE));
      });
    })
  }

  /**
   * @param {string|string[]} vids
   * @returns {Promise<string>} vids
   */
  async wipe(vids) {
    var that = this;
    return new Promise((resolve, reject) => {
      if (vids === undefined || vids === "") {
        reject(new vaccinatorError("wipe: vids parameter is mandatory",
          VACCINATOR_INVALID));
        return;
      }
      if (!Array.isArray(vids)) { vids = vids.split(" "); }

      that._removeCache(vids)
      .then(() => {
        return resolve(vids);
      }).catch((error) => {
        reject(new vaccinatorError("wipe: Failed wipe [" + error + "]",
          VACCINATOR_UNKNOWN));
      });;
    });
  }

  /**
   * @param {string|string[]} vids
   * @param {string} oldAppId
   * @param {string} newAppId
   * @returns {Promise<int>} affectedCount
   */
  async changeAppId(vids, oldAppId, newAppId) {
    var that = this;
    return new Promise((resolve, reject) => {
      if (vids === undefined || vids === "") {
        reject(new vaccinatorError("changeAppId: vids parameter is mandatory",
          VACCINATOR_INVALID));
        return;
      }
      if (oldAppId === undefined || oldAppId === "" ||
        newAppId === undefined || newAppId === "") {
        reject(new vaccinatorError("changeAppId: oldAppId and newAppId are mandatory",
          VACCINATOR_INVALID));
        return;
      }
      if (oldAppId !== that.appId) {
        reject(new vaccinatorError("changeAppId: oldAppId must be identical to current appId",
          VACCINATOR_INVALID));
        return;
      }
      if (!that.validateAppId(newAppId)) {
        reject(new vaccinatorError("changeAppId: given new appId does not validate!",
          VACCINATOR_INVALID));
        return;
      }

      if (!Array.isArray(vids)) { vids = vids.split(" "); }

      that.get(vids)
      .then((vDataArray) => {
        // vDataArray should contain absolut all vData to
        // re-encrypt

        // create new vaccinator class with new AppId
        var newVac = new vaccinator();
        newVac.setHeaders(that.headers); // duplicate headers to use
        newVac.init(that.url, that.userName, newAppId, that.password, that.debugging)
        .then(() => {
            var promises = []; // will hold the promises
            for (let i = 0; i < vids.length; i++) {
              // loop all vids and retrieved content
              let vid = vids[i];
              if (vDataArray[vid]["status"] === "OK") {
                that._debug("Store new dataset for [" + vid + "]");
                promises.push(newVac.update(vid, vDataArray[vid]["data"])
                  .then((vid) => {
                    return vid;
                  })
                );
              } else {
                that._debug("Failed retrieving vData for VID [" + vid + "] (no data?).");
              }
            }
            Promise.all(promises)
            .then((vids) => {
              newVac = null; // destroy instance
              // from now on, the new appId must get used:
              that._saveAppId(newAppId)
              .then(() => {
                resolve(vids.length);
              });
            });
        });
      });
    });
  }

  /**
   * @param {string?} token
   * @returns {Promise<boolean>}
   */
  async wipeCache(token) {
    var that = this;
    return new Promise(async (resolve, reject) => {
      if (token !== undefined && token !== "") {
        // need to check if wipe is needed
        try {
          var knownToken = await that.db.getItem("payloadToken");
        
          if (knownToken === token) {
            that._debug("wipeCache: No need to wipe cache (known token)");
            return resolve(false); // no need to wipe
          }
          that._wipeCache(token)
          .then(() => {
            return resolve(true);
          });
        } catch(error) {
          reject(new vaccinatorError("Failed reading payloadToken [" + error + "]",
            VACCINATOR_UNKNOWN));
          return;
        };
      }
      // without token, we're always wiping the cache
      that._wipeCache()
      .then(() => {
        return resolve(true);
      }).catch((error) => {
        reject(new vaccinatorError("Failed reading payloadToken [" + error + "]",
          VACCINATOR_UNKNOWN));
        return;
      });
    });
  }

  /**
   * @private
   * @param {string?} token
   * @returns {Promise<boolean>}
   */
  async _wipeCache(token) {
    // wipe
    this._debug("_wipeCache: Wiping cache");
    var that = this;
    return new Promise(async (resolve, reject) => {
      var appId = await that.db.getItem("appId-" + that.userName);
      
      await that.db.clear();

      await that.db.setItem("appId-" + that.userName, appId);
      
      if (token !== undefined && token !== "") {
        // need to save payloadToken
        that.db.setItem("payloadToken", token)
        .then(() => {
          that._debug("_wipeCache: New cache token is [" + token + "]");
          return resolve(true);
        });
      }
      return resolve(true);
    }).catch((error) => {
      reject(new vaccinatorError("Failed storing wiped cache [" + error + "]",
        VACCINATOR_UNKNOWN));
      return;
    });
  }

  /**
   * @returns {Promise<Array<any>>}
   */
  async getServerInfo() {
    var that = this;
    return new Promise((resolve, reject) => {
      var request = {
        op: "check",
        version: 2,
        uid: that.userName
      };
      if (that.sid > 0 && that.spwd !== "") {
        request.sid = that.sid;
        request.spwd = that.spwd;
      }
      var jsonString = JSON.stringify(request);

      var post = new FormData();
      post.append("json", jsonString);
      var params = {
        method: "POST",
        body: post,
        headers: that.headers
      };
      that._debug("getServerInfo: Protocol call: [" + jsonString +
        "] to url [" + that.url + "]");
      fetch(that.url, params)
        .then((response) => {
          if (response.status !== 200) {
            reject(new vaccinatorError("getServerInfo: URL request failed with status " +
              response.status, VACCINATOR_SERVICE));
            return;
          }
          return response.json();
        }).then((jsonResult) => {
          if (jsonResult.status === "OK") {
            that._debug("getServerInfo: Success");
            resolve(jsonResult);
          } else {
            reject(new vaccinatorError("getServerInfo: Result was not OK (Code " +
              jsonResult.code + " - " + jsonResult.desc + ")",
              VACCINATOR_SERVICE, jsonResult.code));
            return;
          }
        }).catch((e) => {
          reject(new vaccinatorError("getServerInfo: Generic issue: [" + e + "]",
            VACCINATOR_UNKNOWN));
        });
    });
  }

  /**
   * @param {string[]?} fields
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
   * @param {string} searchTerm 
   * @returns {Promise<Array<string>>} vids array
   */
  async search(searchTerm) {
    var that = this;
    return new Promise((resolve, reject) => {
      var term = "";
      var words = searchTerm.split(/[\s,\.\+\-\/\\$]+/g);
      for (var w of words) {
        term += that._searchHash(w, false) + " ";
      }
      term = term.trim(); // remove last space
      if (term === "") {
        // no valid search term
        that._debug("search: Empty search does not trigger a call to server!");
        // resolve promise with empty result array
        return resolve([]);
      }

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
      var jsonString = JSON.stringify(request);
      var post = new FormData();
      post.append("json", jsonString);
      var params = {
        method: "POST",
        body: post,
        headers: that.headers
      };
      that._debug("search: Protocol call: [" + jsonString +
        "] to url [" + that.url + "]");
      fetch(that.url, params)
      .then((response) => {
        if (response.status !== 200) {
          reject(new vaccinatorError("search: URL request failed with status " +
            response.status, VACCINATOR_SERVICE));
          return;
        }
        return response.json();
      }).then((jsonResult) => {
        if (jsonResult.status === "OK") {
          that._debug("search: Success");
          resolve(jsonResult.vids);
        } else {
          reject(new vaccinatorError("search: Result was not OK (Code " +
            jsonResult.code + " - " + jsonResult.desc + ")",
            VACCINATOR_SERVICE, jsonResult.code));
          return;
        }
      }).catch((e) => {
        reject(new vaccinatorError("search: Generic issue: [" + e + "]",
          VACCINATOR_SERVICE));
        return;
      });
    });
  }

  /**
   * @returns {Promise<string>} app-id
   */
  async getAppId() {
    var that = this;
    return new Promise((resolve, reject) => {
      if (that.appId !== undefined) {
        // return known app-id
        that._debug("getAppId: Return already cached app-id");
        resolve(that.appId);
        return;
      }
      // try getting it from database
      that._debug("getAppId: Read app-id from database");
      var dbKey = "appId-" + that.userName;
      that.db.getItem(dbKey)
      .then((value) => {
        var appId = value;
        var key = that._getPasswordKey();
        if (key !== false) {
          appId = that._decrypt(value, key);
        }
        that._debug("getAppId: Return app-id [" + appId + "]");
        that.appId = appId; // cache
        resolve(appId);
      }).catch((error) => {
        reject(new vaccinatorError("No AppId saved, you have to supply it during " +
          "initialization [" + error + "]", VACCINATOR_INVALID));
        return;
      });
    });
  }

  /**
   * @param {string} appId 
   * @returns {boolean}
   */
  validateAppId(appId) {
    if (appId === undefined || appId === "" || appId.length < 4) {
      return false;
    }
    var cs = appId.substr(-2); // CheckSum from given AppId
    var sha256 = this._hash(appId.substr(0, appId.length - 2)); // hash from AppId - checksum
    var calcCs = sha256.substr(-2); // calculated checksum
    return (cs === calcCs); // must be identical
  }

  /**
   * @param {Headers} headersObj
   * @returns {boolean}
   */
  setHeaders(headersObj) {
    this._debug("Set additional headers for the class [" +
      JSON.stringify(headersObj) + "]");
    this.headers = headersObj;
    return true;
  }

  /**
   * @param {int} serviceProviderId 
   * @param {string} serviceProviderPwd
   * @returns {boolean}
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
   * @private
   * @param {string} appId
   * @returns {Promise<any>}
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
    return this.db.setItem(dbKey, store);
  }

  /**
   * Calculates the SHA256 from the known user password.
   * Returns false in case there is no valid password.
   * Note: This is only used for storing the App-ID in local browser cache.
   * 
   * @private
   * @returns {Uint8Array|false}
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
   * @private
   * @returns {Uint8Array|false}
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
   * @private
   * @param {int} bytes
   * @returns {Array<number>}
   */
  _generateRandom(bytes) {
    return Array.from({ length: bytes }, () => Math.floor(Math.random() * 255));
  }

  /**
   * Convert some array to hex encoded string
   * 
   * @private
   * @param {Array} buffer
   * @returns {ArrayBuffer}
   */
  _buf2hex(buffer) { // buffer is an ArrayBuffer
    return aesjs.utils.hex.fromBytes(buffer);
  }

  /**
   * Convert some hex encoded string to Uint8Array
   * 
   * @private
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
   * @private
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
   * @private
   * @param {string} data 
   * @param {ArrayBuffer} key 
   * @param {string?} addChecksum
   * @returns {string} encryptedHEX
   */
  _encrypt(data, key, addChecksum) {
    var iv = this._generateRandom(16); // 128 bits iv
    if (this.debugging) {
      this._debug("_encrypt: Encrypt with key [" + this._buf2hex(key) + "] " +
        "and iv [" + this._buf2hex(iv) + "]");
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
   * @private
   * @param {string} data
   * @param {ArrayBuffer} key
   * @param {string?} verifyChecksum
   * @returns {string} decryptedText
   */
  _decrypt(data, key, verifyChecksum) {
    var parts = data.split(":");
    if (parts[0] !== "aes-256-cbc") {
      throw (new vaccinatorError("unknown crypto recipt [" + parts[0] + "]",
        VACCINATOR_UNKNOWN));
    }
    var iv = "";
    var data = "";
    if (verifyChecksum !== undefined && verifyChecksum !== "") {
      if (verifyChecksum !== parts[1]) {
        throw (new vaccinatorError("_decrypt: Checksum does not match!",
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
      this._debug("_decrypt: Decrypt with key [" + this._buf2hex(key) +
        "] and iv [" + this._buf2hex(iv) + "] and checksum [" +
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
   * @private
   * @param {string} message 
   */
  _debug(message) {
    if (!this.debugging) { return; }
    console.debug("VACCINATOR: " + message);
  }

  // Cache functions

  /**
   * Store data in cache
   * 
   * @private
   * @param {string} vid 
   * @param {string} vData 
   * @returns {Promise<boolean>} success
   */
  async _storeCache(vid, vData) {
    var that = this;
    return new Promise(async (resolve, reject) => {
      if (!that.useCache) {
        return resolve(true);
      }
      that.db.setItem(vid, vData)
      .then(() => {
        that._debug("_storeCache: Stored vData for VID " + vid + " in cache");
        return resolve(true);
      }).catch((error) => {
        reject(new vaccinatorError("_storeCache: Failed storing vData (store) [" +
          error + "]", VACCINATOR_UNKNOWN));
      });;
    });
  }

  /**
   * Getdata from cache. Will return null if not found!
   * 
   * @private
   * @param {string} vid 
   * @returns {Promise<string|null>}
   */
  async _retrieveCache(vid) {
    var that = this;
    return new Promise(async (resolve, reject) => {
      if (!that.useCache) {
        return resolve(null);
      }
      // use cache object
      that._debug("_retrieveCache: Retrieve vData for VID " + vid +
        " from cache");
      that.db.getItem(vid)
      .then((vData) => {
        resolve(vData);
      }).catch((error) => {
        reject(new vaccinatorError("_retrieveCache: Failed retrieving vData (store) [" +
          error + "]", VACCINATOR_UNKNOWN));
      });
    });
  }

  /**
   * Removes one given entry from the cache
   * 
   * @private
   * @param {Array<string>} vids
   * @returns {Promise<boolean>}
   */
  async _removeCache(vids) {
    var that = this;
    return new Promise(async (resolve, reject) => {
      that.db.removeItems(vids)
      .then(() => {
        that._debug("_removeCache: Removed payload for VID(s) " +
          JSON.stringify(vids) + " from cache");
        resolve(true);
      }).catch((error) => {
        reject(new vaccinatorError("_removeCache: Failed removing payload (remove) [" +
          error + "]", VACCINATOR_UNKNOWN));
      });;
    }).catch((error) => {
      reject(new vaccinatorError("_removeCache: Failed removing payload (remove) [" +
        error + "]", VACCINATOR_UNKNOWN));
    });
  }

  /**
   * Generates the SearchHash from given word. If withRandom is true,
   * zero to 5 random bytes are getting added. See search Plugin documentation.
   * 
   * @private
   * @param {string} word
   * @param {boolean?} withRandom
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
      for (let i = 0; i < c * 2; ++i) {
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
   * @private
   * @param {string|object} vData
   * @returns {Array<string>} searchwords
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
  { name: { value: 'vaccinatorError', enumerable: false } }
);


// -----------------------
// LOCALFORAGE PLUGIN
// Download from here:
// https://github.com/localForage/localForage-removeItems/blob/master/dist/localforage-removeitems.js
// -----------------------

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('localforage')) :
  typeof define === 'function' && define.amd ? define(['exports', 'localforage'], factory) :
  (factory((global.localforageRemoveItems = global.localforageRemoveItems || {}),global.localforage));
}(this, (function (exports,localforage) { 'use strict';

localforage = 'default' in localforage ? localforage['default'] : localforage;

function executeCallback(promise, callback) {
  if (callback) {
      promise.then(function (result) {
          callback(null, result);
      }, function (error) {
          callback(error);
      });
  }
  return promise;
}

function removeItemsGeneric(keys, callback) {
  var localforageInstance = this;

  var itemPromises = [];
  for (var i = 0, len = keys.length; i < len; i++) {
      var key = keys[i];
      itemPromises.push(localforageInstance.removeItem(key));
  }

  var promise = Promise.all(itemPromises);

  executeCallback(promise, callback);
  return promise;
}

function removeItemsIndexedDB(keys, callback) {
  var localforageInstance = this;
  var promise = localforageInstance.ready().then(function () {
      return new Promise(function (resolve, reject) {
          var dbInfo = localforageInstance._dbInfo;
          var transaction = dbInfo.db.transaction(dbInfo.storeName, 'readwrite');
          var store = transaction.objectStore(dbInfo.storeName);
          var firstError;

          transaction.oncomplete = function () {
              resolve();
          };

          transaction.onabort = transaction.onerror = function () {
              if (!firstError) {
                  reject(transaction.error || 'Unknown error');
              }
          };

          function requestOnError(evt) {
              var request = evt.target || this;
              if (!firstError) {
                  firstError = request.error || request.transaction.error;
                  reject(firstError);
              }
          }

          for (var i = 0, len = keys.length; i < len; i++) {
              var key = keys[i];
              if (typeof key !== 'string') {
                  console.warn(key + ' used as a key, but it is not a string.');
                  key = String(key);
              }
              var request = store.delete(key);
              request.onerror = requestOnError;
          }
      });
  });
  executeCallback(promise, callback);
  return promise;
}

function executeSqlAsync(transaction, sql, parameters) {
  return new Promise(function (resolve, reject) {
      transaction.executeSql(sql, parameters, function () {
          resolve();
      }, function (t, error) {
          reject(error);
      });
  });
}

function removeItemsWebsql(keys, callback) {
  var localforageInstance = this;
  var promise = localforageInstance.ready().then(function () {
      return new Promise(function (resolve, reject) {
          var dbInfo = localforageInstance._dbInfo;
          dbInfo.db.transaction(function (t) {
              var storeName = dbInfo.storeName;

              var itemPromises = [];
              for (var i = 0, len = keys.length; i < len; i++) {
                  var key = keys[i];
                  if (typeof key !== 'string') {
                      console.warn(key + ' used as a key, but it is not a string.');
                      key = String(key);
                  }
                  itemPromises.push(executeSqlAsync(t, 'DELETE FROM ' + storeName + ' WHERE key = ?', [key]));
              }

              Promise.all(itemPromises).then(resolve, reject);
          }, function (sqlError) {
              reject(sqlError);
          });
      });
  });
  executeCallback(promise, callback);
  return promise;
}

function localforageRemoveItems() /*keys, callback*/{
  var localforageInstance = this;
  var currentDriver = localforageInstance.driver();

  if (currentDriver === localforageInstance.INDEXEDDB) {
      return removeItemsIndexedDB.apply(localforageInstance, arguments);
  } else if (currentDriver === localforageInstance.WEBSQL) {
      return removeItemsWebsql.apply(localforageInstance, arguments);
  } else {
      return removeItemsGeneric.apply(localforageInstance, arguments);
  }
}

function extendPrototype(localforage$$1) {
  var localforagePrototype = Object.getPrototypeOf(localforage$$1);
  if (localforagePrototype) {
      localforagePrototype.removeItems = localforageRemoveItems;
      localforagePrototype.removeItems.indexedDB = function () {
          return removeItemsIndexedDB.apply(this, arguments);
      };
      localforagePrototype.removeItems.websql = function () {
          return removeItemsWebsql.apply(this, arguments);
      };
      localforagePrototype.removeItems.generic = function () {
          return removeItemsGeneric.apply(this, arguments);
      };
  }
}

var extendPrototypeResult = extendPrototype(localforage);

exports.localforageRemoveItems = localforageRemoveItems;
exports.extendPrototype = extendPrototype;
exports.extendPrototypeResult = extendPrototypeResult;
exports.removeItemsGeneric = removeItemsGeneric;

Object.defineProperty(exports, '__esModule', { value: true });

})));
