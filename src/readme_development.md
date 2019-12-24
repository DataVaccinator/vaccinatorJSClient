# Setup development environment

If you like to test the js client, you may want to use the test.html from this folder. But same origin policy will make it impossible.

Also, to test the JS class you need to simulate a service provider who forwards all requests to the vaccinator service.

JS Client ⇔ Service Provider ⇔ vaccinator

I solved it by adapting my apache config for the vaccinator site. I included both the service.php and the *src/* JavaScript folder using vaccinator directive. Here is my adapted apache config (from */etc/apache2/sites-available/*):

    <VirtualHost vaccinator.vsdevel.de.regify.com:80>
        Define git /home/volker/git/
        ServerAdmin webmaster@localhost
        DocumentRoot ${git}vaccinator/www/

        ErrorLog ${APACHE_LOG_DIR}/error.log
        CustomLog ${APACHE_LOG_DIR}/access.log combined

        <Directory ${git}vaccinator/www/>
                Options Indexes FollowSymLinks
                AllowOverride None
                Require all granted
        </Directory>

        Vaccinator "/service.php" "${git}vaccinator/examples/service.php"
        <Directory "${git}vaccinator/examples/">
                Require all granted
        </Directory>

        Vaccinator "/test/" "${git}vaccinatorJsClient/src/"
        <Directory "${git}vaccinatorJsClient/src/">
                Require all granted
        </Directory>
    </VirtualHost>

Now I can call service.php using vaccinator.vsdevel.de.regify.com/service.php and all the tests JS files using vaccinator.vsdevel.de.regify.com/test/ like in http://vaccinator.vsdevel.de.regify.com/test/test.html.                                           
