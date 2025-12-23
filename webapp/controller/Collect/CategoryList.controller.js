sap.ui.define([
    "com/financor/sd/shoppingapp/controller/BaseListController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast"
], function (BaseListController, JSONModel, MessageToast) {
    "use strict";

    const ENTITY_NAME = "Categories";

    return BaseListController.extend("com.financor.sd.shoppingapp.controller.Collect.CategoryList", {

        onInit: function () {
            this.getView().setModel(new JSONModel({
                competitorName: ""
            }), "viewModel");
            this.getOwnerComponent().getRouter().getRoute("CategoryList").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: async function (oEvent) {
            const oArgs = oEvent.getParameter("arguments");
            const sCompetitorKey = oArgs.competitorKey;
            const sAssortmentKey = oArgs.assortmentKey;
            const sAreaKey = oArgs.areaKey;
            const sDivisionKey = oArgs.divisionKey;
            const sFamilyKey = oArgs.FamilyKey;

            const sCompetitorName = decodeURIComponent(oArgs.competitorName);
            this.getView().getModel("viewModel").setProperty("/competitorName", sCompetitorName);

            const aFilters = [
                { fieldName: "Customer", value: sCompetitorKey },
                { fieldName: "Assortment", value: sAssortmentKey },
                { fieldName: "Area", value: sAreaKey },
                { fieldName: "Division", value: sDivisionKey },
                { fieldName: "Family", value: sFamilyKey }
            ];
            await this._loadEntitySet(ENTITY_NAME, aFilters);
        },

        onCategorySelect: function (oEvent) {
            const oListItem = oEvent.getParameter("listItem");
            const oContext = oListItem.getBindingContext("listModel");
            const oSelectedCategory = oContext.getObject();
            this.getOwnerComponent().getRouter().navTo("ProductGroupList", {
                competitorKey: oSelectedCategory.Customer,
                competitorName: encodeURIComponent(this.getView().getModel("viewModel").getProperty("/competitorName")),
                assortmentKey: oSelectedCategory.Assortment,
                areaKey: oSelectedCategory.Area, 
                divisionKey: oSelectedCategory.Division,
                familyKey: oSelectedCategory.Family,
                CategoryKey: oSelectedCategory.Category
            });
        }
    });
});