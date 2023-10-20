/// <reference path="../vaccinator_api.d.ts" />

/*	constants
    ======================================================================= */
const kMaxElipsedTime = 500
    , kText = 'The quick brown fox jumps over the lazy dog'
    , kHexRegex = /^[0-9a-fA-F]+$/;

/*	test functions
    ======================================================================= */
async function v2() {
    console.info('Starting vaccinator direct test v2.');

    /**@type {VData} */ // TODO: Umlaute & Sonderzeichen & Nur UTF-8
    const vData = {
            data: `{
                "firstname":"Spongebob","lastname":"Square Pants",
                "gender":"male","address_street":"Bikinistreet",
                "address_number":"42","address_city":"Bikini Bottom",
                "address_zip":"12345","address_country":"Bikiniland",
                "address_phone":"","address_mail":"spongebob@bikinibottom.water",
                "company_location":"Crusty Krab","date_og_birth":"01.02.1992",
                "profession":"Fry Cook","attending_physician":"Sandy Cheeks"
            }`
        }
        , appId = 'Rc-De_6nyCbb'
        , cbc = 'aes-256-cbc:672eaee8d6f4ca4e5ef1b1a448f10493:95b9d5d5b13212072a9f2e203648d4a1d4107ae55f77cdc7fed2ceb50bb4be3a780f787dfc467e66a2964e78da274599' // => 'The quick brown fox jumps over the lazy dog'
        , gmc = 'aes-256-gcm:eadfe1c268182463747c081caef526c8:42c54b4dbfe1da299196ddb328ae4dc24c712797e206cb79935f25ddbc724cecdc09d20b165c0ecf80918e6aaa63026915b40d83bd65826b3629d3' // => 'The quick brown fox jumps over the lazy dog'
        , notExistingVid = 'dc2520e55dbc02d44a6ebc160cbffa62'
        , nonSense = '_nonSense';

    const v = new Vaccinator({
        serviceUrl: 'http://127.0.0.1:8080',
        userIdentifier: 'testuser',
        password: 'password', // TODO: 'pässword' => appid
        appId: appId,
        debugMode: false,
        headers: {'cache-control': 'max-age=60'},
        searchFields: [ "firstname", "lastname", "address_street" ],
        directLogin: {
            serviceProviderId: 1,
            serviceProviderPwd: 'dv123'
        },
    });
    await v.init();

    let tmp;

    // encrypt / decrypt
    // let key = await v._getCryptoKey(); // AES-GCM test
    // tmp = await _test(() => v._encrypt('data', key), r => /^aes-256-gcm:\w{32}:\w+$/.test(r), 'Result should match the regex!');
    // await _test(() => v._decrypt(tmp, key), r => 'data' == r, 'Result does not match!');
    // tmp = await _test(() => v._encrypt('!?Ä*&A data', key), r => /^aes-256-gcm:\w{32}:\w+$/.test(r), 'Result should match the regex!');
    // await _test(() => v._decrypt(tmp, key), r => '!?Ä*&A data' == r, 'Result does not match!');
    // tmp = await _test(() => v._encrypt('!?Ä*&A请 data', key), r => /^aes-256-gcm:\w{32}:\w+$/.test(r), 'Result should match the regex!');
    // await _test(() => v._decrypt(tmp, key), r => '!?Ä*&A请 data' == r, 'Result does not match!');
    // tmp = await _test(() => v._encrypt(kText, key), r => /^aes-256-gcm:\w{32}:\w+$/.test(r), 'Result should match the regex!');
    // await _test(() => v._decrypt(tmp, key), r => kText == r, 'Result does not match!');
    // _test(() => v._decrypt(gmc, key, 'eadfe1c268182463747c081caef526c8'), r => kText == r, 'Result does not match!');
    // _test(() => v._decrypt(gmc, key, '_eadfe1c268182463747c081caef526c8'), r => r, 'Result does not match!', true);

    // key = await v._getCryptoKey('AES-CBC'); // AES-CBC test
    // await _test(() => v._decrypt(cbc, key), r => kText == r, 'Result does not match!');


    // hash
    // Vaccinator.__hash('Hallo').then(v => {
    //     _test(() => Vaccinator._hash('Hallo'), r => r == v, 'Not equal!');
    // });
    // Vaccinator.__hash('Hallo !?Ä*&A').then(v => {
    //     _test(() => Vaccinator._hash('Hallo !?Ä*&A'), r => r == v, 'Not equal!');
    // });
    // Vaccinator.__hash('Hallo !?Ä*&A请').then(v => {
    //     _test(() => Vaccinator._hash('Hallo !?Ä*&A请'), r => r == v, 'Not equal!');
    // });

    // helper
    // await _test(() => v._generateRandom(16), r => ((tmp = r) && r.byteLength == 16), 'Array should be the same length!');
    // await _test(() => v._buf2hex(tmp), r => kHexRegex.test(tmp = r), 'Result should match the regex!');
    // await _test(() => v._hex2buf(tmp), r => (r instanceof Uint8Array), 'Result should be a Uint8Array!');
    // await _test(() => Vaccinator._string2buffer(kText), r => kText == Vaccinator._buffer2string(r), 'Result should match!');

    // search internal
    // _test(() => v._searchHash('Hallo'), r => !!r, '!');
    // _test(() => v._searchHash(kText), r => r == '4919423bdcc82dae251d434e90992d15c3320a95597222b616d11b17e80fa1656bcb544a3147e793012298', 'Result should match the string!');
    // _test(() => v._searchHash(kText.substring(1)), r => r !== '4919423bdcc82dae251d434e90992d15c3320a95597222b616d11b17e80fa1656bcb544a3147e793012298', 'Result should not match the string!');
    // _test(() => v._searchHash('data', true), r => kHexRegex.test(r), 'Result should match the regex!');
    _test(() => v._getSearchWords(vData), r => (r && r.length == 4), 'Result should math the search fields length!');

    // store / cache
    // _test(() => v._storeCache('1', vData), r => !r, 'Result should not fail!');
    // _test(() => v._saveAppId(appId), r => !r, 'Result should not be null!');
    // _test(() => v._retrieveCache('1'), r => !!r, 'Result should not be null!');
    // _test(() => v._retrieveCache('_1'), r => !r, 'Result should be null!');
    // _test(() => v._removeCache(['1', '2']), r => !r, 'Result should not fail!');

    // // public functions
    await _test(() => v.new(vData), r => _pushVid(r), 'Result should not be null!'); // !!!! needed for further tests

    // // get
    // _test(() => v.getServerInfo(), r => !!r, 'Result should not be null!');
    // _test(() => v.get(_lastVid), r => _validateMap(r), 'Result should math!');
    // _test(() => v.get(_lastVid, true), r => _validateMap(r), 'Result should match!');
    // _test(() => v.get(notExistingVid), r => _validateMap(r, 'NOTFOUND'), 'Result should not fail!');
    // _test(() => v.get(notExistingVid, true), r => _validateMap(r, 'NOTFOUND'), 'Result should not fail!');
    // _test(() => v.get(nonSense, true), r => r, 'Result should fail!', true);
    // _test(() => v.get([_lastVid, notExistingVid]), r => r.size == 2, 'Result should match!');
    // _test(() => v.get([_lastVid, notExistingVid], true), r => r.size == 2, 'Result should match!');
    // _test(() => v.get([_lastVid, nonSense]), r => r, 'Result should fail!', true);

    // // update
    // vData.data =    '{"firstname":"Dr. Patrick","lastname":"Star",'+
    //                 '"address_street":"Bikini-Street"}';
    // await _test(() => v.update(_lastVid, vData), r => !r, 'Result should not fail!');
    // _test(() => v.update('_wrongVid', vData), r => !r, 'Result should failed!', true);

    // // search
    // _test(() => v.search('pat'), r => r.length == 1, 'Wrong number of results!');
    // _test(() => v.search(nonSense), r => r.length == 0, 'Wrong number of results!');
    // _test(() => v.search('patr sta'), r => r.length == 1, 'Wrong number of results!');
    // _test(() => v.search('patr tes'), r => r.length == 0, 'Wrong number of results!');
    // _test(() => v.search('Bikini Street'), r => r.length == 1, 'Wrong number of results!');
    // _test(() => v.search('Dr. Patrick'), r => r.length == 1, 'Wrong number of results!');

    // // publish
    // await _test(() => v.publish(vData, 'password', 5), r => _pushVid(r), 'Result should not be null!');
    // await _test(() => v.getPublished(_lastVid, 'password'), r => (r && r[_lastVid].status == "OK"), 'Result should not be empty!');
    // _test(() => v.getPublished(_lastVid, '_password'), r => !!r, 'Result should fail!', true);

    // // app-Id
    // await _test(() => v.getAppId(), r => appId == r, 'Result should mathc!');
    // await _test(() => v.getAppId(true), r => appId == r, 'Result should match!');
    // await _test(() => Vaccinator.validateAppId('Rc-De_6nyCbb'), r => !!r, 'Result should not be false!');
    // await _test(() => Vaccinator.validateAppId(nonSense), r => !r, 'Result should not be true!');

    // // wipe
    // await _test(() => v.wipe(_lastVid), r => !r, 'Result should fail!');
    // _test(() => v.get(_lastVid), r => _validateMap(r), 'Result should match!'); // result should be fetched from local storage.

    // delete
    // await _test(() => v.delete(nonSense), r => !r, 'Result should fail!', true);
    // await _test(() => v.delete(nonSense), r => !r, 'Result should fail!', true);
    // await _test(() => v.delete(notExistingVid), r => !r, 'Should not fail!');

    // changeAppId
    // tmp = await Vaccinator.__hash('new-app-id');
    // await _test(() => v.wipeCache(), r => r, 'Result should be true!');
    // await _test(() => v.changeAppId(_lastVid, appId, 'new-app-id' + tmp.slice(-2)), r => r == 1, 'Result should match length!');
    // await _test(() => v.wipeCache(), r => r, 'Result should be true!');
    // _test(() => v.get(_lastVid), r => _validateMap(r), 'Result should be valid!');

    await _wait(kMaxElipsedTime); // wait for uncompleted functions

    // clean all created vid
    if(_vids.length) {
        await _test(() => v.delete(_vids), r => !r, 'Result should not fail!');
    }

    // finish
    if(_processes.length > 0) {
        console.warn(`${_totalProcessCount} tests excecuted but ${_processes.length} not completed: ${JSON.stringify(_processes)}`);
    } else {
        console.info("All tests excecuted.");
    }
}

