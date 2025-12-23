sap.ui.define([
    "com/financor/sd/shoppingapp/controller/BaseListController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast"
], function (BaseListController, JSONModel, MessageToast) {
    "use strict";

    const ENTITY_NAME = "ProductGroups";

    return BaseListController.extend("com.financor.sd.shoppingapp.controller.Collect.ProductGroupList", {

        onInit: function () {
            this.getView().setModel(new JSONModel({
                competitorName: ""
            }), "viewModel");
            this.getOwnerComponent().getRouter().getRoute("ProductGroupList").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: async function (oEvent) {
            const oArgs = oEvent.getParameter("arguments");
            const sCompetitorKey = oArgs.competitorKey;
            const sAssortmentKey = oArgs.assortmentKey;
            const sAreaKey = oArgs.areaKey;
            const sDivisionKey = oArgs.divisionKey;
            const sFamilyKey = oArgs.familyKey;
            const sCategoryKey = oArgs.CategoryKey;

            const sCompetitorName = decodeURIComponent(oArgs.competitorName);
            this.getView().getModel("viewModel").setProperty("/competitorName", sCompetitorName);

            const aFilters = [
                { fieldName: "Customer", value: sCompetitorKey },
                { fieldName: "Assortment", value: sAssortmentKey },
                { fieldName: "Area", value: sAreaKey },
                { fieldName: "Division", value: sDivisionKey },
                { fieldName: "Family", value: sFamilyKey },
                { fieldName: "Category", value: sCategoryKey}
            ];
            
            await this._loadEntitySet(ENTITY_NAME, aFilters);
        },

        onProductGroupSelect: function (oEvent) {
            const oListItem = oEvent.getParameter("listItem");
            const oContext = oListItem.getBindingContext("listModel");
            const oSelectedProductGroup = oContext.getObject();
            this.getOwnerComponent().getRouter().navTo("ProductList", {
                competitorKey: oSelectedProductGroup.Customer,
                competitorName: encodeURIComponent(this.getView().getModel("viewModel").getProperty("/competitorName")),
                assortmentKey: oSelectedProductGroup.Assortment,
                areaKey: oSelectedProductGroup.Area, 
                divisionKey: oSelectedProductGroup.Division,
                familyKey: oSelectedProductGroup.Family,
                categoryKey: oSelectedProductGroup.Category,
                ProductGroupKey: oSelectedProductGroup.ProductGroup
            });
        }
    });
});