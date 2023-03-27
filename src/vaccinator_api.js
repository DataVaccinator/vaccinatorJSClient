/*	type definitons
    ======================================================================= */
/**
 * @typedef {Object} DvConfig
 * @property {string} serviceUrl serviceURl is the URL where the API endpoint at the service provider is located. For example: https://service-provider.tld/protocol. All POST calls of the API will be sent to this destination. Please note that "same origin" policy might affect this. In the best case, this is the same domain than your app is running at.
 * @property {string} userIdentifier user-identifier is some mandatory identifier that the class is using to handle different aspects of saving user related information (like app-id). Also, the class is submitting this information as uid parameter in all protocol calls to the service provider. We suggest to use the name of the user who is using your application (eg email address).
 * @property {string?} appId app-id is the end users application password for additional encryption. The vaccinator class expects some app-id known. If not submitted or undefined, the class is trying to get it from previous calls (local database). It throws an error if this fails.
 * @property {string?} password password is used to encrypt the app-id in the local storage database. If not submitted or undefined, the app-id will get stored without any encryption (not recommended). We recommend to submit the password the user entered for log-in to your application or some organization password. By this, the local database will not leak the app-id in case someone is trying to read the browser database.
 * @property {boolean?} useCache Set to false to disable any local caching. We suggest to not turn caching on/off during a working session.  Default is `true`.
 * @property {boolean?} debugMode Set debugMode to true in order to activate debug output to browser console. Mainly for finding bugs by the developer of DataVaccinator class but maybe also helpful for you. Default is `false`.
 * @property {Headers?} headers Define additional header values to send on service requests.
 * @property {Array<string>?} searchFields Here you submit an array of field names to be used for search function. If your payload is JSON and contains values for the given fields, they will get uploaded as SearchHash to the DataVaccinator Vault. This then allows you to find the assigned VIDs later using the search function. To disable the feature, submit an empty array or no parameter.
 * @property {{serviceProviderId:int, serviceProviderPwd:string}?} direktLogin Enable direct login. By this, the protocol is enhanced by adding sid and spwd values (serviceProviderId and serviceProviderPwd). This is needed to directly access the DataVaccinator Vault without any intermediate or proxy instance.
*/
/** @typedef {{data: string|Object, status?: string}} VData */
/**@typedef {'AES-CBC'|'AES-GCM'} EncryptionMode */


/*	constants
    ======================================================================= */
    const kVaccinatorServiceErrorCode = 0 // error is related to vaccinator service
    , kVaccinatorInvalidErrorCode = 1 // error is related to bad input parameters
    , kVaccinatorUnknonwErrorCode = 9 // unknown relation of error
    , kXhrTimeout = 5 * 1000
    , kChecksumLength = 2 // Checksum characters (2 characters are 1 Byte in Hex). Used in App-Id.
    , kVidStringSeperator = " "
    , kWordSplitRegex = /[\s,\.\+\-\/\\$]+/g
    , kHex = '0123456789abcdef';


/*	DvError class
    ======================================================================= */
/** DataVaccinator error class. */
class DvError extends Error {
    /**
     * @param {any} error
     * @param {number?} code
     */
    constructor(error, code) {
        if(error instanceof Error) {
            super();
            this.message = error.message; // assign properties from orign error.
            this.name = error.name;
            this.stack = error.stack;
        } else if(error instanceof Object) {
            super(JSON.stringify(error));
        } else { // handles as string
            super(error);
        }

        // extend the error class
        /**
         * @public
         * @type {number?}
         */
        this.code = code;
        /**
         * Holds the original error with type.
         * @public
         * @type {Error|string}
         * @example
         * if(error instanceof DvError) {
         *      // The error was thrown inside the vaccinator class.
         *      if(error.origin instanceof EvalError) {
         *          // the origin of this error is an EvalError.
         *      }
         * }
         */
        this.origin = error;
    }
}


/*	Vaccinator class
    ======================================================================= */
/**
 * vaccinatorJsClient class module
 *
 * @license MIT License
 * @link https://www.datavaccinator.com
 * See github LICENSE file for license text.
 */
class Vaccinator {

