/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require([
		"comfinancorsd/shopping-app/test/unit/AllTests"
	], function () {
		QUnit.start();
	});
});
