sap.ui.define([
    "com/financor/sd/shoppingapp/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "com/financor/sd/shoppingapp/services/DatabaseService",
    "com/financor/sd/shoppingapp/utils/Formatters"
], function (BaseController, JSONModel, Filter, FilterOperator, MessageToast, MessageBox, DatabaseService, Formatters) {
    "use strict";

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
                const db = DatabaseService.getDB();
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
            const oItem = oEvent.getParameter("listItem") || oEvent.getSource();
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

        /**
         * Handler for individual item delete (swipe-to-delete)
         * @param {sap.ui.base.Event} oEvent Delete event
         */
        onDeleteItem: function (oEvent) {
            const oItem = oEvent.getParameter("listItem");
            const oContext = oItem.getBindingContext("collectedModel");

            if (!oContext) {
                MessageToast.show("Erro: Contexto não encontrado");
                return;
            }

            const oProductData = oContext.getObject();
            const sProductName = oProductData.MaterialDescription || "Este produto";

            // Show confirmation dialog
            MessageBox.warning(
                this.getResourceBundle().getText("ConfirmDeleteMessage", [sProductName]),
                {
                    title: this.getResourceBundle().getText("ConfirmDeleteTitle"),
                    actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL],
                    emphasizedAction: MessageBox.Action.CANCEL,
                    onClose: async (sAction) => {
                        if (sAction === MessageBox.Action.DELETE) {
                            await this._performSoftDelete(oProductData);
                        }
                    }
                }
            );
        },

        /**
         * Handler for Delete All button
         */
        onDeleteAll: function () {
            const oModel = this.getView().getModel("collectedModel");
            const iCount = oModel.getProperty("/count");

            if (iCount === 0) {
                return;
            }

            // Show confirmation dialog
            MessageBox.warning(
                this.getResourceBundle().getText("ConfirmDeleteAllMessage", [iCount]),
                {
                    title: this.getResourceBundle().getText("ConfirmDeleteAllTitle"),
                    actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL],
                    emphasizedAction: MessageBox.Action.CANCEL,
                    onClose: async (sAction) => {
                        if (sAction === MessageBox.Action.DELETE) {
                            await this._performDeleteAll();
                        }
                    }
                }
            );
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
        },

        /**
         * Performs soft delete on a single product (sets IsCollected=false)
         * @param {object} oProductData Product document to soft delete
         * @private
         */
        _performSoftDelete: async function (oProductData) {
            this.getView().setBusy(true);

            try {
                const db = DatabaseService.getDB();

                // Get the latest version of the document (with current _rev)
                const doc = await db.get(oProductData._id);

                // Update the document - set IsCollected to false (soft delete)
                const updatedDoc = {
                    ...doc,
                    IsCollected: false,
                    CollectedDate: null
                };

                // Save the updated document
                await db.put(updatedDoc);

                // Show success message
                MessageToast.show(this.getResourceBundle().getText("DeleteSuccess"));

                // Reload the list to reflect changes
                await this._loadCollectedPrices();

            } catch (error) {
                console.error("Error performing soft delete:", error);

                if (error.status === 409) {
                    MessageToast.show(this.getResourceBundle().getText("DeleteConflictError"));
                } else {
                    MessageToast.show(this.getResourceBundle().getText("DeleteError"));
                }
            } finally {
                this.getView().setBusy(false);
            }
        },

        /**
         * Performs soft delete on all collected prices
         * @private
         */
        _performDeleteAll: async function () {
            this.getView().setBusy(true);

            try {
                const db = DatabaseService.getDB();
                const oModel = this.getView().getModel("collectedModel");
                const aItems = oModel.getProperty("/items");

                let successCount = 0;
                let errorCount = 0;

                // Process each item
                for (const oItem of aItems) {
                    try {
                        // Get the latest version of the document
                        const doc = await db.get(oItem._id);

                        // Update the document - set IsCollected to false
                        const updatedDoc = {
                            ...doc,
                            IsCollected: false,
                            CollectedDate: null
                        };

                        // Save the updated document
                        await db.put(updatedDoc);
                        successCount++;

                    } catch (error) {
                        console.error(`Error deleting product ${oItem._id}:`, error);
                        errorCount++;
                    }
                }

                // Show result message
                if (errorCount === 0) {
                    MessageToast.show(
                        this.getResourceBundle().getText("DeleteAllSuccess", [successCount])
                    );
                } else {
                    MessageToast.show(
                        this.getResourceBundle().getText("DeleteAllPartialSuccess", [successCount, errorCount])
                    );
                }

                // Reload the list to reflect changes
                await this._loadCollectedPrices();

            } catch (error) {
                console.error("Error performing delete all:", error);
                MessageToast.show(this.getResourceBundle().getText("DeleteAllError"));
            } finally {
                this.getView().setBusy(false);
            }
        }
    });
});
