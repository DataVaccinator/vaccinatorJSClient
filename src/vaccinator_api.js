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
 * @property {{serviceProviderId:int, serviceProviderPwd:string}?} directLogin Enable direct login. By this, the protocol is enhanced by adding sid and spwd values (serviceProviderId and serviceProviderPwd). This is needed to directly access the DataVaccinator Vault without any intermediate or proxy instance.
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
        this._sid = config.directLogin?.serviceProviderId ?? undefined;
        /**
         * Current service provider password (enableDirectLogin).
         * @private */
        this._spwd = config.directLogin?.serviceProviderPwd ?? undefined;
        /**
         * Current database handle.
         * @private
         * @type {any} */
        this._db;
        /**
         * After you called the {@link get} function, this property contains 
         * an array with the vids that were retrieved from the local cache.
         * If this counts 0 (empty array), all data was requested from the 
         * server.
         * 
         * It allows you to verify cache usage.
         * 
         * @public
         */
        this.fromCache = [];

        // value check
        if(!this._serviceUrl || !this._userIdentifier) {
            throw this._onError(new EvalError('constructor: serviceUrl and userIdentifier parameters are mandatory'), 
                kVaccinatorInvalidErrorCode);
        }
    }

    async init() {
        // async functions
        // init database
        this._db = await DB.createInstance('vaccinator-' + this._userIdentifier);

        if(this._appId) {
            // called async. But it's ok here, because the app-Id is cached in memory
            // before it is completly written to the storage.
            if (await Vaccinator.validateAppId(this._appId)) {
                this._saveAppId(this._appId);
            } else {
                throw this._onError(new EvalError('init: provided appId is not valid'), 
                    kVaccinatorInvalidErrorCode);
            }
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
        console.debug("%cVACCINATOR: " + message, "color: #666666;");
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
                /** VS (10/2023): 
                 * The below test was not working in Firefox? 
                 * I found no way to test for XMLHttpRequestProgressEvent as it was
                 * unknown to Firefox at all?
                 */

                // if(e instanceof XMLHttpRequestProgressEvent) { // XMLHttpRequestProgressEvent has a weird toString output, so we need to log the error directly into the console.
                //    console.error(e);
                //    reject(this._onError(`XMLHttpRequestProgressEvent: Request failed! Inspect previous error log.`));
                //} else {
                    reject(this._onError(e));
                //}
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
     * byte length.
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

        this._debug(this._debugging && `_encrypt: Encrypt with key [${this._buf2hex(await window.crypto.subtle.exportKey("raw", key))}] and iv [${this._buf2hex(iv)}]`);

        const cipher = new Uint8Array(
            await window.crypto.subtle.encrypt(
                {name: 'AES-GCM', iv: iv}, key, Vaccinator._string2buffer(data)
            )
        );

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
            throw this._onError(`_decrypt: unknown crypto recipt [${parts[0]}]`, 
                kVaccinatorInvalidErrorCode);
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

        this._debug(this._debugging && `_decrypt: Decrypt with key [${this._buf2hex(await window.crypto.subtle.exportKey("raw", key))}] and iv [${this._buf2hex(iv)}] and checksum [${verifyChecksum}]`);

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
        const hash = await Vaccinator._hash(text)
            , buffer = this._hex2buf(hash);
        return await window.crypto.subtle.importKey('raw', buffer, mode, true, ['encrypt', 'decrypt']);
    }

    /**
     * Chunks the given Array with the optional size.
     *
     * Values of the origin Array are passed by reference.
     *
     * @example
     * const chunks = this._chunks([...]);
     * for(const chunk of chunks) {
     *      // do some stuff...
     * }
     *
     * @private
     * @param {Array} A
     * @param {number} size Default: `500`
     * @returns {any[][]} Iterable result.
     */
    _chunk(A, size = 500) {
        const result = []
            , totalLength = A.length
            , chunks = totalLength / size
            , l = (totalLength % size) != 0 ? Math.round(chunks + .5) : chunks;

        for (let i = 0; i < l; i++) {
            const _A = []
                , ll = Math.min(size * (i + 1), totalLength);
            for (let j = i * size; j < ll; j++) {
                _A.push(A[j]);
            }
            result.push(_A);
        }
        return result;
    }

    /**
     * Generates the SearchHash from given word. If withRandom is true,
     * a zero byte is added, followed by random hex until the hash is a
     * multiple of 16 characters in length.
     * See searchHash documentation.
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
            h = await Vaccinator._hash(l + h + this._appId);
            searchHash += h.slice(0, 2);
        }

        if (withRandom) {
            // add NULL byte hash
            h = await Vaccinator._hash("\0" + h + this._appId);
            searchHash += h.slice(0, 2);

            // fill hash with random values until it is a multiple of 32 (16 bytes)
            while (searchHash.length % 32 !== 0) {
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
     * @param {string} PID
     * @returns {Promise<Array<string>>} searchwords
     */
    async _getSearchWords(PID) {
        if (!this._searchFields.length) {
            return [];
        }

        let data;

        if (!(PID instanceof Object)) {
            // convert to object
            try {
                data = JSON.parse(PID);
            } catch (error) {
                throw this._onError(new EvalError(`PID is neither a valid json-string nor a valid json-object! [${error} : ${PID}]`), 
                    kVaccinatorInvalidErrorCode);
            }
        } else {
            data = PID;
        }


        const ret = [];
        for (let searchfield of this._searchFields) {
            const value = data[searchfield];
            if (!value) { continue; }
            let words = value.split(kWordSplitRegex);
            for (let word of words) {
                if (word) {
                    ret.push(await this._searchHash(word, true));
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
     * @param {string} PID
     * @param {{password:string, duration:number}?} publish
     * @returns {Promise<string>} New created vid.
     */
    async _new(PID, publish) {
        if(publish) { // value check
            if(!publish.password || !publish.duration) {
                throw this._onError(new EvalError('new: While publishing, the password and the duration have to be set!'), 
                    kVaccinatorInvalidErrorCode);
            }
            if(!publish.duration || publish.duration < 1 || publish.duration > 365) {
                throw this._onError(new RangeError('new: The duration is out of rannge!'), 
                    kVaccinatorInvalidErrorCode);
            }
        }

        if(!PID) {
            throw this._onError(new EvalError("new: PID parameter is mandatory"), kVaccinatorInvalidErrorCode);
        }

        const appId = await this.getAppId();
        let operation, payload;
        if(publish) {
            operation = 'publish';
            payload = await this._encrypt(PID, await this._string2cryptoKey(publish.password));
        } else {
            operation = 'add';
            payload = await this._encrypt(PID, await this._getCryptoKey(), appId.slice(-kChecksumLength));
        }

        let result = await this._fetch({method: 'POST', body: {
            op: operation,
            data: payload,
            words: await this._getSearchWords(PID),
            duration: publish?.duration
        }});
        result = JSON.parse(result);
        if(result.status === "OK") {
            if(publish) {
                this._debug(this._debugging && `new: Returning new published VID [${result.vid}]`);
                return result.vid;
            } else {
                await this._storeCache(result.vid, PID);
                this._debug(this._debugging && `new: Returning new VID [${result.vid}]`);
                return result.vid;
            }
        } else {
            throw this._onError(result);
        }
    }

    /**
     * Create a new VID entry.
     *
     * The vaccinationData is VID in some JSON encoded dataset. 
     * It may contain personal information of a person (VID). 
     * This is returned later by the {@link get} function.
     *
     * @param {string} PID
     * @returns {Promise<string>} New created vid.
     */
    async new(PID) {
        return this._new(PID);
    }

    /**
     * Returns the app-id that is currently in use.
     *
     * If no app-id is available or on storage failure, it throws an error!
     * 
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
            appId = await this._decrypt(appId, await this._string2cryptoKey(this._password));
        }
        this._debug(this._debugging && "getAppId: Return app-id [" + this._appId + "]");
        this._appId = appId; // update memory
        return this._appId;
    }

    /**
     * Create a new VID entry for publishing.
     *
     * @param {string} PID
     * @param {string} password
     * @param {number} duration
     * @returns {Promise<string>} New created vid.
     */
    async publish(PID, password, duration) {
        return this._new(PID, {password: password, duration: duration});
    }

    /**
     * Update vaccinationData of an existing VID entry.
     *
     * @param {string} vid
     * @param {string} PID
     */
    async update(vid, PID) {
        if(!vid || !PID) {
            throw this._onError('update: vid and PID parameter are mandatory', 
                kVaccinatorInvalidErrorCode);
        }

        const aid = await this.getAppId();

        let result = await this._fetch({method: 'POST', body: {
            op: "update",
            vid: vid,
            data: await this._encrypt(PID, await this._getCryptoKey(), aid.slice(-2)),
            words: await this._getSearchWords(PID)
        }});
        result = JSON.parse(result);
        if(result.status === 'OK') {
            await this._storeCache(vid, PID);
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
            throw this._onError('delete: vids parameter is mandatory', 
                kVaccinatorInvalidErrorCode);
        }
        vids = this._string2Array(vids);

        const chunks = this._chunk(vids);
        for (const c of chunks) {
            let result = await this._fetch({method: 'POST', body: {
                op: "delete",
                vid: c.join(kVidStringSeperator)
            }});
            result = JSON.parse(result);
            if(result.status === 'OK') {
                this._debug(this._debugging && `deleted vids: ${JSON.stringify(c)}`);
                // TODO: Do not remove from cache if it was published.
                await this._removeCache(c);
            } else {
                throw this._onError(result, kVaccinatorServiceErrorCode);
            }
        }
    }

    /**
     * Retrieve the vaccinationData of one or more given VID.
     *
     * The submitted VID is the identifying Vaccination ID 
     * (previously returned by {@link new}). 
     * 
     * Multiple VIDs can be submitted as array with multiple
     * VIDs or a string with multiple VIDs divided by blank.
     *
     * @param {string|string[]} vids
     * @param {boolean} force If true, the key will we be forced to read from server instead from possible cached value. Default is `false`.
     * @returns {Promise<Map<string, VData>>}
     */
    async get(vids, force = false) {
        if(!vids) {
            throw this._onError(new EvalError('get: vids parameter is mandatory"'), 
                kVaccinatorInvalidErrorCode);
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
                this._debug(this._debugging && `get: Retrieve cached PID for vid [${vid}]`);
                result.set(vid, { "status": "OK", "data": vDataContent });
            }
        }

        if(!force && !uncached.length) { // nothing to get from vaccinator service (all from cache)
            return result;
        }

        await this.getAppId(); // ensure appid is in memory

        this._debug(this._debugging && `get: Fetch PID from server [${(force ? vids : uncached).join(kVidStringSeperator)}]`);

        const chunks = this._chunk((force ? vids : uncached));
        for (const c of chunks) {
            let r = await this._fetch({method: 'POST', body: {
                op: "get",
                vid: c.join(kVidStringSeperator)
            }});
            r = JSON.parse(r);
            if(r.status === 'OK') {
                this._debug(this._debugging && `get: Successfully received PID. Processing...`);
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
                            e.data = await this._decrypt(e.data, key, checksum);
                            await this._storeCache(vid, e.data); // update local cache
                        } catch (error) {
                            console.error(`
                                Unable to decrypt PID [${vid}] because used appId
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
            } else {
                throw this._onError(r, kVaccinatorServiceErrorCode);
            }
        }
        return result;
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
            throw this._onError('getPublished: vids and password parameter is mandatory', 
                kVaccinatorInvalidErrorCode);
        }
        vids = this._string2Array(vids);

        await this.getAppId(); // ensure appid is in memory

        const chunks = this._chunk(vids);
        const result = new Map() // compose result
        for (const c of chunks) {
            let r = await this._fetch({method: 'POST', body: {
                op: "getpublished",
                vid: c.join(kVidStringSeperator)
            }});

            r = JSON.parse(r);
            if(r.status === 'OK') {
                this._debug(this._debugging && "getPublished: Successfully received PID. Processing...");

                const data = r.data
                    , key = await this._string2cryptoKey(password);

                for (const vid in data) {
                    if (Object.hasOwnProperty.call(data, vid)) {
                        const e = data[vid];

                        if(e.status == "NOTFOUND") {
                            result.set(vid, e);
                            continue;
                        }

                        try {
                            e.data = await this._decrypt(e.data, key);
                        } catch (error) {
                            console.error(`
                                Unable to decrypt PID [${vid}] because used password
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
            } else {
                throw this._onError(r, kVaccinatorServiceErrorCode);
            }
        }
        return result;
    }

    /**
     * Wipe the given VID entry from the local cache.
     * This does not delete data from DataVaccinator Vault!
     *
     * @param {string|string[]} vids
     * @returns {Promise<Boolean>} success
     */
    async wipe(vids) {
        if(!vids) {
            throw this._onError('wipe: vids parameter is mandatory', 
                kVaccinatorInvalidErrorCode);
        }
        vids = this._string2Array(vids);

        await this._removeCache(vids);
        return true;
    }

    /**
     * This is trying to re-encode all stored Vaccination Data (VID) after the app-id has changed.
     *
     * The app-id is used to encrypt the payload in identity management.
     * For whatever reason, if the app-id is changing for a user, then all entries in identity management need to become re-encrypted.
     * Obviously, this is not to be done on identity management place to protect the data.
     * So it must be done locally.
     * 
     * @param {string|string[]} vids
     * @param {string} oldAppId
     * @param {string} newAppId
     * @returns {Promise<int>} affectedCount
     */
    async changeAppId(vids, oldAppId, newAppId) {
        if(!vids || !oldAppId || !newAppId) {
            throw this._onError('changeAppId: vids, oldAppId, newAppId and password parameter are mandatory', 
                kVaccinatorInvalidErrorCode);
        }
        if(oldAppId !== this._appId) {
            throw this._onError('changeAppId: oldAppId must be identical to current appId');
        }
        if(!(await Vaccinator.validateAppId(newAppId))) {
            throw this._onError('changeAppId: given new appId does not validate!');
        }
        vids = this._string2Array(vids);

        return new Promise(async (resolve, reject) => {

            // copy old config with newAppId
            const tmpVaccinator = new Vaccinator(Object.assign(this._config, {appId: newAppId}));
            await tmpVaccinator.init();

            // create jobs in array
            var promises = [];
            var affectedCount = 0;
            for (let i = 0; i < vids.length; i++) {
                promises.push(async () => { 
                    let vid = vids[i];
                    let pid = await this.get(vid);
                    let vData = pid?.get(vid);
                    if (vData?.status === "OK") {
                        await tmpVaccinator.update(vid, vData.data);
                        affectedCount++;
                    } else {
                        console.warn(`Failed retrieving PID for VID [${vid}: ${vData}] (no data, already processed?).`);
                    }
                });
            }

            await Vaccinator._promiseAll(promises, 25); // max 25 promises at once

            await this._saveAppId(newAppId);
            resolve(affectedCount);
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

        // clear the whole database
        await this._db.clear();

        // restore AppId entries in local database
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
     * Store single data item in local cache
     *
     * Will throw an error on storage failure!
     * @private
     * @param {string} vid
     * @param {string} PID
     * @returns {Promise<void>}
     */
    async _storeCache(vid, PID) {
        if(!this._useCache) return;

        await this._db.setItem(vid, PID)
        this._debug(this._debugging && "_storeCache: Stored PID for VID " + vid + " in cache");
    }

    /**
     * Get single data item from cache. 
     * 
     * Will return null if not found!
     * @private
     * @param {string} vid
     * @returns {Promise<string|null>}
     */
    async _retrieveCache(vid) {
        if(!this._useCache) {
            return null;
        }

        this._debug(this._debugging && `_retrieveCache: Retrieve PID for VID ${vid} from cache`);

        const ret = await this._db.getItem(vid);
        if (ret === undefined) { 
            // not found (undefined) must return null
            return null; 
        }
        return ret;
    }

    /**
     * Removes given entries from the local cache.
     *
     * Will throw an error on storage failure!
     * @private
     * @param {Array<string>} vids
     * @returns {Promise<void>}
     */
    async _removeCache(vids) {
        await this._db.removeItems(vids);
        this._debug(this._debugging && `_removeCache: Removed payload for VID(s) ${JSON.stringify(vids)} from cache`);
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
 * @returns {Promise<string>} hex encoded
 */
Vaccinator._hash = async (text) => {
    const shaBuffer = new Uint8Array(
        await window.crypto.subtle.digest('SHA-256', Vaccinator._string2buffer(text))
    );

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
        , cipher = await Vaccinator._hash(appId.slice(0, appId.length - 2)) // hash from AppId - checksum
        , calcCs = cipher.slice(-2); // calculated checksum
    return (cs === calcCs); // must be identical
}

/**
 * Enhanced promise pool handler as replacement for Promise.All()
 * @see https://gist.github.com/jcouyang/632709f30e12a7879a73e9e132c0d56b?permalink_comment_id=3591045#gistcomment-3591045
 * 
 * @param {Array} queue Array of async functions to call
 * @param {number} concurrency Number of concurrent calls
 * @returns 
 */
Vaccinator._promiseAll = async (queue, concurrency) => {
    let index = 0;
    const results = [];
  
    // Run a pseudo-thread
    const execThread = async () => {
      while (index < queue.length) {
        const curIndex = index++;
        // Use of `curIndex` is important because `index` may change after await is resolved
        try {
            results[curIndex] = await queue[curIndex]();
        } catch(err) {
            console.error(err);
            results[curIndex] = err;
        }
      }
    };
  
    // Start threads
    const threads = [];
    for (let thread = 0; thread < concurrency; thread++) {
        threads.push(execThread());
    }
    await Promise.all(threads);
    return results;
};


/*	DB
    ======================================================================= */
const kVDataStoreName = 'vdata';

/**
 * Database helper class to handle local storage via `indexedDB`.
 *
 * Don't create a new `DB` instance by your self. 
 * Use the {@link DB.createInstance} method instead and 
 * use {@link DB.instance} at runtime. See @example.
 *
 * @example <caption>Creating an instance.</caption>
 * const db = await DB.createInstance();
 * @example <caption>Using an instance at runtime.</caption>
 * const db = await DB.instance;
 */
class DB {
    /**
     * @type {DB}
     * @private */
    static _instance = undefined;
    /**
     * @type {string}
     * @private */
    static _dbName = undefined;

    /**
     * @param {IDBDatabase} db
     * @private */
    constructor(db) {
        /** @private */
        this._db = db;
    }

    /**
     * Creates an `DB` instance.
     * @param {string} dbName Name of the storage.
     * @returns {Promise<DB>}
     */
    static async createInstance(dbName) {
        DB._dbName = dbName;
        return DB.instance;
    }

    /**
     * Creates or returns the current instance of `DB`.
     *
     * This method is idempotent. Multiple calls will return the same reference.
     *
     * @returns {Promise<DB>}
     */
    static get instance() {
        if(this._instance) return this._instance;

        if(!indexedDB) {
            throw 'IndexedDB is not supported! Please check browser version or contact us.';
        }
        if(!DB._dbName) {
            throw 'DB Error: Call the `createInstance` method first!';
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB._dbName, 1);
            request.onupgradeneeded = (event) => {
                const db = request.result;
                // create tables
                if(!db.objectStoreNames.contains(kVDataStoreName)) {
                    db.createObjectStore(kVDataStoreName);
                }
            };
            request.onerror = () => { reject(request.error); };
            request.onblocked = () => { reject(request.error || 'DB is blocked!'); };
            request.onsuccess = () => {
                const db = request.result;

                db.onversionchange = (event) => {
                    if(!!event.newVersion) {
                        console.warn(event);
                        db.close();
                        alert('Database is outdated on this tab, please reload the page!');
                    }
                };

                this._instance = new DB(db)
                resolve(this._instance);
            };
        });
    }


    /**
     * Pipes the native `IDBOpenDBRequest` into a `Promise` 
     * and wraps it with the default success and error handlers.
     * Only needed for the native `indexedBD` API calls like 
     * `transaction`, for example.
     *
     * @example <caption>Used for transactions.</caption>
     * const transaction = db.transaction('table') // returns native `indexedDB` API
     *     , store = transaction.objectStore('table');
     * await DB.pipe(store.add('value', 'key'));
     *
     * @param {IDBOpenDBRequest} request
     * @returns {Promise<any>}
     */
    static async pipe(request) {
        return new Promise((resolve, reject) => {
            request.onerror = () => { reject(request.error); }
            request.onsuccess = () => { resolve(request.result); }
        });
    }

    /**
     * Returns a native `IDBTransaction`.
     *
     * Hint: Use the static {@link DB.pipe} function to handle 
     *       native calls like `Promise`s.
     *
     * Warning I: Transactions are auto-commited when the microtasks
     *            queue is empty an the current code finishes. 
     *            Do not use async operations between!
     *
     * Warning II: Only the native {@link IDBTransaction.oncomplete} 
     *             guarantees that the transaction is saved as a whole. 
     *             See @example.
     *
     * @example
     * const transaction = db.transaction("table", "readwrite");
     *
     * // ...perform operations...
     *
     * transaction.oncomplete = function() {
     *      // Transaction is complete
     * };
     *
     * @param {string | Iterable<string>} names
     * @param {'readonly'|'readwrite'?} mode Default is `"readonly"`
     * @returns
     */
    transaction(names, mode = 'readonly') {
        return this._db.transaction(names, mode);
    }

    /**
     * Returns the entry from the database.
     *
     * @param {string} key
     * @returns {Promise<any>}
     */
    async getItem(key) {
        const t = this.transaction(kVDataStoreName, 'readonly')
            , store = t.objectStore(kVDataStoreName);
        return DB.pipe(store.get(key));
    }

    /**
     * Adds an entry to the database. If there’s already a value
     * with the same key, it will be replaced.
     *
     * @param {string} key
     * @param {any} value
     * @returns {Promise<void>}
     */
    async setItem(key, value) {
        const t = this.transaction(kVDataStoreName, 'readwrite')
            , store = t.objectStore(kVDataStoreName);
        return DB.pipe(store.put(value, key));
    }

    /**
     * Removes the entry from the database.
     *
     * @param {string} key
     * @returns {Promise<void>}
     */
    async remove(key) {
        const t = this.transaction(kVDataStoreName, 'readwrite')
            , store = t.objectStore(kVDataStoreName);
        return DB.pipe(store.delete(key));
    }

    /**
     * Removes all the entries from the database.
     *
     * @param {Array} key
     * @returns {Promise<void>}
     */
    async removeItems(keys) {
        return new Promise(async (resolve, reject) => {
            for (const key of keys) {
                await this.remove(key);
            }
            resolve();
        });
    }

    /**
     * Removes all entries from the database.
     *
     * @returns {Promise<void>}
     */
    async clear() {
        const t = this.transaction(kVDataStoreName, 'readwrite')
            , store = t.objectStore(kVDataStoreName);
        return DB.pipe(store.clear());
    }

    /** @returns {Promise<void>} */
    async deleteDatabase() {
        return DB.pipe(indexedDB.deleteDatabase(DB._dbName));
    }
}