async function v1() {
    console.info('Starting vaccinator direct test v1.');

    let vData = '{"firstname":"Spongebob","lastname":"Square Pants", '+
            '"gender":"male","address_street":"Bikinistreet", '+
            '"address_number":"42","address_city":"Bikini Bottom", '+
            '"address_zip":"12345", "address_country":"Bikiniland", '+
            '"address_phone":"","address_mail":"spongebob@bikinibottom.water", '+
            '"company_location":"Crusty Krab", "date_og_birth":"01.02.1992", '+
            '"profession":"Fry Cook", "attending_physician":"Sandy Cheeks"'+
            '}';

    const v = new vaccinator();
    await _test(() => v.init("http://192.168.64.6:80", "kristof", "Rc-De_6nyCbb", "password", false));
    await _test(() => v.enableDirectLogin(1, "vaccinator"), b => b === true, 'Should be true!');
    await _test(() => v.setHeaders( { 'Cache-Control': 'max-age=60' } ), b => b === true, 'Should be true!');
    await _test(() => v.enableSearchFunction( [ "firstname", "lastname", "address_street" ] ), b => b === true, 'Should be true!');
    await _test(() => v.getServerInfo(), r => r, 'Result should not be null!');

    await _test(() => v.new(vData), r => _pushVid(r), 'New user VID is empty!');
    vData = '{"firstname":"Dr. Patrick","lastname":"Star",'+
            '"address_street":"Bikini-Street"}';
    await _test(() => v.update(_lastVid, vData), r => r, 'Result should not be empty!');
    _test(() => v.wipe(_lastVid + " " + "dc2520e55dbc02d44a6ebc160cbffa62"), r => r, 'Result should not be empty!');
    _test(() => v.get([_lastVid, "0d52f1b0a314fba7d45e87ca5bf5e654"]), r => r, 'Result should not be empty!');
    _test(() => v.search('pat'), r => r.length == 1, 'Wrong number of results!');
    _test(() => v.search('nonsense'), r => r.length == 0, 'Wrong number of results!');
    _test(() => v.search('patr sta'), r => r.length == 1, 'Wrong number of results!');
    _test(() => v.search('patr tes'), r => r.length == 0, 'Wrong number of results!');
    _test(() => v.search('Bikini Street'), r => r.length == 1, 'Wrong number of results!');
    _test(() => v.search('Dr. Patrick'), r => r.length == 1, 'Wrong number of results!');
    // await _wait(1000); // give a second search time before continue modifying values.

    // A weekday token will force the cache to become
    // wiped every day (just as an example).
    const token = "token-weekday-" + new Date().getDay();
    await _test(() => v.wipeCache(token), r => true);
    vData = '{"firstname":"Sandy","lastname":"Cheeks", '+
        '"gender":"female","address_street":"Bikinistreet", '+
        '"address_number":"8","address_city":"Bikini Bottom", '+
        '"address_zip":"12345", "address_country":"Bikiniland"'+
        '}';
    await _test(() => v.publish(vData, "myPassword", 5), r => _pushVid(r), 'New VID is empty!');
    _test(() => v.getPublished([ _lastVid, "ff52f1b0a314fba7d45e87ca5bf5e654" ], "myPassword"), r => r, 'Result should not be empty!');
    _test(() => v.getPublished("ff52f1b0a314fba7d45e87ca5bf5e654", "myPassword"), r => (!r || r["ff52f1b0a314fba7d45e87ca5bf5e654"].status == "NOTFOUND"), 'Result should not exist!');
    _test(() => v.getPublished(_lastVid, "wrongPassword"), r => (!r || r[_lastVid].status == "ERROR"), 'Result should fail!');

    // clean all created vids
    await _test(() => v.delete(_vids), r => (r && r.length), 'Deleted VIDs should not be empty!');
}


