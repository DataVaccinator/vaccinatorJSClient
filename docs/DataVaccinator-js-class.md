author: Volker Schmid <v.schmid@inspirant.de>

title: DataVaccinator JavaScript Class API

Content
=======

JavaScript Client API
=====================

The Client API is the interface that is provided by the DataVaccinator
JavaScript API for client software developers.

Include the DataVaccinator JavaScript API and all needed classes into your
existing application using this in the &lt;head&gt; section:

    <!-- start vaccinator include -->
    <script src="localforage.min.js"></script>
    <script src="forge-sha256.min.js"></script>
    <script src="aes.js"></script>
    <script src="vaccinator_api.js"></script>
    <!-- end vaccinator include -->

Now, there is a new class `vaccinator` available.

Please note that the *localforage.min.js* is for local database access,
the *aes.js* is for AES encryption, the *forge-sha256.min.js* is for
providing hash algorithm and *vaccinator_api.js* is the final class code you
want to use.

All class functions except the validateAppId() and setHeaders() functions 
are asynchronous and return a promise. Don't forget to wrap a try/catch
block around your class calls to handle potential errors thrown by the 
vaccinator class like in this example:

    try {
      var v = new vaccinator();
      v.init("https://serviceprovider.com/service.php", "username", "appid", "password", false)
      .then(function() {
        console.log("Successfully initialized vaccinator class");
      }
    } catch (e) {
      // catch any vaccinator class errors from here. e is vaccinatorError class.
      console.error(e);
    }

The vaccinator class offers the following functions:

init
----

<table>
  <colgroup>
    <col width="17%" />
    <col width="82%" />
  </colgroup>
  <tbody>
    <tr class="odd">
      <td>Description:</td>
      <td>Initialize a new vaccinator session.</td>
    </tr>
    <tr class="even">
      <td>Parameters:</td>
      <td>(string) serviceURL, (string) user-identifier, (optional string) app-id, (optional string) password, optional boolean) debugMode</td>
    </tr>
    <tr class="odd">
      <td>Return value:</td>
      <td>(promise) (boolean) true = success</td>
    </tr>
    <tr class="even">
      <td>Info:</td>
      <td><p><code>serviceURl</code> is the URL where the API endpoint at the service provider is located. For example: &quot;https://service-provider.tld/protocol&quot;. All POST calls of the API will be sent to this destination. Please note that &quot;same origin&quot; policy might affect this. In the best case, this is the same domain than your app is running at.</p>
      <p>This might be the DataVaccinator URL directly, in case you plan to use the <code>enableDirectLogin()</code> function.
        <p><code>user-identifier</code> is some mandatory identifier that the class is using to handle different aspects of saving user related information (like app-id). Also, the class is submitting this information as <code>uid</code> parameter in all protocol calls to the service provider. We suggest to use the name of the user who is using your application (eg email address).</p>
        <p><code>app-id</code> is the end users application password for additional encryption. The vaccinator class expects some app-id known. If not submitted or undefined, the class is trying to get it from previous calls (local database). It throws an error if this fails.</p>
        <p><code>password</code> is used to encrypt the app-id in the local storage database. If not submitted or undefined, the app-id will get stored without any encryption (not recommended). We recommend to submit the password the user entered for log-in to your application. By this, the local database will not leak the app-id in case someone is trying to read the browser database.</p>
        <p>Set <code>debugMode</code> to true in order to activate debug output to browser console. Mainly for finding bugs by the developer of vaccinator service class but maybe also helpful for you.</p></td>
    </tr>
  </tbody>
</table>

new
-------

<table>
  <colgroup>
    <col width="17%" />
    <col width="82%" />
  </colgroup>
  <tbody>
    <tr class="odd">
      <td>Description:</td>
      <td>Create a new user entry.</td>
    </tr>
    <tr class="even">
      <td>Parameters:</td>
      <td>(string) vaccinationData</td>
    </tr>
    <tr class="odd">
      <td>Return value:</td>
      <td>(promise) (string) VID</td>
    </tr>
    <tr class="even">
      <td>Info:</td>
      <td>The <code>vaccinationData</code> is some JSON encoded dataset. It may contain personal information of a person. This is then returned later by <code>get</code>.</td>
    </tr>
  </tbody>
