/**
 * eslint-disable @sap/ui5-jsdocs/no-jsdoc
 */

sap.ui.define([
        "sap/ui/core/UIComponent",
        "sap/ui/Device",
        "com/financor/sd/shoppingapp/model/models"
    ],
    function (UIComponent, Device, models) {
        "use strict";

        return UIComponent.extend("com.financor.sd.shoppingapp.Component", {
            metadata: {
                manifest: "json"
            },

            /**
             * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
             * @public
             * @override
             */
            init: function () {
                // call the base component's init function
                UIComponent.prototype.init.apply(this, arguments);

                // set language to Portuguese
                sap.ui.getCore().getConfiguration().setLanguage("pt");

                // enable routing
                this.getRouter().initialize();

                // set the device model
                this.setModel(models.createDeviceModel(), "device");
            },

            /**
             * This method can be called to determine whether the sapUiSizeCompact or sapUiSizeCozy
             * design mode class should be set, which influences the size appearance of some controls.
             * @public
             * @returns {string} css class, either 'sapUiSizeCompact' or 'sapUiSizeCozy' - or an empty string if no css class should be set
             */
            getContentDensityClass: function () {
                if (this.contentDensityClass === undefined) {
                    // check whether FLP has already set the content density class; do nothing in this case
                    if (document.body.classList.contains("sapUiSizeCozy") || document.body.classList.contains("sapUiSizeCompact")) {
                        this.contentDensityClass = "";
                    } else if (!Device.support.touch) {
                        // apply "compact" mode if touch is not supported
                        this.contentDensityClass = "sapUiSizeCompact";
                    } else {
                        // "cozy" in case of touch support; default for most sap.m controls, but needed for desktop-first controls like sap.ui.table.Table
                        this.contentDensityClass = "sapUiSizeCozy";
                    }
                }
                return this.contentDensityClass;
            }
        });
    }
);