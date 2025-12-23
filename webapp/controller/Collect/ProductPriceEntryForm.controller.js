sap.ui.define([
    "com/financor/sd/shoppingapp/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (BaseController, JSONModel, MessageBox, MessageToast) {
    "use strict";

    const LOCAL_DB_NAME = "financorDB";

    return BaseController.extend("com.financor.sd.shoppingapp.controller.Collect.ProductPriceEntryForm", {

        onInit: function () {
            // Initialize form model with empty values
            const oFormModel = new JSONModel({
                productSyncKey: "",
                materialDescription: "",
                ean: "",
                brand: "",
                normalPrice: null,
                promoPrice: null,
                promoType: "",
                promoStartDate: null,
                promoEndDate: null,
                observations: "",
                liquidContent: "",
                liquidContentUnit: "L",
                collectedDate: null,
                // Original product data
                _originalProduct: null
            });
            this.getView().setModel(oFormModel, "formModel");

            // Attach route matched handler
            this.getRouter().getRoute("ProductPriceEntryForm").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: async function (oEvent) {
            const oArgs = oEvent.getParameter("arguments");
            const sProductSyncKey = decodeURIComponent(oArgs.productSyncKey);

            this.getView().setBusy(true);

            try {
                // Load product data from PouchDB
                const oProduct = await this._loadProductFromPouch(sProductSyncKey);

                if (oProduct) {
                    // Populate form with existing product data
                    const oFormModel = this.getView().getModel("formModel");
                    oFormModel.setData({
                        productSyncKey: sProductSyncKey,
                        materialDescription: oProduct.MaterialDescription || "",
                        ean: oProduct.EAN || "",
                        brand: oProduct.Brand || "",
                        normalPrice: oProduct.NormalPrice || oProduct.Price || null,
                        promoPrice: oProduct.PromoPrice || null,
                        promoType: oProduct.PromoType || "",
                        promoStartDate: oProduct.PromoStartDate ? new Date(oProduct.PromoStartDate) : null,
                        promoEndDate: oProduct.PromoEndDate ? new Date(oProduct.PromoEndDate) : null,
                        observations: oProduct.Observations || "",
                        liquidContent: oProduct.LiquidContent || "",
                        liquidContentUnit: oProduct.LiquidContentUnit || "L",
                        collectedDate: null,
                        _originalProduct: oProduct
                    });
                } else {
                    MessageBox.error("Produto não encontrado.");
                    this.onNavBack();
                }
            } catch (error) {
                console.error("Error loading product:", error);
                MessageBox.error("Erro ao carregar produto: " + error.message);
            } finally {
                this.getView().setBusy(false);
            }
        },

        _loadProductFromPouch: async function (sSyncKey) {
            const db = new PouchDB(LOCAL_DB_NAME);
            try {
                const doc = await db.get(sSyncKey);
                return doc;
            } catch (error) {
                if (error.status === 404) {
                    console.warn("Product not found:", sSyncKey);
                    return null;
                }
                throw error;
            }
        },

        onContinue: async function () {
            const oFormModel = this.getView().getModel("formModel");
            const oFormData = oFormModel.getData();

            // Validate required fields
            if (!oFormData.materialDescription || oFormData.materialDescription.trim() === "") {
                MessageBox.warning("Por favor, preencha a descrição do artigo.");
                return;
            }

            if (!oFormData.normalPrice || oFormData.normalPrice <= 0) {
                MessageBox.warning("Por favor, preencha o PVP Normal.");
                return;
            }

            this.getView().setBusy(true);

            try {
                await this._saveToPouch(oFormData);
                MessageToast.show("Preço recolhido com sucesso!");
                this.onNavBack();
            } catch (error) {
                console.error("Error saving to PouchDB:", error);
                MessageBox.error("Erro ao guardar dados: " + error.message);
            } finally {
                this.getView().setBusy(false);
            }
        },

        _saveToPouch: async function (oFormData) {
            const db = new PouchDB(LOCAL_DB_NAME);

            // Get the original product to get _rev
            const oOriginalProduct = oFormData._originalProduct;

            if (!oOriginalProduct || !oOriginalProduct._rev) {
                throw new Error("Produto original não encontrado");
            }

            // Merge form data with original product
            const oUpdatedProduct = {
                ...oOriginalProduct,
                MaterialDescription: oFormData.materialDescription,
                EAN: oFormData.ean,
                Brand: oFormData.brand,
                NormalPrice: parseFloat(oFormData.normalPrice) || 0,
                PromoPrice: oFormData.promoPrice ? parseFloat(oFormData.promoPrice) : null,
                PromoType: oFormData.promoType,
                PromoStartDate: oFormData.promoStartDate ? oFormData.promoStartDate.toISOString() : null,
                PromoEndDate: oFormData.promoEndDate ? oFormData.promoEndDate.toISOString() : null,
                Observations: oFormData.observations,
                LiquidContent: oFormData.liquidContent,
                LiquidContentUnit: oFormData.liquidContentUnit,
                CollectedDate: new Date().toISOString(),
                IsCollected: true
            };

            // Update in PouchDB
            const response = await db.put(oUpdatedProduct);
            console.log("Product updated successfully:", response);
            return response;
        }
    });
});
