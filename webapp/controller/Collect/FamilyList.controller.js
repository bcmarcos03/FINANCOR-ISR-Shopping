sap.ui.define([
    "com/financor/sd/shoppingapp/controller/BaseListController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast"
], function (BaseListController, JSONModel, MessageToast) {
    "use strict";    
    const ENTITY_NAME = "Families"; 
    
    return BaseListController.extend("com.financor.sd.shoppingapp.controller.Collect.FamilyList", {

        onInit: function () {
            this.getView().setModel(new JSONModel({ 
                competitorName: ""
            }), "viewModel");
            
            this.getOwnerComponent().getRouter().getRoute("FamilyList").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: async function (oEvent) {
            const oArgs = oEvent.getParameter("arguments");
            const sCompetitorKey = oArgs.competitorKey; 
            const sAssortmentKey = oArgs.assortmentKey;
            const sAreaKey = oArgs.areaKey;
            const sDivisionKey = oArgs.DivisionKey;                         
            const sCompetitorName = decodeURIComponent(oArgs.competitorName); 
            this.getView().getModel("viewModel").setProperty("/competitorName", sCompetitorName);
            
            const aFilters = [        
                { fieldName: "Division", value: sDivisionKey },                 
                { fieldName: "Area", value: sAreaKey }, 
                { fieldName: "Customer", value: sCompetitorKey },
                { fieldName: "Assortment", value: sAssortmentKey } 
            ];
            
            await this._loadEntitySet(ENTITY_NAME, aFilters);
        },

        onFamilySelect: function (oEvent) {
            const oListItem = oEvent.getParameter("listItem");
            const oContext = oListItem.getBindingContext("listModel");     
            const oSelectedFamily = oContext.getObject();    
            
            MessageToast.show("Família Selecionada: " + oSelectedFamily.FamilyDesc);            
            this.getOwnerComponent().getRouter().navTo("CategoryList", {
                competitorKey: oSelectedFamily.Customer,
                competitorName: encodeURIComponent(this.getView().getModel("viewModel").getProperty("/competitorName")),
                assortmentKey: oSelectedFamily.Assortment,
                areaKey: oSelectedFamily.Area, 
                divisionKey: oSelectedFamily.Division,
                FamilyKey: oSelectedFamily.Family
            });
        }
    });
});