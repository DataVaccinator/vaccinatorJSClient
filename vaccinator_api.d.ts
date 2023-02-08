/**
 * vaccinatorJsClient class module
 * @license MIT License
 * @link https://www.datavaccinator.com
 * See github LICENSE file for license text.
 */
declare class vaccinator {
    /** @private */
    private url;
    /** @private */
    private userName;
    /** @private */
    private password;
    /** @public */
    public appId: string;
    /** @public */
    public debugging: boolean;
    /** @private */
    private headers;
    /** @public */
    public useCache: boolean;
    /** @private */
    private cache;
    /** @private */
    private searchFields;
    /** @private */
    private sid;
    /** @private */
    private spwd;
    /** @public */
    public fromCache: any[];
    /**
     * @param {string} url
     * @param {string} userName
     * @param {string?} appId
     * @param {string?} password
     * @param {boolean?} debugMode
     * @returns {Promise<boolean>} self
     */
    init(url: string, userName: string, appId: string | null, password: string | null, debugMode: boolean | null): Promise<boolean>;
    /**
     *
     * @private
     * @param {string} vData
     * @param {boolean} publishing
     * @param {string} password
     * @param {int} duration
     * @returns {Promise<string>} vid
     */
    private _new;
    /**
     * @param {string} vData
     * @returns {Promise<string>} vid
     */
    new(vData: string): Promise<string>;
    /**
     * @param {string} vData
     * @returns {Promise<Promise<string>>} vid
     */
    publish(vData: string, password: any, duration: any): Promise<Promise<string>>;
    /**
     * @param {string} vid
     * @param {string} vData
     * @returns {Promise<string>} vid
     */
    update(vid: string, vData: string): Promise<string>;
    /**
     * @param {string|string[]} vids
     * @returns {Promise<string>} vids
     */
    delete(vids: string | string[]): Promise<string>;
    /**
     * @param {string|string[]} vids
     * @returns {Promise<string>}
     */
    get(vids: string | string[]): Promise<string>;
    /**
     * @param {string|string[]} vids
     * @returns {Promise<string>}
     */
    getPublished(vids: string | string[], password: any): Promise<string>;
    /**
     * @param {string|string[]} vids
     * @returns {Promise<string>} vids
     */
    wipe(vids: string | string[]): Promise<string>;
    /**
     * @param {string|string[]} vids
     * @param {string} oldAppId
     * @param {string} newAppId
     * @returns {Promise<int>} affectedCount
     */
    changeAppId(vids: string | string[], oldAppId: string, newAppId: string): Promise<int>;
    /**
     * @param {string?} token
     * @returns {Promise<boolean>}
     */
    wipeCache(token: string | null): Promise<boolean>;
    /**
     * @private
     * @param {string?} token
     * @returns {Promise<boolean>}
     */
    private _wipeCache;
    /**
     * @returns {Promise<Array<any>>}
     */
    getServerInfo(): Promise<Array<any>>;
    /**
     * @param {string[]?} fields
     * @returns {boolean}
     */
    enableSearchFunction(fields: string[] | null): boolean;
    /**
     * @param {string} searchTerm
     * @returns {Promise<Array<string>>} vids array
     */
    search(searchTerm: string): Promise<Array<string>>;
    /**
     * @returns {Promise<string>} app-id
     */
    getAppId(): Promise<string>;
    /**
     * @param {string} appId
     * @returns {boolean}
     */
    validateAppId(appId: string): boolean;
    /**
     * @param {Headers} headersObj
     * @returns {boolean}
     */
    setHeaders(headersObj: Headers): boolean;
    /**
     * @param {int} serviceProviderId
     * @param {string} serviceProviderPwd
     * @returns {boolean}
     */
    enableDirectLogin(serviceProviderId: int, serviceProviderPwd: string): boolean;
    /**
     * Saves the given AppId to the local database (using current userName).
     * If a password is known, it will save it encrypted!
     *
     * @private
     * @param {string} appId
     * @returns {Promise<any>}
     */
    private _saveAppId;
    /**
     * Calculates the SHA256 from the known user password.
     * Returns false in case there is no valid password.
     * Note: This is only used for storing the App-ID in local browser cache.
     *
     * @private
     * @returns {Uint8Array|false}
     */
    private _getPasswordKey;
    /**
     * Calculates the SHA256 from the current App-ID.
     * Returns false in case there is no valid App-ID.
     *
     * @private
     * @returns {Uint8Array|false}
     */
    private _getKey;
    /**
     * Generate some random number Array with given
     * byte length. Uses Math.random()!
     *
     * @private
     * @param {int} bytes
     * @returns {Array<number>}
     */
    private _generateRandom;
    /**
     * Convert some array to hex encoded string
     *
     * @private
     * @param {Array} buffer
     * @returns {ArrayBuffer}
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
     * Calculate SHA256 from some given string and
     * return hex encoded hash.
     *
     * @private
     * @param {string} someString
     * @returns {string}
     */
    private _hash;
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
    private _encrypt;
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
    private _decrypt;
    /**
     * Outputs vaccinator class related text to debug console
     * if debugging is activated
     *
     * @private
     * @param {string} message
     */
    private _debug;
    /**
     * Store data in cache
     *
     * @private
     * @param {string} vid
     * @param {string} vData
     * @returns {Promise<boolean>} success
     */
    private _storeCache;
    /**
     * Getdata from cache. Will return null if not found!
     *
     * @private
     * @param {string} vid
     * @returns {Promise<string|null>}
     */
    private _retrieveCache;
    /**
     * Removes one given entry from the cache
     *
     * @private
     * @param {Array<string>} vids
     * @returns {Promise<boolean>}
     */
    private _removeCache;
    /**
     * Generates the SearchHash from given word. If withRandom is true,
     * zero to 5 random bytes are getting added. See search Plugin documentation.
     *
     * @private
     * @param {string} word
     * @param {boolean?} withRandom
     * @returns {string}
     */
    private _searchHash;
    /**
     * Generate the array of SearchHash values for DataVaccinator protocol use.
     * Ued for userNew() and userUpdate() function.
     * Quickly returns empty array if search functionality is not used.
     *
     * @private
     * @param {string|object} vData
     * @returns {Array<string>} searchwords
     */
    private _getSearchWords;
    userNew(vData: any): Promise<string>;
    userUpdate(vid: any, vData: any): Promise<string>;
    userDelete(vids: any): Promise<string>;
    userGet(vids: any): Promise<string>;
    userWipe(vids: any): Promise<string>;
}