</table>

update
----------

<table>
  <colgroup>
    <col width="17%" />
    <col width="82%" />
  </colgroup>
  <tbody>
    <tr class="odd">
      <td>Description:</td>
      <td>Update vaccinationData of an existing user entry.</td>
    </tr>
    <tr class="even">
      <td>Parameters:</td>
      <td>(string) VID, (string) vaccinationData</td>
    </tr>
    <tr class="odd">
      <td>Return value:</td>
      <td>(promise) (string) VID</td>
    </tr>
    <tr class="even">
      <td>Info:</td>
      <td><p>The <code>VID</code> is the identifying Vaccination ID (for example, previously returned by new).</p>
        <p>The <code>vaccinationData</code> is some JSON encoded dataset. It may contain personal information of a person.</p></td>
    </tr>
  </tbody>
</table>

get
-------

<table>
  <colgroup>
    <col width="17%" />
    <col width="82%" />
  </colgroup>
  <tbody>
    <tr class="odd">
      <td>Description:</td>
      <td>Retrieve the vaccinationData of a given user entry.</td>
    </tr>
    <tr class="even">
      <td>Parameters:</td>
      <td>(array) multiple VIDs or (string) VID</td>
    </tr>
    <tr class="odd">
      <td>Return value:</td>
      <td>(promise) (object array) vaccinationData</td>
    </tr>
    <tr class="even">
      <td>Info:</td>
      <td><p>The submitted <code>VID</code> is the identifying Vaccination ID (previously returned by new). Multiple VIDs can be submitted as array with multiple VIDs or a string with multiple VIDs divided by blank.</p>
        <p>The returned payload is an associative object array with the <code>VID</code> as key and some object as value. The value object is having two fields: <code>status</code> (OK or NOTFOUND) and <code>data</code> (the Vaccination Data). If <code>status</code> is NOTFOUND, data is false.</p>
        <p>This is a typical object array response like displayed in Firefox console:</p>
        <pre><code>0d52f1b0a314fba7d45e87ca5bf5e654:
  Object { status: &quot;OK&quot;, 
           data: &quot;{\&quot;fn\&quot;:\&quot;Spongebob\&quot;,\&quot;ln\&quot;:\&quot;Squarepants\&quot;}&quot; 
         }
1d52f1b0a314fba7d45e87ca5bf5e654: 
  Object { status: &quot;NOTFOUND&quot;, 
           data: false 
         }
