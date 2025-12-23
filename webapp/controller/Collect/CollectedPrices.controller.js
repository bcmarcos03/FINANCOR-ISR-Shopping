sap.ui.define([
    "com/financor/sd/shoppingapp/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast"
], function (BaseController, JSONModel, Filter, FilterOperator, MessageToast) {
    "use strict";

    const LOCAL_DB_NAME = "financorDB";

    return BaseController.extend("com.financor.sd.shoppingapp.controller.Collect.CollectedPrices", {

        onInit: function () {
            const oCollectedModel = new JSONModel({
                items: [],
                count: 0
            });
            this.getView().setModel(oCollectedModel, "collectedModel");

            this.getRouter().getRoute("CollectedPrices").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function () {
            this._loadCollectedPrices();
        },

        _loadCollectedPrices: async function () {
            this.getView().setBusy(true);

            try {
                const db = new PouchDB(LOCAL_DB_NAME);
                const result = await db.allDocs({ include_docs: true });

                const aCollectedProducts = result.rows
                    .map(row => row.doc)
                    .filter(doc => doc.entityName === "Products" && doc.IsCollected === true)
                    .sort((a, b) => {
                        const dateA = new Date(a.CollectedDate || 0);
                        const dateB = new Date(b.CollectedDate || 0);
                        return dateB - dateA;
                    });

                const oModel = this.getView().getModel("collectedModel");
                oModel.setProperty("/items", aCollectedProducts);
                oModel.setProperty("/count", aCollectedProducts.length);

                if (aCollectedProducts.length === 0) {
                    MessageToast.show(this.getResourceBundle().getText("NoCollectedPrices") || "Nenhum preço recolhido");
                }

            } catch (error) {
                console.error("Error loading collected prices:", error);
                MessageToast.show("Erro ao carregar preços recolhidos");
            } finally {
                this.getView().setBusy(false);
            }
        },

        onRefresh: function () {
            this._loadCollectedPrices();
        },

        onSearch: function (oEvent) {
            const sQuery = oEvent.getParameter("newValue");
            const oList = this.byId("collectedPricesList");
            const oBinding = oList.getBinding("items");

            if (!oBinding) {
                return;
            }

            let aFilters = [];
            if (sQuery && sQuery.length > 0) {
                aFilters = [
                    new Filter({
                        filters: [
                            new Filter("MaterialDescription", FilterOperator.Contains, sQuery),
                            new Filter("Brand", FilterOperator.Contains, sQuery),
                            new Filter("CustomerName", FilterOperator.Contains, sQuery),
                            new Filter("AreaText", FilterOperator.Contains, sQuery),
                            new Filter("CategoryText", FilterOperator.Contains, sQuery)
                        ],
                        and: false
                    })
                ];
            }

            oBinding.filter(aFilters);
        },

        onItemPress: function (oEvent) {
            const oItem = oEvent.getParameter("listItem");
            const oContext = oItem.getBindingContext("collectedModel");

            if (!oContext) {
                MessageToast.show("Erro: Contexto não encontrado");
                return;
            }

            const oProductData = oContext.getObject();
            const sProductSyncKey = oProductData.SyncKey || oProductData._id;

            if (!sProductSyncKey) {
                MessageToast.show("Erro: Chave do produto não encontrada");
                return;
            }

            this.getRouter().navTo("ProductPriceEntryForm", {
                productSyncKey: encodeURIComponent(sProductSyncKey)
            });
        },

        formatPrice: function (fPrice) {
            if (!fPrice && fPrice !== 0) {
                return "-";
            }
            return parseFloat(fPrice).toFixed(2);
        },

        formatPromoPrice: function (fPrice) {
            if (!fPrice && fPrice !== 0) {
                return "";
            }
            return parseFloat(fPrice).toFixed(2) + " EUR";
        },

        formatCollectedDate: function (sDate) {
            if (!sDate) {
                return "";
            }
            const oDate = new Date(sDate);
            const oDateFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({
                pattern: "dd/MM/yyyy HH:mm"
            });
            return oDateFormat.format(oDate);
        }
    });
});