    /** @param {DvConfig} config */
     constructor(config) {
        if(!config) throw EvalError('config can not be null!');

        /**
         * Cache config for the {@link changeAppId} function.
         * @type {DvConfig}
         * @private */
        this._config = config;
        /**
         * Current class connection to service URL.
         * @private */
        this._serviceUrl = config.serviceUrl ?? "";
        /**
         * Currently used userName.
         * @private */
        this._userIdentifier = config.userIdentifier ?? "";
        /**
         * Currently used password.
         * @private */
        this._password = config.password ?? "";
        /**
         * Currently used App ID.
         * @private */
        this._appId = config.appId ?? undefined;
        /**
         * If true, this class will print debug to console.
         * @private */
        this._debugging = config.debugMode ?? false;
        /**
         * Optional additional headers to add to fetch requests.
         * @private */
        this._headers = config.headers ?? {};
        /**
         * Status for cache usage (initially true).
         * @private */
        this._useCache = config.useCache ?? true;
        /**
         * Currently used search fields.
         * @private */
        this._searchFields = config.searchFields ?? [];
        /**
         * Current service provider id (enableDirectLogin).
         * @private */
        this._sid = config.direktLogin?.serviceProviderId ?? undefined;
        /**
         * Current service provider password (enableDirectLogin).
         * @private */
        this._spwd = config.direktLogin?.serviceProviderPwd ?? undefined;
        /**
         * Current database handle.
         * @private
         * @type {any} */
        this._db;
        /**
         * After you called the {@link get} function, this property contains an array with the vids that were retrieved from the local cache.
         * If this counts 0 (empty array), all data was requested from the server.
         * It allows you to verify cache usage.
         * @public
         */
        this.fromCache = [];

        // value check
        if(!this._serviceUrl || !this._userIdentifier) {
            throw this._onError(new EvalError('init: url and userName parameter are mandatory'), kVaccinatorInvalidErrorCode);
        }

        // init database
        this._db = localforage.createInstance({ name: 'vaccinator-' + this._userIdentifier }); // TODO: replace later?
        if(!this._db.supports(localforage.INDEXEDDB)) {
            throw this._onError(new EvalError('init: please use an up to date webbrowser (no IndexedDB supported)'), kVaccinatorInvalidErrorCode);
        }

        if(this._appId) {
            this._saveAppId(this._appId); // called async. But it's ok here, because the app-Id is cached in memory before it is completly written to the storage.
        }

        this._debug(this._debugging && "Initialization done");
    }

    /**
     * Wraps all exceptions properly.
     *
     * @example <caption>Using as an exceptions wrapper.</caption>
     * throw _onError('Ups, something went totaly wrong!');
     *
     * @example <caption>Pass and process error through nested promises without loosing the stack.</caption>
     * .then((_, __) => { throw 'Ups, something went totaly wrong here!'; })
     * .catch(e => reject(this._onError(e)));
     *
     * @private
     * @param {any} error
     * @param {number?} code
     * @returns {DvError} the same but modified error like on input.
     */
    _onError(error, code) {
        return new DvError(error, code); // wrap error
    }

    /**
     * Outputs vaccinator class related text to debug console.
     * If debugging is activated.
     *
     * @private
     * @param {string} message
     */
    _debug(message) {
        if (!message) { return; }
        console.debug("VACCINATOR: " + message);
    }

    /**
     * Saves the given AppId to the local database (using current userName).
     * If a password is known, it will save it encrypted!
     *
     * @private
     * @param {string} appId
     * @returns {Promise<void>}
     */
    async _saveAppId(appId) {
        const key = this._password ? await this._string2cryptoKey(this._password) : null
            , store = key ? (await this._encrypt(appId, key)) : appId; // save app-ID encrypted if key is not null.

        this._debug(this._debugging && "_saveAppId: Store/update app-id in local storage");

        const dbKey = "appId-" + this._userIdentifier;

        this._appId = appId; // update local

        await this._db.setItem(dbKey, store);
    }

    /**
     * Converts a string into an array.
     * If the parameter is already an array, it's just returning it.
     *
     * @private
     * @param {string|Array} s
     * @returns {Array<string>}
     */
    _string2Array(s) {
        return Array.isArray(s) ? s : s.split(kVidStringSeperator);
    }