fb9a6fd4c504878b2a76d9e78af795bb: 
  Object { status: &quot;OK&quot;, 
           data: &quot;{\&quot;fn\&quot;:\&quot;Patrick\&quot;,\&quot;ln\&quot;:\&quot;Star\&quot;}&quot; 
         }</code></pre>
        <p>Access the results like this:</p>
        <p><code>var status =
            result['0d52f1b0a314fba7d45e87ca5bf5e654']['status];</code></p></td>
    </tr>
  </tbody>
</table>

delete
----------

<table>
  <colgroup>
    <col width="17%" />
    <col width="82%" />
  </colgroup>
  <tbody>
    <tr class="odd">
      <td>Description:</td>
      <td>Delete the given user entry.</td>
    </tr>
    <tr class="even">
      <td>Parameters:</td>
      <td>(array) multiple VIDs or (string) VID</td>
    </tr>
    <tr class="odd">
      <td>Return value:</td>
      <td>(promise) (array) VID(s)</td>
    </tr>
    <tr class="even">
      <td>Info:</td>
      <td>The <code>VID</code> is the identifying Vaccination ID (for example, returned by new). Multiple VIDs can be submitted as array with multiple VIDs or a string with multiple VIDs divided by blank.</td>
    </tr>
  </tbody>
</table>

wipe
--------

<table>
  <colgroup>
    <col width="17%" />
    <col width="82%" />
  </colgroup>
  <tbody>
    <tr class="odd">
      <td>Description:</td>
      <td>Wipe the given user entry from the local cache (does not delete data from DataVaccinator service!)</td>
    </tr>
    <tr class="even">
      <td>Parameters:</td>
      <td>(array) multiple VIDs or (string) VID</td>
    </tr>
    <tr class="odd">
      <td>Return value:</td>
      <td>(promise) (array) VID(s)</td>
    </tr>
    <tr class="even">
      <td>Info:</td>
      <td>The <code>VID</code> is the identifying Vaccination ID (for example, returned by new). Multiple VIDs can be submitted as array with multiple VIDs or a string with multiple VIDs divided by blank. Please note that, if the <code>VID</code> is requested after this was called, the system will request it again from the DataVaccinator service and will update the cache. A possible use case is, if you know that the local cache is outdated for this <code>VID</code>, you can force the system to refresh its cache by wiping the user with this function.</td>
    </tr>
  </tbody>
</table>

wipeCache
---------

<table>
  <colgroup>
    <col width="17%" />
    <col width="82%" />
  </colgroup>
  <tbody>
    <tr class="odd">
      <td>Description:</td>
      <td>Wipe all locally cached information.</td>
    </tr>
    <tr class="even">
      <td>Parameters:</td>
      <td>(string) token (optional, unset or empty string to force wipe)</td>
    </tr>
    <tr class="odd">
      <td>Return value:</td>
      <td>(promise) (boolean) true = cache was wiped, false = cache stayed untouched</td>
    </tr>
    <tr class="even">
      <td>Info:</td>
      <td>
        <p>This wipes all local cached information. In case the given token (eg 
          time stamp) is different to the one used before, or even unset or empty, 
          it will wipe the cache. There are two use-cases:</p>
        <p>1) If the service provider is sending a time stamp (refer to &quot;update&quot; 
          vaccinator protocol function). In this case, call wipeCache() with the 
          given time stamp as token. If the token differs from last time, this 
          function will wipe the whole cache. New requests will restore the 
          cache step by step. By this, your local cache is always up to date.</p>
        <p>2) If the application was used in Internet café or other security 
          concerns are against permanent local caching (please note that the 
          caching massively increases speed of the whole system). After the 
          cache was wiped, all data has to become requested from the vaccinator 
          service again if requested. Thus, please call this function (if 
          needed) with no token regularly after logout (in this situation).</p>
      </td>
    </tr>
  </tbody>
</table>

changeAppId
-----------

<table>
  <colgroup>
    <col width="17%" />
    <col width="82%" />
  </colgroup>
  <tbody>
    <tr class="odd">
      <td>Description:</td>
      <td>This is trying to re-encode all Vaccination Data after the app-id has changed.</td>
    </tr>
    <tr class="even">
      <td>Parameters:</td>
      <td>(array) VIDs, (string) old app-id, (string) new app-id</td>
    </tr>
    <tr class="odd">
      <td>Return value:</td>
      <td>(promise) (int) number of processed items</td>
    </tr>
    <tr class="even">
      <td>Info:</td>
      <td><p>The app-id is used to encrypt the payload in identity management. For 
          whatever reason, if the app-id is changing for a user, then all entries in
          identity management need to become re-encrypted. Obviously, this is not to
          be done on identity management place to protect the data. So it must be
          done locally.</p>
        <p>For this, the API class downloads and decrypts all Vaccination Data. Then it logs
          out initializes again with the new app-id. Then, all Vaccination Data is getting
          encrypted and updated.</p>
        <p>The function also updates local cache. If you do not want all the data
          stay here, either use wipe() to remove specific items or wipeCache()
          to cleanup all cached items.</p>
        <p>After the function ran, the <code>new app-id</code> is the current app-id
          and overlays the app-id given during initialization.</p>
        <p><code>VIDs</code> is one or more VIDs. Please submit as array. This list
          has to be complete! In doubt, make sure you have the list of ALL VIDs for
          this app-id.</p>
        <p><code>old app-id</code> and <code>new app-id</code> are the old and new
          app-id to use for re-encryption.</p>
        <p>The whole process may take a long time, depending on the number of people
          affected. Until the promise is fulfilled you should show some &quot;please 
          wait&quot; dialogue to tell the user that something is going on in the
          background.</p>
        <p><strong>NOTE:</strong> It is important that this call contains ALL VIDs 
          assigned to the given app-id. If not, some data in DataVaccinator service may
          stay encrypted with the old app-id. In the worst case, this would cause 
          serious data loss.</p>
        <p><strong>NOTE:</strong>In case this function was interrupted, there is a 
          chance that some entries in DataVaccinator service may be encrypted with the 
          new app-id and other still with the old one. The API is making sure that 
          only Vaccination Data encrypted with the old app-id get re-encrypted (by using the
          <code>cs</code> value from the payload). By this, it is possible to call this function
          multiple times (with exactly the same parameters) to fix any previous
          interruption.</p></td>
    </tr>
  </tbody>