/*	variables
    ======================================================================= */
/**@type {Array<string>} */
const _vids = [];
/**@type {string} */
let _lastVid;
let _totalProcessCount = 0
    , _processes = [];


/*	helper
    ======================================================================= */
/**
 * Wraps return value to print to console.
 *
 * @param {any} e any value
 * @returns {any} same value
 */
function _log(e) {
    console.warn(e);
    return e;
}

/**
 *
 * @param {number} ms
 * @returns {Promise<void>}
 */
async function _wait(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

/**
 *
 * @param {Map<string, string>} result
 * @param {'OK'|'NOTFOUND'|'INVALID'} expect Default: `OK`
 * @returns {boolean}
 */
function _validateMap(result, expect = 'OK') {
    if(!result.size) return false; // if we call this validation, we expect an non empty Map.
    for (const [key, value] of result) {
        if(value.status !== expect) return false;
    }
    return true;
}

/**
 * Collects the pushed vid for later deletion.
 *
 * @param {string} vid
 * @return {String} same vid.
 */
function _pushVid(vid) {
    if(!vid) return;
    _lastVid = vid;
    _vids.push(vid);
    return vid;
}

/**
 * Test function.
 * Pass an async or synchrounus functions.
 *
 * ! Don't forget to wrapp into an anonymous function !
 *
 * @param {() => Function} f Wrapped function.
 * @param {((result?: any) => boolean)} validate
 * @param {string?} reason Reason, if validate should return false.
 * @param {boolean?} shouldFail If this function will throw an expected error, pass true.
 */
async function _test(f, validate, reason, shouldFail) {

    return new Promise(async (resolve) => {
        const fName = f.toString().substring(6)
            , timeStart = Date.now();

        _processes.push(fName);
        _totalProcessCount++; //  count total processes

        let success = false
            , r // holds the result value from calling of the passed function f.
            , result; // holds the total result after the function f is resolved.

        try {
            r = f.call(f);
            if(r instanceof Promise) {
                console.log(`${fName} called async. Waiting for resolve...`);
                success = validate.call(validate, (result = await r));
            } else {
                success = validate.call(validate, (result = r));
            }
            if(shouldFail && success) {
                console.assert(false, `${fName} should fail but it doesn't!`);
            } else {
                console.assert(success, `${fName} failed!`, reason, result);
            }
        } catch (error) {
            if(!shouldFail) { // we expect a failure
                console.assert(false, `${fName} failed!`, error);
            }
        } finally {
            const timeEnd = Date.now()
                , diff = timeEnd - timeStart;

            if(diff > kMaxElipsedTime) {
                console.warn(`${fName} is slower then expected. Time elipsed more then ${kMaxElipsedTime}ms.`);
            }

            console.log(`${r instanceof Promise ? '~>' : ''} ${fName} passed. Elipsed time: ${diff}ms.`);

            _processes.splice(_processes.indexOf(fName), 1);
            resolve(result);
        }
    });
}
