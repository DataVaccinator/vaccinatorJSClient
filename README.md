# vaccinatorJsClient
This is the first DataVaccinator JavaScript client implementation. It can be used in any JavaScript/TypeScript project like websites, node.js or nw.js projects.

This repository includes the JavaScript class and all files to be included for using the DataVaccinator.

> [!IMPORTANT]  
> Please note that this is not usable without any DataVaccinator Vault installation. See https://github.com/DataVaccinator/dv-vault for the server sourcecode.

If you like to get more details, please contact us at info@datavaccinator.com.

# What is it good for?

The DataVaccinator protects your sensitive data and information against abuse. At the very moment when data is being generated, the service splits that data and uses advanced pseudonymisation techniques to separate content from identity information. Thus, the DataVaccinator reduces cyber security risks in the health, industry, finance and any other sector and helps service providers, device manufacturers, data generating and data handling parties to manage sensitive data in a secure and GDPR-compliant manner. In contrast to other offerings, DataVaccinator industrialises pseudonymisation, thereby making pseudonymisation replicable and affordable.

Get more information at <https://www.datavaccinator.com>

# DevOps intellisense

To regenerate the declaration file of the _vaccinator_api.js_, run the following makefile in the _/src/_ directory (Linux):
```sh
make ts
```

If the _tsc_ command is not available, you need the npm "typescript" package installed globaly:
```sh
npm i -g typescript
```
For more inforamtion about npm, head over to https://www.npmjs.com

To finally use the declarations to allow your IDE providing intellisense, you can add the following on top of your JavaScript files:

```html
/// <reference path="<pathTo>/vaccinator_api.d.ts" />
```

Source: https://devblogs.microsoft.com/dotnet/jscript-intellisense-a-reference-for-the-reference-tag/
