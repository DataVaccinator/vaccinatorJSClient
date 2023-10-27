/*	generic helper constants
    ======================================================================= */

    // generic constants in use
    const kMaxElapsedTime = 500 // milliseconds, warn if someting takes longer
        , kText = 'The quick brown fox jumps over the lazy dog' // test content
        , kHexRegex = /^[0-9a-fA-F]+$/ // RegEx to validate hex string
        , appId = 'Rc-De_6nyCbb' // a valid appId for testing
        , individualSearchterm = (Math.random().toString(36)+'00000000000000000').slice(2, 12); // 10 digits random text

/*	variables
    ======================================================================= */
/**@type {Array<string>} */
const _vids = [];
/**@type {string} */
let _lastVid;
let _totalProcessCount = 0
    , _processes = [];


/*	helpers
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
 * Outputs a fancy styled line in the console
 * 
 * @param {string} text Message to print
 */
function _headline(text) {
    const infoColor = 'font-weight: bold; color: #004488; background-color: #f0f4ff';
    console.info("%c  -------------- "+text+" --------------  ", infoColor);
}

/**
 * Wait a given number of milliseconds. 
 * Use with await to get the effect.
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
 * Examines a Map with given vData structure.
 * If all .status entries of all items matches 'expect' value,
 * it returns true.
 * 
 * If at least one map entry.status does not match 'expect',
 * it returns false.
 * 
 * @param {Map<string, string>} result Map of results in vData struct
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
 * It set the global variable _lastVid and pushes
 * the vid into the global _vids array.
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
async function _test(f, validate, reason, shouldFail = false) {

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
            if(shouldFail) {
                if (success) {
                    console.assert(false, `${fName} should fail but it doesn't!`);
                }
            } else {
                console.assert(success, `${fName} failed!`, reason, result);
            }
        } catch (error) {
            if(shouldFail == false) { // we expected a failure
                console.assert(false, `${fName} failed!`, error);
            }
        } finally {
            const timeEnd = Date.now()
                , diff = timeEnd - timeStart;

            if(diff > kMaxElapsedTime) {
                console.warn(`${fName} is slower then expected. Time elapsed more then ${kMaxElapsedTime}ms.`);
            }

            console.log(`${r instanceof Promise ? '~>' : ''} ${fName} passed. Elapsed time: ${diff}ms.`);

            _processes.splice(_processes.indexOf(fName), 1);
            resolve(result);
        }
    });
}

/**
 * Enhanced promise pool handler as replacement for Promise.All()
 * @see https://gist.github.com/jcouyang/632709f30e12a7879a73e9e132c0d56b?permalink_comment_id=3591045#gistcomment-3591045
 * 
 * @param {Array} queue Array of async functions to call
 * @param {number} concurrency Number of concurrent calls
 * @returns 
 */
async function PromiseAll(queue, concurrency) {
    let index = 0;
    const results = [];
  
    // Run a pseudo-thread
    const execThread = async () => {
      while (index < queue.length) {
        const curIndex = index++;
        // Use of `curIndex` is important because `index` may change after await is resolved
        results[curIndex] = await queue[curIndex]();
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