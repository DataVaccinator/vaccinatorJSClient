all: help

help:
	@echo "I understand the following targets:"
	@echo "* ts   - generate the ts file from the current javascript source"
	@echo "* help - this information"

ts:
	sed -i 's/class Vaccinator {/export class Vaccinator {/' vaccinator_api.js
	sed -i 's/class DvError extends Error {/export class DvError extends Error {/' vaccinator_api.js

	tsc --allowJs -d --emitDeclarationOnly vaccinator_api.js
	
	sed -i 's/export class Vaccinator {/class Vaccinator {/' vaccinator_api.js
	sed -i 's/export class DvError extends Error {/class DvError extends Error {/' vaccinator_api.js

	sed -i 's/export class Vaccinator {/declare class Vaccinator {/' vaccinator_api.d.ts
	sed -i 's/export class DvError extends Error {/declare class DvError extends Error {/' vaccinator_api.d.ts
	@echo "done"