/// <reference path="../vaccinator_api.d.ts" />

/*	test functions
    ======================================================================= */

async function test() {
    _headline("Starting vaccinator change AppId test");

    // number of datasets to test this function with
    // -> successfully tested with 20.000 (needed 5.3 Minutes to re-encrypt with cache) 
    //    10/2023 by VS
    const numberOfDatasets = 10;

    /**@type {vData} */ // TODO: Umlaute & Sonderzeichen & Nur UTF-8
    const vData = {
            data: `{
                "firstname":"Spongebob","lastname":"Square Pants",
                "gender":"male","address_street":"Bikinistreet",
                "address_number":"42","address_city":"${individualSearchterm}",
                "address_zip":"12345","address_country":"Bikiniland",
                "address_phone":"","address_mail":"spongebob@bikinibottom.water",
                "company_location":"Crusty Krab","date_og_birth":"01.02.1992",
                "profession":"Fry Cook","attending_physician":"Sandy Cheeks"
            }`
        }
        , nonSense = 'nonsense';

    const v = new Vaccinator({
        serviceUrl: kServiceUrl,
        userIdentifier: kUsername,
        password: kPassword, // TODO: 'pässword' => appid
        appId: appId,
        debugMode: false,
        useCache: true,
        headers: {'cache-control': 'max-age=60'},
        searchFields: [ "firstname", "lastname", "address_city" ],
        directLogin: {
            serviceProviderId: kServiceProviderId,
            serviceProviderPwd: kServiceProviderPwd
        },
    });
    await v.init();

    if (v._useCache) {
        console.info("wiping any previously cached values");
        v.wipeCache();
    }

    var appidNew = "Zdn45jhdn425";

    // create numberOfDatasets new entries
    _headline("Creating "+numberOfDatasets+" payload datasets with existing old appId");
    
    // Using Promises.All() -> All at the same time. With > 500 datasets, webbrowser may fail!
    
    // var promises = Array(); // array of promises
    // for (var i = 0; i < numberOfDatasets; i++) {
    //   promises.push(v.new(vData));
    // }
    // var vids = await Promise.all(promises)

    // Using pAll promise helper function -> Max 5 calls at the same time. Even > 2000 datasets are no problem.
    var promises = []; // array of function calls
    for (var i = 0; i < numberOfDatasets; i++) {
      promises.push(() => v.new(vData));
    }
    var vids = await Vaccinator.PromiseAll(promises, 25); // max 25 promises at once

    console.log("Created VIDs: ", vids);

    // do some test searching
    _headline("search in original data");
    await _test(() => v.search(individualSearchterm), r => r.length == vids.length, 'Wrong number of results! (Clear DV vault DB?)');
    await _test(() => v.search(nonSense), r => r.length == 0, 'Wrong number of results!');

    // do some test get
    _headline("get original data");
    await _test(() => v.get(vids), r => _validateMap(r), 'Results should all return and match!');

    // the switch of the appId
    _headline("Switching to new appId");
    await _test(() => v.changeAppId(vids, appId, appidNew), r => r == vids.length, 
        'Updated/changed count should match original count!');

    // search again to make sure that all search data was also updated
    _headline("search in changed data");
    await _test(() => v.search(individualSearchterm), r => r.length == vids.length, 'Wrong number of results! (Clear DV vault DB?)');
    await _test(() => v.search(nonSense), r => r.length == 0, 'Wrong number of results!');
    
    // do some test get
    _headline("get changed data (using cache if available)");
    await _test(() => v.get(vids), r => _validateMap(r), 'Results should all return and match!');
    _headline("get changed data (without cache)");
    await _test(() => v.get(vids, true), r => _validateMap(r), 'Results should all return and match!');

    // Test if current v has new AppId in use
    _headline("get new appId");
    await _test(() => v._appId, r => r == appidNew, 'New AappId should be returned by local property _appId!');

    _headline("Cleanup data");
    if(vids.length) {
        await _test(() => v.delete(vids), r => !r, 'Deletion should not fail!');
    }

    _headline("Finished changeAppId and updated " + vids.length + " items.");
}