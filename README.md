# vaccinatorJsClient
This is the first DataVaccinator JavaScript client implementation. It can be used in any JavaScript/TypeScript project like websites, node.js or nw.js projects.

This repository includes the JavaScript class and all files to be included for using the DataVaccinator.

**Important:** Please note that this is not usable without any DataVaccinator Vault installation. See https://github.com/DataVaccinator/dv-vault for the server sourcecode.

If you like to get more details, please contact us at info@datavaccinator.com.

# What is it good for?

The DataVaccinator protects your sensitive data and information against abuse. At the very moment when data is being generated, the service splits that data and uses advanced pseudonymisation techniques to separate content from identity information. Thus, the DataVaccinator reduces cyber security risks in the health, industry, finance and any other sector and helps service providers, device manufacturers, data generating and data handling parties to manage sensitive data in a secure and GDPR-compliant manner. In contrast to other offerings, DataVaccinator industrialises pseudonymisation, thereby making pseudonymisation replicable and affordable. 

Get more information at <https://www.datavaccinator.com>

# DevOps

To regenerate the declaration file of the vaccinator_api.js follow these steps:
1. Add the keyword "**export**" before the **class** declaration:
```js
export class vaccinator {
```
2. Execute following command:
```sh
tsc --allowJs -d --emitDeclarationOnly src/vaccinator_api.js
```
3. Remove the keyword **export** in the **js** file:
```js
class vaccinator {
```
4. Replace the **export** keyword in the **d.ts** file with the **declare** keyword:
```ts
declare class vaccinator {
```


If the tsc command is not available, you need the npm "typescript" package installed globaly:
```sh
npm i -g typescript
```
For more inforamtion about npm, head over to https://www.npmjs.com