</table>

getAppId
--------

<table>
  <colgroup>
    <col width="17%" />
    <col width="82%" />
  </colgroup>
  <tbody>
    <tr class="odd">
      <td>Description:</td>
      <td>Returns the app-id that is currently in use.</td>
    </tr>
    <tr class="even">
      <td>Parameters:</td>
      <td>-</td>
    </tr>
    <tr class="odd">
      <td>Return value:</td>
      <td>(promise) (string) app-id</td>
    </tr>
    <tr class="even">
      <td>Info:</td>
      <td>If no app-id is available, it throws an error!</td>
    </tr>
  </tbody>
</table>

validateAppId
-------------

<table>
  <colgroup>
    <col width="17%" />
    <col width="82%" />
  </colgroup>
  <tbody>
    <tr class="odd">
      <td>Description:</td>
      <td>Validates the checksum of the given app-id.</td>
    </tr>
    <tr class="even">
      <td>Parameters:</td>
      <td>(string) app-id</td>
    </tr>
    <tr class="odd">
      <td>Return value:</td>
      <td>(boolean) validity</td>
    </tr>
    <tr class="even">
      <td>Info:</td>
      <td>Returns true if the given app-id contains a valid checksum. Returns false if not.</td>
    </tr>
  </tbody>
</table>

getServerInfo
-------------

