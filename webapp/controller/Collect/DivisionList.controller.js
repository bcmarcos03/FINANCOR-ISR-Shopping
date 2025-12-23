sap.ui.define([
    "com/financor/sd/shoppingapp/controller/BaseListController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast"
], function (BaseListController, JSONModel, MessageToast) {
    "use strict";
    const ENTITY_NAME = "Divisions"; 
    
    return BaseListController.extend("com.financor.sd.shoppingapp.controller.Collect.DivisionList", {

        onInit: function () {
            this.getView().setModel(new JSONModel({ 
                competitorName: "",
                areaKey: ""
            }), "viewModel");            
            this.getOwnerComponent().getRouter().getRoute("DivisionList").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: async function (oEvent) {
            const oArgs = oEvent.getParameter("arguments");
            const sCompetitorKey = oArgs.competitorKey; 
            const sAreaKey = oArgs.AreaKey; 
            const sAssortmentKey = oArgs.assortmentKey;
            
            const sCompetitorName = decodeURIComponent(oArgs.competitorName); 
            this.getView().getModel("viewModel").setProperty("/competitorName", sCompetitorName);
            
            const aFilters = [            
                { fieldName: "Area", value: sAreaKey }, 
                { fieldName: "Assortment", value: sAssortmentKey },
                { fieldName: "Customer", value: sCompetitorKey } 
            ];            
            await this._loadEntitySet(ENTITY_NAME, aFilters);
        },

        onDivisionSelect: function (oEvent) {
            const oListItem = oEvent.getParameter("listItem");
            const oContext = oListItem.getBindingContext("listModel");     
            const oSelectedDivision = oContext.getObject();    
            MessageToast.show("Divisão Selecionada: " + oSelectedDivision.Division);                    
            this.getOwnerComponent().getRouter().navTo("FamilyList", {
                competitorKey: oSelectedDivision.Customer,
                competitorName: encodeURIComponent(this.getView().getModel("viewModel").getProperty("/competitorName")),
                areaKey: oSelectedDivision.Area, 
                assortmentKey: oSelectedDivision.Assortment,
                DivisionKey: oSelectedDivision.Division,
                
            });
        }
    });
});