sap.ui.define([
    "com/financor/sd/shoppingapp/controller/BaseListController",
    "sap/m/MessageToast"
], function (BaseListController, MessageToast) {
    "use strict";

    const ENTITY_NAME = "Areas";

    return BaseListController.extend("com.financor.sd.shoppingapp.controller.Collect.AreaList", {

        onInit: function () {
            this.getView().setModel(new sap.ui.model.json.JSONModel({
                competitorName: ""
            }), "viewModel");
            this.getOwnerComponent().getRouter().getRoute("AreaList").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: async function (oEvent) {
            const oArgs = oEvent.getParameter("arguments");
            const sCompetitorKey = oArgs.competitorKey;
            const sAssortmentKey = oArgs.assortmentKey;
            const dCompetitorName = oArgs.competitorName;
            const sCompetitorName = decodeURIComponent(dCompetitorName);

            this.getView().getModel("viewModel").setProperty("/competitorName", sCompetitorName);
            const aFilters = [
                { fieldName: "Assortment", value: sAssortmentKey },
                { fieldName: "Customer", value: sCompetitorKey }
            ];
            await this._loadEntitySet(
                ENTITY_NAME,
                aFilters
            );
        },

        onAreaSelect: function (oEvent) {
            const oListItem = oEvent.getParameter("listItem");
            const oContext = oListItem.getBindingContext("listModel");
            const oSelectedArea = oContext.getObject();
            const sCompetitorName = this.getView().getModel("viewModel").getProperty("/competitorName");
            this.getOwnerComponent().getRouter().navTo("DivisionList", {
                assortmentKey: oSelectedArea.Assortment,
                competitorKey: oSelectedArea.Customer,
                competitorName: encodeURIComponent(sCompetitorName),
                AreaKey: oSelectedArea.Area
            });
        }
    });
});