sap.ui.define([
	"com/financor/sd/shoppingapp/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageToast",
	"com/financor/sd/shoppingapp/utils/Constants",
	"com/financor/sd/shoppingapp/services/DatabaseService"
], function (BaseController, JSONModel, MessageToast, Constants, DatabaseService) {
	"use strict";

	return BaseController.extend("com.financor.sd.shoppingapp.controller.Collect.ProductSearch", {

		onInit: function () {
			// Initialize view model
			this.getView().setModel(new JSONModel({
				competitorName: "",
				competitorKey: "",
				assortmentKey: "",
				searchQuery: "",
				hasSearched: false,
				resultCount: 0
			}), "viewModel");

			// Initialize list model
			this.getView().setModel(new JSONModel({ ListData: [] }), "listModel");

			// Initialize barcode FAB
			this.initBarcodeFAB();

			// Attach route handler
			this.getOwnerComponent().getRouter()
				.getRoute("ProductSearch")
				.attachPatternMatched(this._onRouteMatched, this);
		},

		_onRouteMatched: async function (oEvent) {
			const oArgs = oEvent.getParameter("arguments");
			const sCompetitorKey = oArgs.competitorKey;
			const sAssortmentKey = oArgs.assortmentKey;
			const sCompetitorName = decodeURIComponent(oArgs.competitorName);

			// Store in view model for later use
			const oViewModel = this.getView().getModel("viewModel");
			oViewModel.setProperty("/competitorName", sCompetitorName);
			oViewModel.setProperty("/competitorKey", sCompetitorKey);
			oViewModel.setProperty("/assortmentKey", sAssortmentKey);
			oViewModel.setProperty("/hasSearched", false);
			oViewModel.setProperty("/resultCount", 0);

			// Reset search field
			oViewModel.setProperty("/searchQuery", "");

			// Reset list model
			this.getView().getModel("listModel").setProperty("/ListData", []);

			// Create PouchDB index for performance (async, non-blocking)
			this._ensureIndexes();
		},

		_ensureIndexes: async function () {
			const db = DatabaseService.getDB();
			try {
				// Create composite index for fast filtering
				await db.createIndex({
					index: {
						fields: ['entityName', 'Customer', 'Assortment']
					}
				});

				// Create composite index for barcode scanning EAN lookup
				await db.createIndex({
					index: {
						fields: ['entityName', 'Customer', 'Assortment', 'EAN']
					}
				});

				// Create text search indexes
				await db.createIndex({
					index: {
						fields: ['MaterialDescription']
					}
				});

				await db.createIndex({
					index: {
						fields: ['EAN']
					}
				});

				await db.createIndex({
					index: {
						fields: ['Brand']
					}
				});

				await db.createIndex({
					index: {
						fields: ['Product']
					}
				});

				console.log("ProductSearch: Indexes created successfully");
			} catch (error) {
				console.error("Error creating indexes:", error);
			}
		},

		onSearch: async function (oEvent) {
			const oViewModel = this.getView().getModel("viewModel");
			const sQuery = oViewModel.getProperty("/searchQuery").trim();

			if (!sQuery) {
				MessageToast.show(this.getResourceBundle().getText("ValidationEnterSearchTerm"));
				return;
			}

			const sCompetitorKey = oViewModel.getProperty("/competitorKey");
			const sAssortmentKey = oViewModel.getProperty("/assortmentKey");

			this.getView().setBusy(true);

			try {
				const aResults = await this._searchProducts(sQuery, sCompetitorKey, sAssortmentKey);

				// Update list model
				this.getView().getModel("listModel").setProperty("/ListData", aResults);

				// Update view model
				oViewModel.setProperty("/hasSearched", true);
				oViewModel.setProperty("/resultCount", aResults.length);

				if (aResults.length === 0) {
					MessageToast.show(this.getResourceBundle().getText("NoProductsFound"));
				} else {
					MessageToast.show(this.getResourceBundle().getText("ProductsFoundCount", [aResults.length]));
				}

			} catch (error) {
				console.error("Search error:", error);
				MessageToast.show(this.getResourceBundle().getText("ProductSearchError"));
			} finally {
				this.getView().setBusy(false);
			}
		},

		_searchProducts: async function (sQuery, sCompetitorKey, sAssortmentKey) {
			const db = DatabaseService.getDB();

			try {
				// Convert query to lowercase for case-insensitive search
				const sQueryLower = sQuery.toLowerCase();

				// First, get all products for this competitor
				const result = await db.find({
					selector: {
						entityName: Constants.ENTITY_NAMES.PRODUCTS,
						Customer: sCompetitorKey,
						Assortment: sAssortmentKey
					}
				});

				// Then filter in-memory for text search (PouchDB limitation)
				const aFilteredResults = result.docs.filter(doc => {
					const sDescription = (doc.MaterialDescription || "").toLowerCase();
					const sEAN = (doc.EAN || "").toLowerCase();
					const sBrand = (doc.Brand || "").toLowerCase();
					const sProduct = (doc.Product || "").toLowerCase();

					return sDescription.includes(sQueryLower) ||
						   sEAN.includes(sQueryLower) ||
						   sBrand.includes(sQueryLower) ||
						   sProduct.includes(sQueryLower);
				});

				return aFilteredResults;

			} catch (error) {
				console.error("Error searching products:", error);
				throw error;
			}
		},

		onProductSelect: function (oEvent) {

			const oContext = oEvent.getSource().getBindingContext("listModel");
			if (!oContext) {
				MessageToast.show("Erro: Contexto do Produto não encontrado.");
				return;
			}

			const oProductData = oContext.getObject();
			const sProductSyncKey = oProductData.SyncKey || oProductData._id;

			// Debug logging
			console.log("Product Data:", oProductData);
			console.log("SyncKey:", oProductData.SyncKey);
			console.log("_id:", oProductData._id);
			console.log("Final productSyncKey:", sProductSyncKey);

			if (!sProductSyncKey) {
				MessageToast.show("Erro: Chave do produto não encontrada.");
				return;
			}

			// Navigate to ProductPriceEntryForm (same as ProductList does)
			console.log("Navigating to ProductPriceEntryForm with key:", sProductSyncKey);
			this.getOwnerComponent().getRouter().navTo("ProductPriceEntryForm", {
				productSyncKey: encodeURIComponent(sProductSyncKey)
			});
		},

		onToggleManualMode: function () {
			const oViewModel = this.getView().getModel("viewModel");
			const sCompetitorKey = oViewModel.getProperty("/competitorKey");
			const sCompetitorName = oViewModel.getProperty("/competitorName");
			const sAssortmentKey = oViewModel.getProperty("/assortmentKey");

			// Navigate to AreaList (traditional hierarchy start)
			this.getOwnerComponent().getRouter().navTo("AreaList", {
				competitorKey: sCompetitorKey,
				competitorName: encodeURIComponent(sCompetitorName),
				assortmentKey: sAssortmentKey
			});
		}
	});
});
