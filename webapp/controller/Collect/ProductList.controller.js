sap.ui.define([
    "com/financor/sd/shoppingapp/controller/BaseListController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast"
], function (BaseListController, JSONModel, MessageToast) {
    "use strict";
    const ENTITY_NAME = "Products"; 
    
    return BaseListController.extend("com.financor.sd.shoppingapp.controller.Collect.ProductList", {

        onInit: function () {
            // Call parent onInit (required for BaseListController initialization)
            BaseListController.prototype.onInit.apply(this, arguments);

            this.getView().setModel(new JSONModel({
                competitorName: ""
            }), "viewModel");

            this.getOwnerComponent().getRouter().getRoute("ProductList").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: async function (oEvent) {
            const oArgs = oEvent.getParameter("arguments");
            const sCompetitorKey = oArgs.competitorKey; 
            const sAssortmentKey = oArgs.assortmentKey;
            const sAreaKey = oArgs.areaKey;
            const sDivisionKey = oArgs.divisionKey;
            const sFamilyKey = oArgs.familyKey;
            const sCategoryKey = oArgs.categoryKey;
            const sProductGroupKey = oArgs.ProductGroupKey; 
            
            const sCompetitorName = decodeURIComponent(oArgs.competitorName); 
            this.getView().getModel("viewModel").setProperty("/competitorName", sCompetitorName);
            
            const aFilters = [
                { fieldName: "Customer", value: sCompetitorKey },
                { fieldName: "Assortment", value: sAssortmentKey },
                { fieldName: "Area", value: sAreaKey },
                { fieldName: "Division", value: sDivisionKey },
                { fieldName: "Family", value: sFamilyKey},
                { fieldName: "Category", value: sCategoryKey },
                { fieldName: "ProductGroup", value: sProductGroupKey }
            ];
            
            await this._loadEntitySet(ENTITY_NAME, aFilters);
        },

        // -----------------------------------------------------------
        // TO-DO ** oq fazer com o search??
        // -----------------------------------------------------------
        _getSearchFields: function() {
            return ["ProductName", "ProductCode", "EAN"]; 
        },
        
        onPriceChange: function(oEvent) {
            //TO-DO
        },

        onCollectPricePress: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext("listModel");
            if (!oContext) {
                MessageToast.show("Erro: Contexto do Produto não encontrado.");
                return;
            }

            const oProductData = oContext.getObject();
            const sProductSyncKey = oProductData.SyncKey || oProductData._id;

            if (!sProductSyncKey) {
                MessageToast.show("Erro: Chave do produto não encontrada.");
                return;
            }

            // Navigate to ProductPriceEntryForm
            this.getOwnerComponent().getRouter().navTo("ProductPriceEntryForm", {
                productSyncKey: encodeURIComponent(sProductSyncKey)
            });
        },

        onSaveProductData: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext("listModel");
            if (!oContext) {
                MessageToast.show("Erro: Contexto do Produto não encontrado.");
                return;
            }

            const oProductData = oContext.getObject();


            const fPrice = oProductData.CompetitorPrice;

            if (!fPrice || fPrice <= 0) {
                MessageToast.show("Por favor, insira um preço válido.");
                return;
            }
            MessageToast.show(`Salvando: ${oProductData.ProductName} com preço R$${fPrice} ...`);

            // TO-DO - Salvar a coleta |  ainda
            /*
            const oModel = this.getView().getModel("odataModel");

            const oPayload = {
                ProductSyncKey: oProductData.SyncKey,
                CompetitorKey: oProductData.CompetitorSyncKey,
                Price: fPrice,
                Timestamp: new Date()
            };

            oModel.create("/CollectDataSet", oPayload, {
                success: function() {
                    MessageToast.show("Dados de preço salvos com sucesso!");
                    oContext.setProperty("Status", "COLLECTED");
                }.bind(this),
                error: function(oError) {
                    MessageToast.show("Erro ao salvar dados.");
                    console.error(oError);
                }
            });
            */

        }
    });
});