    /**
     * Replace default fetch method with a XMLHttpRequest.
     *
     * @private
     * @param {{method: 'POST'|'GET', body: Object}} param0
     * @returns {Promise<string>} Response string
     */
    async _fetch({method, body}) {
        body = Object.assign({ // apply custom values to default request body
            version: 2,
            uid: this._userIdentifier,
            sid: this._sid,
            spwd: this._spwd,
        }, body);
        const data = new FormData()
            , jsonString = JSON.stringify(body);
        data.append('json', jsonString);

        this._debug(this._debugging && `Protocol call: [${jsonString}] to url [${this._serviceUrl}]`);

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open(method, this._serviceUrl, true);
            xhr.timeout = kXhrTimeout;
            xhr.ontimeout = xhr.onerror = e => {
                if(e instanceof XMLHttpRequestProgressEvent) { // XMLHttpRequestProgressEvent has a weird toString output, so we need to log the error directly into the console.
                    console.error(e);
                    reject(this._onError(`XMLHttpRequestProgressEvent: Request failed! Inspect previous error log.`));
                } else {
                    reject(this._onError(e));
                }
            };
            for (const key in this._headers) {
                if (Object.hasOwnProperty.call(this._headers, key)) {
                    xhr.setRequestHeader(key, this._headers[key]);
                }
            }
            xhr.addEventListener('loadend', (_) => {
                if(xhr.status === 200) {
                    resolve(xhr.responseText);
                } else {
                    reject(this._onError(`_fetch: Status was not OK [${xhr.status} - ${xhr.responseText}]`));
                }
            });
            xhr.send(data);
        });
    }

    /**
     * Generate some random number Array with given
     * byte length. Uses Math.random()!
     *
     * @private
     * @param {int} bytes
     * @returns {Uint8Array}
     */
    _generateRandom(bytes) {
        return window.crypto.getRandomValues(new Uint8Array(bytes));
    }

    /**
     * Convert some array to hex encoded string
     *
     * @private
     * @param {Uint8Array} buffer
     * @returns {string}
     */
    _buf2hex(buffer) {
        if(!(buffer instanceof Uint8Array)) {
            buffer = new Uint8Array(buffer);
        }

        const A = [] // memory optimizations
            , l = buffer.length
            , seperator = '';

        for (let i = 0; i < l; i++) {
            const v = buffer[i];
            A.push(kHex[(v & 0xf0) >> 4] + kHex[v & 0x0f]);
        }
        return A.join(seperator);
    }

    /**
     * Convert some hex encoded string to Uint8Array
     *
     * @private
     * @param {string} hexString
     * @returns {Uint8Array}
     */
    _hex2buf(hexString) {
        const l = hexString.length // memory optimizations
            , A = [];

        for (let i = 0; i < l; i += 2) {
            A.push(parseInt(hexString.substring(i, i + 2), 16));
        }

        return new Uint8Array(A);
    }

    /**
     * Encrypt some string with given key array using
     * AES in GCM mode (key must me 256 bits).
     * Recipt is aes-256-gcm.
     *
     * Result if Standard:
     * recipt:iv:data (3 parts)
     *
     * If addChecksum is provided, it is added like
     * recipt:addChecksum:iv:data (4 parts)
     *
     * @private
     * @param {string} data
     * @param {CryptoKey} key
     * @param {string?} addChecksum
     * @returns {Promise<string>} encryptedHEX with recipt.
     */
    async _encrypt(data, key, addChecksum) {
        if(!data || !key) { throw this._onError(new EvalError('Data and key are mandatory!')); }

        const iv = this._generateRandom(16); // 128 bits iv
        this._debug(this._debugging && `_encrypt: Encrypt with key [${this._buf2hex(key)}] and iv [${this._buf2hex(iv)}]`);

        const cipher = new Uint8Array(await window.crypto.subtle.encrypt({name: 'AES-GCM', iv: iv}, key, Vaccinator._string2buffer(data)));

        return `aes-256-gcm${addChecksum ? `:${addChecksum}` : ''}:${this._buf2hex(iv)}:${this._buf2hex(cipher)}`;
    }

    /**
     * Decrypt some encrypted with given key array.
     * If verifyChecksum is given, it must match the one from
     * given input data. Otherwise it throws an error.
     *
     * Currently only supporting "aes-256-gvm" for AES in GCM mode
     * (key must me 256 bits).
     * For legacy the "aes-256-cbc" is still supported but will be removed.
     *
     * @private
     * @param {string} data
     * @param {CryptoKey} key
     * @param {string?} verifyChecksum
     * @returns {Promise<string>} decryptedText
     */
    async _decrypt(data, key, verifyChecksum) {
        if(!data || !key) { throw this._onError(new EvalError('Data and key are mandatory!')); }

        const parts = data.split(":");
        if(parts.length < 3) {
            throw this._onError(`_decrypt: invalid data [${data}]`);
        }
        const cipherMode = parts[0];
        if (cipherMode !== "aes-256-cbc" && cipherMode !== "aes-256-gcm") {
            throw this._onError(`_decrypt: unknown crypto recipt [${parts[0]}]`, kVaccinatorInvalidErrorCode);
        }

        if (verifyChecksum && verifyChecksum !== parts[1]) {
            throw this._onError(new EvalError('_decrypt: Checksum does not match!'));
        }

        let iv;

        if (parts.length === 4) {
            iv = this._hex2buf(parts[2]);
            data = this._hex2buf(parts[3]);
        } else {
            iv = this._hex2buf(parts[1]);
            data = this._hex2buf(parts[2]);
        }

        this._debug(this._debugging && `_decrypt: Decrypt with key [${this._buf2hex(key)}] and iv [${this._buf2hex(iv)}] and checksum [${verifyChecksum}]`);

        let cipher;

        if(cipherMode == "aes-256-cbc") {
            cipher = new Uint8Array(await window.crypto.subtle.decrypt({name: 'AES-CBC', iv: iv}, key, data));
        } else { // gcm instead.
            cipher = new Uint8Array(await window.crypto.subtle.decrypt({name: 'AES-GCM', iv: iv}, key, data));
        }

        return Vaccinator._buffer2string(cipher);
    }

    /**
     * Returns the app-id as crypto key.
     *
     * Returns null in case there is no app-iD.
     * @private
     * @param {EncryptionMode?} mode Encryption mode. Default is `AES-GCM`.
     * @returns {Promise<CryptoKey?>}
     */
    async _getCryptoKey(mode = 'AES-GCM') {
        if (this._appId) {
            this._debug(this._debugging && "Create key from appId as crypto key");
            return await this._string2cryptoKey(this._appId, mode);
        }
        this._debug(this._debugging && "No App-ID defined (_getKey -> null)");
        return null;
    }

    /**
     * Returns the passed raw text as crypto key.
     *
     * @private
     * @param {string} text
     * @param {EncryptionMode?} mode Encryption mode. Default is `AES-GCM`.
     * @returns {Promise<CryptoKey>}
     */
    async _string2cryptoKey(text, mode = 'AES-GCM') {
        const hash = Vaccinator._hash(text)
            , buffer = this._hex2buf(hash);
        return await window.crypto.subtle.importKey('raw', buffer, mode, false, ['encrypt', 'decrypt']);
    }

    /**
     * Generates the SearchHash from given word. If withRandom is true,
     * zero to 5 random bytes are getting added. See search Plugin documentation.
     *
     * @private
     * @param {string} word
     * @param {boolean} withRandom Default is `false`.
     * @returns {Promise<string>}
     */
    async _searchHash(word, withRandom = false) {
        if (!word) { return ""; }
        let searchHash = ""
            , h = "f1748e9819664b324ae079a9ef22e33e9014ffce302561b9bf71a37916c1d2a3"; // init, see docs

        const letters = word.toLowerCase().split("");
        for (let l of letters) {
            h = await Vaccinator.__hash(l + h + this._appId);
            searchHash += h.slice(0, 2);
        }
        if (withRandom) {
            const c = Math.floor(Math.random() * 6);
            // generate random hex bytes only (0-f), so we need double of c
            for (let i = 0; i < c * 2; ++i) {
                searchHash += (Math.floor(Math.random() * 16)).toString(16);
            }
        }
        // Limit search hashes to 254 characters (127 bytes) to fit
        // dataVaccinator database table "search"."WORD" maximum length.
        return searchHash.slice(0, 254);
    }

    /**
     * Generate the array of SearchHash values for DataVaccinator protocol use.
     * Used for {@link new} and {@link update} function.
     * Quickly returns empty array if search functionality is not used.
     *
     * @private
     * @param {VData} vData
     * @returns {Promise<Array<string>>} searchwords
     */
    async _getSearchWords(vData) {
        if (!this._searchFields.length) {
            return [];
        }

        let data;

        if (!(vData.data instanceof Object)) {
            // convert to object
            try {
                data = JSON.parse(vData.data);
            } catch (error) {
                throw this._onError(new EvalError(`vData.data is neither a valid json-string nor a valid json-object! [${error} : ${vData.data}]`), kVaccinatorInvalidErrorCode);
            }
        } else {
            data = vData.data;
        }


        const ret = [];
        for (let w of this._searchFields) {
            const value = data[w];
            if (!value) { continue; }
            // split single words using " ,.+-/\" and linebreak
            let words = value.split(kWordSplitRegex);
            for (let p of words) {
                if (p) {
                    ret.push(await this._searchHash(p, true));
                }
            }
        }
        this._debug(this._debugging && "_getSearchWords: SearchWords are " + JSON.stringify(ret));
        return ret;
    }

    /**
     * Retrieves generic information from the connected DataVaccinator server.
     *
     * @returns {Promise<any>}
     */
    async getServerInfo() {
        let result = await this._fetch({method: 'POST', body: {
            op: "check"
        }});
        result = JSON.parse(result);
        if(result.status === 'OK') {
            return result;
        } else {
            throw this._onError(result, kVaccinatorServiceErrorCode);
        }
    }

    /**
     * Raw new function. Wrapped an called by {@link new} & {@link publish}.
     *
     * @private
     * @param {VData} vData
     * @param {{password:string, duration:number}?} publish
     * @returns {Promise<string>} New created vid.
     */
    async _new(vData, publish) {
        if(publish) { // value check
            if(!publish.password || !publish.duration) {
                throw this._onError(new EvalError('new: While publishing, the password and the duration have to be set!'), kVaccinatorInvalidErrorCode);
            }
            if(!publish.duration || publish.duration < 1 || publish.duration > 365) {
                throw this._onError(new RangeError('new: The duration is out of rannge!'), kVaccinatorInvalidErrorCode);
            }
        }

        if(!vData || !vData.data) {
            throw this._onError(new EvalError("new: vData parameter is mandatory"), kVaccinatorInvalidErrorCode);
        }

        const appId = await this.getAppId();
        let operation, payload;
        if(publish) {
            operation = 'publish';
            payload = await this._encrypt(vData.data, await this._string2cryptoKey(publish.password));
        } else {
            operation = 'add';
            payload = await this._encrypt(vData.data, await this._getCryptoKey(), appId.slice(-kChecksumLength));
        }

        let result = await this._fetch({method: 'POST', body: {
            op: operation,
            data: payload,
            words: await this._getSearchWords(vData),
            duration: publish?.duration
        }});
        result = JSON.parse(result);
        if(result.status === "OK") {
            if(publish) {
                this._debug(this._debugging && `new: Returning new published VID [${result.vid}]`);
                return result.vid;
            } else {
                await this._storeCache(result.vid, vData);
                this._debug(this._debugging && `new: Returning new VID [${result.vid}]`);
                return result.vid;
            }
        } else {
            throw this._onError(result);
        }
    }

    /**
     * Create a new PID entry.
     *
     * The vaccinationData is PID in some JSON encoded dataset. It may contain personal information of a person (PID). This is returned later by the {@link get} function.
     *
     * @param {VData} vData
     * @returns {Promise<string>} New created vid.
     */
    async new(vData) {
        return this._new(vData);
    }

    /**
     * Returns the app-id that is currently in use.
     *
     * If no app-id is available or on storage failure, it throws an error!
     * @param {boolean} force If true, the key will we be forced to read from database instead from possible cached value. Default is `false`.
     * @returns {Promise<string>} app-id
     */
    async getAppId(force = false) {
        if(!force && this._appId) {
            this._debug(this._debugging && "getAppId: Return already cached app-id");
            return this._appId;
        }

        this._debug(this._debugging && "getAppId: Read app-id from database");

        let appId = await this._db.getItem('appId-' + this._userIdentifier);
        if(this._password) {
            appId = this._decrypt(appId, await this._string2cryptoKey(this._password));
        }
        this._debug(this._debugging && "getAppId: Return app-id [" + this._appId + "]");
        this._appId = appId; // update memory
        return this._appId;
    }

    /**
     * Create a new PID entry for publishing.
     *
     * @param {VData} vData
     * @param {string} password
     * @param {number} duration
     * @returns {Promise<string>} New created vid.
     */
    async publish(vData, password, duration) {
        return this._new(vData, {password: password, duration: duration});
    }

    /**
     * Update vaccinationData of an existing PID entry.
     *
     * @param {string} vid
     * @param {VData} vData
     */
    async update(vid, vData) {
        if(!vid || !vData || !vData.data) {
            throw this._onError('update: vid and vData parameter are mandatory', kVaccinatorInvalidErrorCode);
        }

        const aid = await this.getAppId();

        let result = await this._fetch({method: 'POST', body: {
            op: "update",
            vid: vid,
            data: await this._encrypt(vData.data, await this._getCryptoKey(), aid.slice(-2)),
            words: await this._getSearchWords(vData)
        }});
        result = JSON.parse(result);
        if(result.status === 'OK') {
            await this._storeCache(vid, vData);
            this._debug(this._debugging && `update: Returning updated VID [${vid}]`);
        } else {
            throw this._onError(result, kVaccinatorServiceErrorCode);
        }
    }

    /**
     * Delete the given entry.
     *
     * @param {Promise<void>}
     */
    async delete(vids) {
        if(!vids) {
            throw this._onError('delete: vids parameter is mandatory', kVaccinatorInvalidErrorCode);
        }
        vids = this._string2Array(vids);

        if (vids.length > 500) {
            // too many vids per request
            throw this._onError("delete: Max 500 vids allowed per request! Please try to chunk your calls.", kVaccinatorInvalidErrorCode);
        }

        let result = await this._fetch({method: 'POST', body: {
            op: "delete",
            vid: vids.join(kVidStringSeperator)
        }});
        result = JSON.parse(result);
        if(result.status === 'OK') {
            this._debug(this._debugging && `deleted vids: ${JSON.stringify(vids)}`);
            // TODO: Do not remove from cache if it was published.
            await this._removeCache(vids);
        } else {
            throw this._onError(result, kVaccinatorServiceErrorCode);
        }
    }

    /**
     * Retrieve the vaccinationData of one or more given VID.
     *
     * The submitted VID is the identifying Vaccination ID (previously returned by {@link new}).
     * Multiple VIDs can be submitted as array with multiple VIDs or a string with multiple VIDs divided by blank.
     * If you want to provide more than 500 VIDs, please call this function in chunks (will trigger an exception otherwise).
     *
     * @param {string|string[]} vids
     * @param {boolean} force If true, the key will we be forced to read from server instead from possible cached value. Default is `false`.
     * @returns {Promise<Map<string, VData>>}
     */
    async get(vids, force = false) {
        if(!vids) {
            throw this._onError(new EvalError('get: vids parameter is mandatory"'), kVaccinatorInvalidErrorCode);
        }
        const key = await this._getCryptoKey();
        if(!key) {
            throw this._onError('get: No key for decryption!');
        }
        vids = this._string2Array(vids);

        // check for the cached vids first
        const uncached = [] // will get the uncached vids
            , result = new Map() // compose result

        this.fromCache.length = 0; // clear array

        if(!force) {
            for (const vid of vids) {
                const vDataContent = await this._retrieveCache(vid);
                if(!vDataContent) {
                    uncached.push(vid);
                    this._debug(this._debugging && `get: Add vid [${vid}] for getting from server`);
                    continue;
                }
                this.fromCache.push(vid);
                this._debug(this._debugging && `get: Retrieve cached vData for vid [${vid}]`);
                result.set(vid, { "status": "OK", "data": vDataContent });
            }
        }

        if(uncached.length > 500) {
            throw this._onError('get: Max 500 vids allowed per request! Please try to chunk your calls.', kVaccinatorInvalidErrorCode);
        }

        if(!force && !uncached.length) { // nothing to get from vaccinator service (all from cache)
            return result;
        }

        await this.getAppId(); // ensure appid is in memory

        this._debug(this._debugging && `get: Fetch vDatas from server [${(force ? vids : uncached).join(kVidStringSeperator)}]`);

        let r = await this._fetch({method: 'POST', body: {
            op: "get",
            vid: (force ? vids : uncached).join(kVidStringSeperator)
        }});
        r = JSON.parse(r);
        if(r.status === 'OK') {
            this._debug(this._debugging && `get: Successfully received vData. Processing...`);
            const data = r.data
                , checksum = this._appId.slice(-kChecksumLength);

            for (const vid in data) {
                if (Object.hasOwnProperty.call(data, vid)) {
                    const e = data[vid];

                    if(e.status == "NOTFOUND") {
                        result.set(vid, e);
                        continue;
                    }

                    try {
                        e.data = this._decrypt(e.data, key, checksum);
                        await this._storeCache(vid, e.data); // update local cache
                    } catch (error) {
                        console.error(`
                            Unable to decrypt vData [${vid}] because used appId
                            seems not the correct one or some crypto error occured!
                            Origin error: [${error}]`
                        );
                        // cleanup failing dataset
                        e.status = 'ERROR';
                        e.data = undefined;
                    } finally {
                        result.set(vid, e);
                    }
                }
            }
            return result;
        } else {
            throw this._onError(r, kVaccinatorServiceErrorCode);
        }
    }

    /**
     * Retrieve published data from DataVaccinator Vault.
     *
     * @param {string|string[]} vids
     * @param {string} password
     * @returns {Promise<Map<string, any>>}
     */
    async getPublished(vids, password) {
        if(!vids || !password) {
            throw this._onError('getPublished: vids and password parameter is mandatory', kVaccinatorInvalidErrorCode);
        }
        vids = this._string2Array(vids);

        if(vids.length > 500) {
            throw this._onError('getPublished: Max 500 vids allowed per request! Please try to chunk your calls.', kVaccinatorInvalidErrorCode);
        }

        await this.getAppId(); // ensure appid is in memory

        let r = await this._fetch({method: 'POST', body: {
            op: "getpublished",
            vid: vids.join(kVidStringSeperator)
        }});

        r = JSON.parse(r);
        if(r.status === 'OK') {
            this._debug(this._debugging && "getPublished: Successfully received vData. Processing...");

            const data = r.data
                , key = await this._string2cryptoKey(password);

            for (const vid in data) {
                if (Object.hasOwnProperty.call(data, vid)) {
                    const e = data[vid];

                    if(e.status == "NOTFOUND") {
                        continue;
                    }

                    try {
                        e.data = this._decrypt(e.data, key);
                    } catch (error) {
                        console.error(`
                            Unable to decrypt vData [${vid}] because used appId
                            seems not the correct one or some crypto error occured!
                            Origin error: [${error}]`
                        );
                        // cleanup failing dataset
                        e.status = 'ERROR';
                        e.data = undefined;
                    }
                }
            }
            return data;
        } else {
            throw this._onError(r, kVaccinatorServiceErrorCode);
        }
    }

    /**
     * Wipe the given PID entry from the local cache.
     * This does not delete data from DataVaccinator Vault!
     *
     * @param {string|string[]} vids
     */
    async wipe(vids) {
        if(!vids) {
            throw this._onError('wipe: vids parameter is mandatory', kVaccinatorInvalidErrorCode);
        }
        vids = this._string2Array(vids);

        await this._removeCache(vids);
    }

    /**
     * This is trying to re-encode all stored Vaccination Data (PID) after the app-id has changed.
     *
     * The app-id is used to encrypt the payload in identity management.
     * For whatever reason, if the app-id is changing for a user, then all entries in identity management need to become re-encrypted.
     * Obviously, this is not to be done on identity management place to protect the data.
     * So it must be done locally.
     * @param {string|string[]} vids
     * @param {string} oldAppId
     * @param {string} newAppId
     * @returns {Promise<int>} affectedCount
     */
    async changeAppId(vids, oldAppId, newAppId) {
        if(!vids || !oldAppId || !newAppId) {
            throw this._onError('changeAppId: vids, oldAppId, newAppId and password parameter are mandatory', kVaccinatorInvalidErrorCode);
        }
        if(oldAppId !== this._appId) {
            throw this._onError('changeAppId: oldAppId must be identical to current appId');
        }
        if(!(await Vaccinator.validateAppId(newAppId))) {
            throw this._onError('changeAppId: given new appId does not validate!');
        }
        vids = this._string2Array(vids);

        return new Promise(async (resolve, reject) => {

            // TODO: vids chunking; generic chunking? getpublish, delete, get

            const vDataMap = await this.get(vids) // vDataArray should contain absolut all vData to re-encrypt.
                , tmpVaccinator = new Vaccinator(Object.assign(this._config, {appId: newAppId})) // copy old config with new app-Id.
                , promises = [];
            let affectedCount = 0;

            for (let i = 0; i < vids.length; i++) {
                const vid = vids[i]
                    , e = vDataMap.get(vid);

                if(e?.status === "OK") {
                    this._debug(this._debugging && `Store new dataset for [${vid}]`);
                    promises.push(
                        tmpVaccinator.update(vid, e)
                        .then(() => {affectedCount++;})
                        .catch(e => {console.error(e);}) // TODO: ist error hier richtig? warn? ignorieren?
                    );
                } else {
                    console.warn(`Failed retrieving vData for VID [${vid}: ${e}] (no data?).`);
                }
            }

            Promise.all(promises)
            .then(async _ => {
                await this._saveAppId(newAppId);
                resolve(affectedCount);
            })
        });

    }

    /**
     * Wipe all locally cached information.
     *
     * Returns `true` if cache was wiped.
     * @param {string?} token
     * @returns {Promise<boolean>}
     */
    async wipeCache(token) {
        if(token) { // need to check if wipe is needed
            const knownToken = await this._db.getItem("payloadToken");
            if(knownToken === token) {
                this._debug(this._debugging && "wipeCache: No need to wipe cache (known token)");
                return false;
            }
        }

        this._debug(this._debugging && "wipeCache: Wiping cache");

        const appIdKey = "appId-" + this._userIdentifier
            , appId = await this._db.getItem(appIdKey);

        await this._db.clear();

        await this._db.setItem(appIdKey, appId);

        if(token) {
            // need to save payloadToken
            await this._db.setItem("payloadToken", token);
            this._debug(this._debugging && `wipeCache: New cache token is [${token}]`);
        }

        return true;
    }

    /**
     * Search through the DataVaccinator Vault for entries.
     *
     * @param {string} searchTerm
     * @returns {Promise<Array<string>>} vids array
     */
    async search(searchTerm) {
        let term = "";
        const words = searchTerm.split(kWordSplitRegex);
        for (let w of words) {
            term += await this._searchHash(w) + kVidStringSeperator;
        }
        term = term.trim();
        if(!term) {
            // no valid search term
            this._debug(this._debugging && "search: Empty search does not trigger a call to server!");
            // resolve promise with empty result array
            return [];
        }

        let result = await this._fetch({method: 'POST', body: {
            op: "search",
            words: term
        }});
        result = JSON.parse(result);
        if(result.status === 'OK') {
            return result.vids;
        } else {
            throw this._onError(result, kVaccinatorServiceErrorCode);
        }
    }

    // Cache functions

    /**
     * Store data in cache
     *
     * Will throw an error on storage failure!
     * @private
     * @param {string} vid
     * @param {VData} vData
     * @returns {Promise<void>}
     */
    async _storeCache(vid, vData) {
        if(!this._useCache) return;

        await this._db.setItem(vid, vData.data)
        this._debug(this._debugging && "_storeCache: Stored vData for VID " + vid + " in cache");
    }

    /**
     * Getdata from cache. Will return null if not found!
     *
     * @private
     * @param {string} vid
     * @returns {Promise<string|null>}
     */
    async _retrieveCache(vid) {
        if(!this._useCache) {
            return null;
        }

        this._debug(this._debugging && `_retrieveCache: Retrieve vData for VID ${vid} from cache`);

        return await this._db.getItem(vid);
    }

    /**
     * Removes one given entry from the cache.
     *
     * Will throw an error on storage failure!
     * @private
     * @param {Array<string>} vids
     * @returns {Promise<void>}
     */
    async _removeCache(vids) {
        await this._db.removeItems(vids);
        this._debug(this._debugging && `_removeCache: Removed payload for VID(s) [${JSON.stringify(vids)}] from cache`);
    }
}