<table>
  <colgroup>
    <col width="17%" />
    <col width="82%" />
  </colgroup>
  <tbody>
    <tr class="odd">
      <td>Description:</td>
      <td>Retrieves generic information from the connected DataVaccinator server.</td>
    </tr>
    <tr class="even">
      <td>Parameters:</td>
      <td>-</td>
    </tr>
    <tr class="odd">
      <td>Return value:</td>
      <td>(promise) (array) server information.</td>
    </tr>
    <tr class="even">
      <td>Info:</td>
      <td>
        <p>The returned object array contains the following fields:</p>
        <p>
          <code>status</code> The general state of this request ("OK", "INVALID" or "ERROR).<br>
          <code>version</code> The version of the DataVaccinator server.<br>
          <code>time</code> The current date and time on the DataVaccinator server.<br>
          <code>plugins</code> An array of plugins. Each entry has 'name', 'vendor' and 'license' field.<br>
          <code>uid</code> User ID submitted by the class during the call (you may ignore this).
        </p>
      </td>
    </tr>
  </tbody>
</table>

setHeaders
----------

<table>
  <colgroup>
    <col width="17%" />
    <col width="82%" />
  </colgroup>
  <tbody>
    <tr class="odd">
      <td>Description:</td>
      <td>Define additional header values to send on service requests.</td>
    </tr>
    <tr class="even">
      <td>Parameters:</td>
      <td>(object) headers</td>
    </tr>
    <tr class="odd">
      <td>Return value:</td>
      <td>(boolean) success</td>
    </tr>
    <tr class="even">
      <td>Info:</td>
      <td>This is added as headers value in fetch calls. Use directly after calling init():
      <pre><code>var v = new vaccinator();
v.init("http://vaccinator.vsdevel.de.regify.com/service.php", "volker", appid, "password", true)
.then(function() {
  v.setHeaders( { 'Cache-Control': 'max-age=60' } );
}</code></pre>
      To clear headers, call with empty object like with <code>.setHeaders( {} );</code>.
      </td>
    </tr>
  </tbody>
</table>

enableDirectLogin
-----------------

<table>
  <colgroup>
    <col width="17%" />
    <col width="82%" />
  </colgroup>
  <tbody>
    <tr class="odd">
      <td>Description:</td>
      <td>Enable direct login.</td>
    </tr>
    <tr class="even">
      <td>Parameters:</td>
      <td>(int) Service Provider ID, (string) Service Provider Password</td>
    </tr>
    <tr class="odd">
      <td>Return value:</td>
      <td>(boolean) success</td>
    </tr>
    <tr class="even">
      <td>Info:</td>
      <td>Enable direct login. By this, the protocol is enhanced by adding <code>sid</code> and <code>spwd</code> values (serviceProviderId and serviceProviderPwd). This is needed to directly access the DataVaccinator without any intermediate or proxy instance.

Set serviceProviderId = 0 and serviceProviderPwd = "" to turn off.

Please note that you have to set the direct DataVaccinator URL in <code>init()</code> function call.
      </td>
    </tr>
  </tbody>
</table>

enableSearchFunction
--------------------

<table>
  <colgroup>
    <col width="17%" />
    <col width="82%" />
  </colgroup>
  <tbody>
    <tr class="odd">
      <td>Description:</td>
      <td>Enables or disables the search functionality.</td>
    </tr>
    <tr class="even">
      <td>Parameters:</td>
      <td>(array) word field names</td>
    </tr>
    <tr class="odd">
      <td>Return value:</td>
      <td>(boolean) success</td>
    </tr>
    <tr class="even">
      <td>Info:</td>
      <td>
        <p>Here you submit an array of field names to be used for search
          function. If your payload contains values for the given fields, they
          will get uploaded as SearchHash to the DataVaccinator server. This
          then allows you to find the assigned VIDs using the "search" function.
        <p>To disable the feature, submit an empty array or no parameter.</p>
        <p><strong>Note:</strong>This only works if the payload given in "add"
        or "update" calls is a valid JSON string!</p>
      </td>
    </tr>
  </tbody>
</table>

search
------

<table>
  <colgroup>
    <col width="17%" />
    <col width="82%" />
  </colgroup>
  <tbody>
    <tr class="odd">
      <td>Description:</td>
      <td>Search through the DataVaccinator service for entries.</td>
    </tr>
    <tr class="even">
      <td>Parameters:</td>
      <td>(string) search term</td>
    </tr>
    <tr class="odd">
      <td>Return value:</td>
      <td>(promise) (array) VID(s)</td>
    </tr>
    <tr class="even">
      <td>Info:</td>
      <td>
        <p>The search term is one or more words, divided by space. If multiple
          words are given, it will return only matches who matched both words
          in the payload (AND).</p>
        <p>Search words do not have to be complete and case does not matter. The
          search always begins on the left and returns all matches there.
          Thus, you can simply enter "joh foo" to find John Foobar.</p>
        <p><strong>Note:</strong> This only works if the "enableSearchFunction"
        was called before using "add" or "update" calls. You can only search
        for entries that were pushed or updated with search function
        enabled.</p>
        <p><strong>Note:</strong> This only works if the DataVaccinator service
          activated the "search" plugin. If not, you will get EC_MISSING_PARAMETERS.</p>
      </td>
    </tr>
  </tbody>
</table>

Properties
==========

There are a few class properties that can be useful:

`debugging` = If `true`, the debugging gets activated. With `false` it is deactivated. By this, you can turn on/off debugging at any time.

`useCache` = Set to `false` directly after calling init() to disable any local caching. We suggest to not turn caching on/off during a working session. Instead, use it once after calling init() function.

`appId` = Can get used to read the currently used App-ID. We suggest to not edit/write this value.

Error handling
==============

The vaccinator class throws error of type `vaccinatorError` in case
something goes wrong. The `vaccinatorError` inherits the JavaScript
Error class and adds two additional values:

**reason:** It is one of the following reasons of the error:

`VACCINATOR_SERVICE` = The vaccinator service is the reason for the
problem. Check vaccinatorCode value for more details.

`VACCINATOR_INVALID` = You very likely submitted some invalid or missing
parameter. Not vaccinator related but related to your input.

`VACCINATOR_UNKNOWN` = Error with no further specification.

**vaccinatorCode:** In case the reason was VACCINATOR\_SERVICE, this code
contains the return code from vaccinator service.

In general, if you get an error of reason VACCINATOR\_SERVICE, you have
to validate the vaccinatorCode and maybe inform the user about some
issues that may go away in some time (try later). If you get some
VACCINATOR\_INVALID, you very like passed in some parameter or values
that do either not fit to the rules or are invalid or of wrong type.
