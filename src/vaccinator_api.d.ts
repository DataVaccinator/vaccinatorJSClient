/** DataVaccinator error class. */
declare class DvError extends Error {
    /**
     * @param {any} error
     * @param {number?} code
     */
    constructor(error: any, code: number | null);
    /**
     * @public
     * @type {number?}
     */
    public code: number | null;
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
    public origin: Error | string;
}
/**
 * vaccinatorJsClient class module
 *
 * @license MIT License
 * @link https://www.datavaccinator.com
 * See github LICENSE file for license text.
 */
declare class Vaccinator {
    /** @param {DvConfig} config */
    constructor(config: DvConfig);
    /**
     * Cache config for the {@link changeAppId} function.
     * @type {DvConfig}
     * @private */
    private _config;
    /**
     * Current class connection to service URL.
     * @private */
    private _serviceUrl;
    /**
     * Currently used userName.
     * @private */
    private _userIdentifier;
    /**
     * Currently used password.
     * @private */
    private _password;
    /**
     * Currently used App ID.
     * @private */
    private _appId;
    /**
     * If true, this class will print debug to console.
     * @private */
    private _debugging;
    /**
     * Optional additional headers to add to fetch requests.
     * @private */
    private _headers;
    /**
     * Status for cache usage (initially true).
     * @private */
    private _useCache;
    /**
     * Currently used search fields.
     * @private */
    private _searchFields;
    /**
     * Current service provider id (enableDirectLogin).
     * @private */
    private _sid;
    /**
     * Current service provider password (enableDirectLogin).
     * @private */
    private _spwd;
    /**
     * Current database handle.
     * @private
     * @type {any} */
    private _db;
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
    public fromCache: any[];
    init(): Promise<void>;
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
    private _onError;
    /**
     * Outputs vaccinator class related text to debug console.
     * If debugging is activated.
     *
     * @private
     * @param {string} message
     */
    private _debug;
    /**
     * Saves the given AppId to the local database (using current userName).
     * If a password is known, it will save it encrypted!
     *
     * @private
     * @param {string} appId
     * @returns {Promise<void>}
     */
    private _saveAppId;
    /**
     * Converts a string into an array.
     * If the parameter is already an array, it's just returning it.
     *
     * @private
     * @param {string|Array} s
     * @returns {Array<string>}
     */
    private _string2Array;
    /**
     * Replace default fetch method with a XMLHttpRequest.
     *
     * @private
     * @param {{method: 'POST'|'GET', body: Object}} param0
     * @returns {Promise<string>} Response string
     */
    private _fetch;
    /**
     * Generate some random number Array with given
     * byte length.
     *
     * @private
     * @param {int} bytes
     * @returns {Uint8Array}
     */
    private _generateRandom;
    /**
     * Convert some array to hex encoded string
     *
     * @private
     * @param {Uint8Array} buffer
     * @returns {string}
     */
    private _buf2hex;
    /**
     * Convert some hex encoded string to Uint8Array
     *
     * @private
     * @param {string} hexString
     * @returns {Uint8Array}
     */
    private _hex2buf;
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
    private _encrypt;
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
    private _decrypt;
    /**
     * Returns the app-id as crypto key.
     *
     * Returns null in case there is no app-iD.
     * @private
     * @param {EncryptionMode?} mode Encryption mode. Default is `AES-GCM`.
     * @returns {Promise<CryptoKey?>}
     */
    private _getCryptoKey;
    /**
     * Returns the passed raw text as crypto key.
     *
     * @private
     * @param {string} text
     * @param {EncryptionMode?} mode Encryption mode. Default is `AES-GCM`.
     * @returns {Promise<CryptoKey>}
     */
    private _string2cryptoKey;
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
    private _chunk;
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
    private _searchHash;
    /**
     * Generate the array of SearchHash values for DataVaccinator protocol use.
     * Used for {@link new} and {@link update} function.
     * Quickly returns empty array if search functionality is not used.
     *
     * @private
     * @param {string} PID
     * @returns {Promise<Array<string>>} searchwords
     */
    private _getSearchWords;
    /**
     * Retrieves generic information from the connected DataVaccinator server.
     *
     * @returns {Promise<any>}
     */
    getServerInfo(): Promise<any>;
    /**
     * Raw new function. Wrapped an called by {@link new} & {@link publish}.
     *
     * @private
     * @param {string} PID
     * @param {{password:string, duration:number}?} publish
     * @returns {Promise<string>} New created vid.
     */
    private _new;
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
    new(PID: string): Promise<string>;
    /**
     * Returns the app-id that is currently in use.
     *
     * If no app-id is available or on storage failure, it throws an error!
     *
     * @param {boolean} force If true, the key will we be forced to read from database instead from possible cached value. Default is `false`.
     * @returns {Promise<string>} app-id
     */
    getAppId(force?: boolean): Promise<string>;
    /**
     * Create a new VID entry for publishing.
     *
     * @param {string} PID
     * @param {string} password
     * @param {number} duration
     * @returns {Promise<string>} New created vid.
     */
    publish(PID: string, password: string, duration: number): Promise<string>;
    /**
     * Update vaccinationData of an existing VID entry.
     *
     * @param {string} vid
     * @param {string} PID
     */
    update(vid: string, PID: string): Promise<void>;
    /**
     * Delete the given entry.
     *
     * @param {Promise<void>}
     */
    delete(vids: any): Promise<void>;
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
    get(vids: string | string[], force?: boolean): Promise<Map<string, VData>>;
    /**
     * Retrieve published data from DataVaccinator Vault.
     *
     * @param {string|string[]} vids
     * @param {string} password
     * @returns {Promise<Map<string, any>>}
     */
    getPublished(vids: string | string[], password: string): Promise<Map<string, any>>;
    /**
     * Wipe the given VID entry from the local cache.
     * This does not delete data from DataVaccinator Vault!
     *
     * @param {string|string[]} vids
     * @returns {Promise<Boolean>} success
     */
    wipe(vids: string | string[]): Promise<boolean>;
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
    changeAppId(vids: string | string[], oldAppId: string, newAppId: string): Promise<int>;
    /**
     * Wipe all locally cached information.
     *
     * Returns `true` if cache was wiped.
     * @param {string?} token
     * @returns {Promise<boolean>}
     */
    wipeCache(token: string | null): Promise<boolean>;
    /**
     * Search through the DataVaccinator Vault for entries.
     *
     * @param {string} searchTerm
     * @returns {Promise<Array<string>>} vids array
     */
    search(searchTerm: string): Promise<Array<string>>;
    /**
     * Store single data item in local cache
     *
     * Will throw an error on storage failure!
     * @private
     * @param {string} vid
     * @param {string} PID
     * @returns {Promise<void>}
     */
    private _storeCache;
    /**
     * Get single data item from cache.
     *
     * Will return null if not found!
     * @private
     * @param {string} vid
     * @returns {Promise<string|null>}
     */
    private _retrieveCache;
    /**
     * Removes given entries from the local cache.
     *
     * Will throw an error on storage failure!
     * @private
     * @param {Array<string>} vids
     * @returns {Promise<void>}
     */
    private _removeCache;
}
export namespace Vaccinator {
    /**
     * Convert some string into Uint8Array.
     *
     * @private
     * @static
     * @param {string} text
     * @returns {Uint8Array} utf-8 encoded
     */
    function _string2buffer(text: string): Uint8Array;
    /**
     * Convert some buffer into utf-8 encoded string.
     *
     * @private
     * @static
     * @param {Uint8Array} bytes
     * @returns {string} utf-8 encoded
     */
    function _buffer2string(bytes: Uint8Array): string;
    /**
     * Calculate SHA256 from some given string and
     * return hex encoded hash.
     *
     * @private
     * @static
     * @param {string} text
     * @returns {Promise<string>} hex encoded
     */
    function _hash(text: string): Promise<string>;
    /**
     * Validates the checksum of the given app-id.
     *
     * @public
     * @static
     * @param {string} appId
     * @returns {Promise<boolean>}
     */
    function validateAppId(appId: string): Promise<boolean>;
    /**
     * Enhanced promise pool handler as replacement for Promise.All()
     * @see https://gist.github.com/jcouyang/632709f30e12a7879a73e9e132c0d56b?permalink_comment_id=3591045#gistcomment-3591045
     *
     * @param {Array} queue Array of async functions to call
     * @param {number} concurrency Number of concurrent calls
     * @returns
     */
    function _promiseAll(queue: any[], concurrency: number): Promise<any[]>;
}
export type DvConfig = {
    /**
     * serviceURl is the URL where the API endpoint at the service provider is located. For example: https://service-provider.tld/protocol. All POST calls of the API will be sent to this destination. Please note that "same origin" policy might affect this. In the best case, this is the same domain than your app is running at.
     */
    serviceUrl: string;
    /**
     * user-identifier is some mandatory identifier that the class is using to handle different aspects of saving user related information (like app-id). Also, the class is submitting this information as uid parameter in all protocol calls to the service provider. We suggest to use the name of the user who is using your application (eg email address).
     */
    userIdentifier: string;
    /**
     * app-id is the end users application password for additional encryption. The vaccinator class expects some app-id known. If not submitted or undefined, the class is trying to get it from previous calls (local database). It throws an error if this fails.
     */
    appId: string | null;
    /**
     * password is used to encrypt the app-id in the local storage database. If not submitted or undefined, the app-id will get stored without any encryption (not recommended). We recommend to submit the password the user entered for log-in to your application or some organization password. By this, the local database will not leak the app-id in case someone is trying to read the browser database.
     */
    password: string | null;
    /**
     * Set to false to disable any local caching. We suggest to not turn caching on/off during a working session.  Default is `true`.
     */
    useCache: boolean | null;
    /**
     * Set debugMode to true in order to activate debug output to browser console. Mainly for finding bugs by the developer of DataVaccinator class but maybe also helpful for you. Default is `false`.
     */
    debugMode: boolean | null;
    /**
     * Define additional header values to send on service requests.
     */
    headers: Headers | null;
    /**
     * Here you submit an array of field names to be used for search function. If your payload is JSON and contains values for the given fields, they will get uploaded as SearchHash to the DataVaccinator Vault. This then allows you to find the assigned VIDs later using the search function. To disable the feature, submit an empty array or no parameter.
     */
    searchFields: Array<string> | null;
    /**
     * Enable direct login. By this, the protocol is enhanced by adding sid and spwd values (serviceProviderId and serviceProviderPwd). This is needed to directly access the DataVaccinator Vault without any intermediate or proxy instance.
     */
    directLogin: {
        serviceProviderId: int;
        serviceProviderPwd: string;
    } | null;
};
export type VData = {
    data: string | any;
    status?: string;
};
export type EncryptionMode = 'AES-CBC' | 'AES-GCM';