/*	Vaccinator static methods
    ======================================================================= */
/**
 * Convert some string into Uint8Array.
 *
 * @private
 * @static
 * @param {string} text
 * @returns {Uint8Array} utf-8 encoded
 */
Vaccinator._string2buffer = (text) => {
    return new TextEncoder().encode(text);
}

/**
 * Convert some buffer into utf-8 encoded string.
 *
 * @private
 * @static
 * @param {Uint8Array} bytes
 * @returns {string} utf-8 encoded
 */
Vaccinator._buffer2string = (bytes) => {
    let result = [], i = 0;

    while (i < bytes.length) {
        let c = bytes[i];

        if (c < 128) {
            result.push(String.fromCharCode(c));
            i++;
        } else if (c > 191 && c < 224) {
            result.push(String.fromCharCode(((c & 0x1f) << 6) | (bytes[i + 1] & 0x3f)));
            i += 2;
        } else {
            result.push(String.fromCharCode(((c & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)));
            i += 3;
        }
    }

    return result.join('');
}

/**
 * Calculate SHA256 from some given string and
 * return hex encoded hash.
 *
 * @private
 * @static
 * @param {string} text
 * @returns {string} hex encoded
 * @deprecated use {@link Vaccinator.__hash} instead.
 */
Vaccinator._hash = (text) => {
    return forge_sha256(text);
}

/**
 * Calculate SHA256 from some given string and
 * return hex encoded hash.
 *
 * @private
 * @static
 * @param {string} text
 * @returns {Promise<string>} hex encoded
 */
Vaccinator.__hash = async (text) => {
    const shaBuffer = new Uint8Array(await window.crypto.subtle.digest('SHA-256', Vaccinator._string2buffer(text)));

    const pad = '0' // memory optimizations
        , seperator = ''
        , A = []
        , l = shaBuffer.length;

    for (let i = 0; i < l; i++) {
        A.push(shaBuffer[i].toString(16).padStart(2, pad));
    }
    return A.join(seperator);
}

/**
 * Validates the checksum of the given app-id.
 *
 * @public
 * @static
 * @param {string} appId
 * @returns {Promise<boolean>}
 */
Vaccinator.validateAppId = async (appId) => {
    if (!appId || appId.length < 4) {
        return false;
    }

    const cs = appId.slice(-2) // CheckSum from given AppId
        , cipher = await Vaccinator.__hash(appId.slice(0, appId.length - 2)) // hash from AppId - checksum
        , calcCs = cipher.slice(-2); // calculated checksum
    return (cs === calcCs); // must be identical
}







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
