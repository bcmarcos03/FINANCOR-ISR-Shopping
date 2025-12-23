sap.ui.define([
    "com/financor/sd/shoppingapp/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/ui/core/routing/History"
], function (BaseController, JSONModel, MessageBox, History) {
    "use strict";

    // nome banco
    const LOCAL_DB_NAME = "financorDB";

    return BaseController.extend("com.financor.sd.shoppingapp.controller.BaseListController", {

        onNavBack: function () {
           const oHistory = History.getInstance();
           const sPreviousHash = oHistory.getPreviousHash();             
            if (sPreviousHash !== undefined) {
                window.history.go(-1); 
            } else {
                const oRouter = this.getOwnerComponent().getRouter();                
                oRouter.navTo("CompetitorList", {}, true); 
            }
        },
        _loadEntitySet: async function (sEntityName, aParentFilters = []) {
            const db = new PouchDB(LOCAL_DB_NAME);
            this.getView().setBusy(true);

            try {
                const result = await db.allDocs({ include_docs: true });

                let aFilteredData = result.rows
                    .map(row => row.doc)
                    .filter(doc => {
                        let isCorrectEntity = doc.entityName === sEntityName;
                        console.log(sEntityName);
                        if (!isCorrectEntity) {
                            return false;
                        }


                        // Aplica Filtros
                        let matchesAllFilters = aParentFilters.every(filterObj => {
                            const sFieldName = filterObj.fieldName;
                            const sValue = filterObj.value;
                            console.log(sFieldName + ' ' + sValue);                            
                            return doc[sFieldName] && doc[sFieldName] === sValue;
                        });

                        return isCorrectEntity && matchesAllFilters;
                    });

                // atualiza o JSON Model
                const oListModel = new JSONModel({ ListData: aFilteredData });
                this.getView().setModel(oListModel, "listModel");

                return aFilteredData;

            } catch (error) {
                /// implementar erros 
            } finally {
                this.getView().setBusy(false);
            }
        },

        // ----------------------------------------------------
        //  (SearchField) --- adptar
        // ----------------------------------------------------

        onSearch: function (oEvent) {
            const sQuery = oEvent.getParameter("newValue");
            const oList = this.byId("idListaGenerica"); // ID padrão da lista na View
            const oBinding = oList.getBinding("items");

            if (oBinding) {
                const aFilters = [];
                if (sQuery) {

                    aFilters.push(new sap.ui.model.Filter("Name", sap.ui.model.FilterOperator.Contains, sQuery));
                }
                oBinding.filter(aFilters, sap.ui.model.FilterType.Application);
            }
        }
    });
});