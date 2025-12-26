sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/core/UIComponent",
	"sap/ui/core/routing/History",
	"sap/ui/core/Fragment",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageBox",
	"sap/m/MessageToast"],
	function (Controller, UIComponent, History, Fragment, JSONModel, MessageBox, MessageToast) {
	"use strict";

	const LOCAL_DB_NAME = "financorDB";

	return Controller.extend("com.financor.sd.shoppingapp.controller.BaseController", {
		/**
		 * Convenience method to get the components' router instance.
		 * @returns {sap.m.routing.Router} The router instance
		 */
		getRouter: function () {
			return UIComponent.getRouterFor(this);
		},

		/**
		 * Convenience method for getting the i18n resource bundle of the component.
		 * @returns {Promise<sap.base.i18n.ResourceBundle>} The i18n resource bundle of the component
		 */
		getResourceBundle: function () {
			const oModel = this.getOwnerComponent().getModel("i18n");
			return oModel.getResourceBundle();
		},

		/**
		 * Convenience method for getting the view model by name in every controller of the application.
		 * @param {string} [sName] The model name
		 * @returns {sap.ui.model.Model} The model instance
		 */
		getModel: function (sName) {
			return this.getView().getModel(sName);
		},

		/**
		 * Convenience method for setting the view model in every controller of the application.
		 * @param {sap.ui.model.Model} oModel The model instance
		 * @param {string} [sName] The model name
		 * @returns {sap.ui.core.mvc.Controller} The current base controller instance
		 */
		setModel: function (oModel, sName) {
			this.getView().setModel(oModel, sName);
			return this;
		},

		/**
		 * Convenience method for triggering the navigation to a specific target.
		 * @public
		 * @param {string} sName Target name
		 * @param {object} [oParameters] Navigation parameters
		 * @param {boolean} [bReplace] Defines if the hash should be replaced (no browser history entry) or set (browser history entry)
		 */
		navTo: function (sName, oParameters, bReplace) {
			this.getRouter().navTo(sName, oParameters, undefined, bReplace);
		},

		/**
		 * Convenience event handler for navigating back.
		 * It there is a history entry we go one step back in the browser history
		 * If not, it will replace the current entry of the browser history with the main route.
		 */
		onNavBack: function () {
			const sPreviousHash = History.getInstance().getPreviousHash();
			if (sPreviousHash !== undefined) {
				window.history.go(-1);
			} else {
				this.getRouter().navTo("main", {}, undefined, true);
			}
		},
		onNavToHome: function() {
			this.getRouter().navTo("main", {}, true);
		},

		// ============================================================
		// BARCODE SCANNING FUNCTIONALITY
		// ============================================================

		/**
		 * Initialize FAB model for barcode scanner visibility
		 */
		initBarcodeFAB: function() {
			if (!this.getView().getModel("fab")) {
				this.getView().setModel(new JSONModel({
					visible: false
				}), "fab");
			}

			// Attach route change listener
			this.getRouter().attachRouteMatched(this._onRouteChanged, this);
		},

		/**
		 * Route changed handler to update FAB visibility
		 * @private
		 */
		_onRouteChanged: function(oEvent) {
			this._updateFABVisibility();
		},

		/**
		 * Update FAB visibility based on current route
		 * @private
		 */
		_updateFABVisibility: function() {
			const oContext = this._getCurrentNavigationContext();
			const bVisible = oContext &&
							 oContext.routeName !== "main" &&
							 oContext.routeName !== "competitors";

			const oFabModel = this.getView().getModel("fab");
			if (oFabModel) {
				oFabModel.setProperty("/visible", bVisible);
			}
		},

		/**
		 * Get current navigation context from route
		 * @private
		 * @returns {object|null} Navigation context with keys
		 */
		_getCurrentNavigationContext: function() {
			const oRouter = this.getRouter();
			const oHashChanger = sap.ui.core.routing.HashChanger.getInstance();
			const sHash = oHashChanger.getHash();

			const oRouteInfo = oRouter.getRouteInfoByHash(sHash);

			if (!oRouteInfo) {
				return null;
			}

			const oArgs = oRouteInfo.arguments;

			return {
				routeName: oRouteInfo.name,
				competitorKey: oArgs.competitorKey,
				competitorName: decodeURIComponent(oArgs.competitorName || ""),
				assortmentKey: oArgs.assortmentKey,

				// Hierarchy context (may be undefined)
				areaKey: oArgs.areaKey || oArgs.AreaKey,
				divisionKey: oArgs.divisionKey || oArgs.DivisionKey,
				familyKey: oArgs.familyKey || oArgs.FamilyKey,
				categoryKey: oArgs.categoryKey || oArgs.CategoryKey,
				productGroupKey: oArgs.ProductGroupKey
			};
		},

		/**
		 * Handler for FAB press - opens barcode scanner
		 */
		onBarcodeScanPress: function() {
			this._openBarcodeScanner();
		},

		/**
		 * Handler for Create Product button - creates new product and navigates to entry form
		 */
		onCreateProductPress: async function() {
			this.getView().setBusy(true);

			try {
				const oContext = this._getCurrentNavigationContext();

				if (!oContext) {
					MessageBox.error("Contexto de navegação não encontrado");
					return;
				}

				// Create new product without EAN (hierarchy can be edited in the form)
				const oNewProduct = await this._createNewProductDocument("", oContext, "ManualCreate");

				// Navigate to price entry form
				setTimeout(() => {
					this.navTo("ProductPriceEntryForm", {
						productSyncKey: encodeURIComponent(oNewProduct.SyncKey)
					});
				}, 300);

			} catch (error) {
				console.error("Create product error:", error);
				MessageBox.error("Erro ao criar produto: " + error.message);
			} finally {
				this.getView().setBusy(false);
			}
		},

		/**
		 * Open barcode scanner dialog
		 * @private
		 */
		_openBarcodeScanner: async function() {
			if (!this._oBarcodeScannerDialog) {
				// Generate unique ID prefix for this controller instance to avoid duplicate IDs
				const sFragmentId = this.getView().getId() + "--barcodeScanner";

				this._oBarcodeScannerDialog = await Fragment.load({
					id: sFragmentId,
					name: "com.financor.sd.shoppingapp.view.fragments.BarcodeScanner",
					controller: this
				});
				this.getView().addDependent(this._oBarcodeScannerDialog);

				// Attach afterOpen event to initialize scanner after DOM is ready (only once when creating)
				this._oBarcodeScannerDialog.attachAfterOpen(async () => {
					// Check camera permission then start scanner (only if Quagga is available)
					if (typeof window.Quagga !== 'undefined') {
						const bPermission = await this._handleCameraPermission();

						if (bPermission) {
							// Small delay to ensure DOM is fully rendered
							setTimeout(() => {
								this._initQuaggaScanner();
							}, 100);
						}
					} else {
						// Quagga not loaded - show message but allow manual entry
						const oScannerModel = this.getView().getModel("scannerModel");
						oScannerModel.setProperty("/statusText", "Câmara não disponível. Use entrada manual abaixo.");
					}
				});
			}

			// Initialize scanner model
			this.getView().setModel(new JSONModel({
				isScanning: false,
				statusText: this.getResourceBundle().getText("ScanInstructions"),
				manualEAN: ""
			}), "scannerModel");

			this._oBarcodeScannerDialog.open();
		},

		/**
		 * Handle camera permission request
		 * @private
		 * @returns {Promise<boolean>} Permission granted
		 */
		_handleCameraPermission: async function() {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({ video: true });
				stream.getTracks().forEach(track => track.stop());
				return true;
			} catch (error) {
				if (error.name === 'NotAllowedError') {
					MessageBox.error(this.getResourceBundle().getText("CameraPermissionDenied"));
				} else if (error.name === 'NotFoundError') {
					MessageBox.error(this.getResourceBundle().getText("CameraNotAvailable"));
				} else {
					MessageBox.error(this.getResourceBundle().getText("ScanErrorGeneric"));
				}
				return false;
			}
		},

		/**
		 * Initialize QuaggaJS scanner
		 * @private
		 */
		_initQuaggaScanner: function() {
			// Get the actual camera preview div (plain HTML element)
			const oPreview = document.querySelector('.cameraPreviewContainer');

			if (!oPreview) {
				MessageBox.error(this.getResourceBundle().getText("CameraNotAvailable"));
				return;
			}

			window.Quagga.init({
				inputStream: {
					name: "Live",
					type: "LiveStream",
					target: oPreview,
					constraints: {
						facingMode: "environment",
						width: { ideal: 1280 },
						height: { ideal: 720 }
					}
				},
				decoder: {
					readers: ["ean_reader"]
				},
				locate: true
			}, (err) => {
				if (err) {
					console.error(err);
					MessageBox.error(this.getResourceBundle().getText("CameraNotAvailable"));
					return;
				}
				window.Quagga.start();

				// Update model
				const oScannerModel = this.getView().getModel("scannerModel");
				oScannerModel.setProperty("/isScanning", true);
				oScannerModel.setProperty("/statusText", this.getResourceBundle().getText("ScanningInProgress"));
			});

			window.Quagga.onDetected(this._onBarcodeDetected.bind(this));
		},

		/**
		 * Handle barcode detection
		 * @private
		 * @param {object} result Quagga detection result
		 */
		_onBarcodeDetected: function(result) {
			const sCode = result.codeResult.code;

			// Validate EAN-13 (13 digits)
			if (!/^\d{13}$/.test(sCode)) {
				return;
			}

			// Stop scanning
			window.Quagga.stop();

			// Show success feedback
			const oScannerModel = this.getView().getModel("scannerModel");
			oScannerModel.setProperty("/isScanning", false);
			oScannerModel.setProperty("/statusText", this.getResourceBundle().getText("ScanSuccessMessage"));

			// Process EAN
			this._processBarcodeResult(sCode);
		},

		/**
		 * Process scanned barcode result
		 * @private
		 * @param {string} sEAN Scanned EAN code
		 */
		_processBarcodeResult: async function(sEAN) {
			this.getView().setBusy(true);

			try {
				const oContext = this._getCurrentNavigationContext();

				if (!oContext) {
					MessageBox.error("Contexto de navegação não encontrado");
					this._closeBarcodeScanner();
					return;
				}

				// Lookup product
				const oProduct = await this._lookupProductByEAN(sEAN, oContext.competitorKey, oContext.assortmentKey);

				let sProductSyncKey;

				if (oProduct) {
					// Existing product
					MessageToast.show(this.getResourceBundle().getText("ProductFound"));
					sProductSyncKey = oProduct.SyncKey || oProduct._id;
				} else {
					// Product not found - create new product (hierarchy can be edited in the form)
					MessageToast.show(this.getResourceBundle().getText("ProductNotFoundCreating"));
					const oNewProduct = await this._createNewProductDocument(sEAN, oContext);
					sProductSyncKey = oNewProduct.SyncKey;
				}

				// Close scanner
				this._closeBarcodeScanner();

				// Navigate to price entry form
				setTimeout(() => {
					this.navTo("ProductPriceEntryForm", {
						productSyncKey: encodeURIComponent(sProductSyncKey)
					});
				}, 300);

			} catch (error) {
				console.error("Barcode processing error:", error);
				MessageBox.error("Erro ao processar código: " + error.message);
			} finally {
				this.getView().setBusy(false);
			}
		},

		/**
		 * Lookup product by EAN in PouchDB
		 * @private
		 * @param {string} sEAN EAN code
		 * @param {string} sCompetitorKey Competitor key
		 * @param {string} sAssortmentKey Assortment key
		 * @returns {Promise<object|null>} Product document or null
		 */
		_lookupProductByEAN: async function(sEAN, sCompetitorKey, sAssortmentKey) {
			const db = new PouchDB(LOCAL_DB_NAME);

			try {
				const result = await db.find({
					selector: {
						entityName: "Products",
						Customer: sCompetitorKey,
						Assortment: sAssortmentKey,
						EAN: sEAN
					},
					limit: 1
				});

				if (result.docs.length > 0) {
					return result.docs[0];
				}

				return null;

			} catch (error) {
				console.error("EAN lookup error:", error);
				throw error;
			}
		},

		/**
		 * Create new product document with scanned EAN
		 * @private
		 * @param {string} sEAN Scanned EAN (empty string if manual creation)
		 * @param {object} oContext Navigation context
		 * @param {string} sCreatedBy Source of creation: "BarcodeScanner" or "ManualCreate"
		 * @returns {Promise<object>} Created product document
		 */
		_createNewProductDocument: async function(sEAN, oContext, sCreatedBy = "") {
			const MAX_RETRIES = 3;
			const db = new PouchDB(LOCAL_DB_NAME);

			// Only use hierarchy context if scanning from hierarchy navigation pages
			const bUseHierarchyContext = oContext.routeName &&
				["AreaList", "DivisionList", "FamilyList", "CategoryList", "ProductGroupList", "ProductList"]
				.includes(oContext.routeName);

			const sArea = bUseHierarchyContext && oContext.areaKey ? oContext.areaKey : "UNKNOWN_AREA";
			const sDivision = bUseHierarchyContext && oContext.divisionKey ? oContext.divisionKey : "UNKNOWN_DIVISION";
			const sFamily = bUseHierarchyContext && oContext.familyKey ? oContext.familyKey : "UNKNOWN_FAMILY";
			const sCategory = bUseHierarchyContext && oContext.categoryKey ? oContext.categoryKey : "UNKNOWN_CATEGORY";
			const sProductGroup = bUseHierarchyContext && oContext.productGroupKey ? oContext.productGroupKey : "UNKNOWN_GROUP";

			// If using hierarchy context, fetch the text descriptions from PouchDB
			let oHierarchyTexts = {};
			if (bUseHierarchyContext) {
				oHierarchyTexts = await this._fetchHierarchyTexts(oContext);
			}

			// Fetch competitor shop data (currency, sales org, distribution channel)
			const oCompetitorData = await this._fetchCompetitorShopData(oContext.competitorKey, oContext.assortmentKey);

			// Retry loop to handle 409 conflicts
			for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
				const sProductCode = this._generateProductCode();
				// const sProductCode = '';

				// Build SyncKey from context
				const sSyncKey = [
					"Products",
					oContext.assortmentKey,
					oContext.competitorKey,
					sArea,
					sDivision,
					sFamily,
					sCategory,
					sProductGroup,
					sProductCode
				].join("_");

				try {
					// Try to get existing document first (handles race condition)
					const existingDoc = await db.get(sSyncKey);
					console.log("Product with same SyncKey already exists, returning existing:", sSyncKey);
					return existingDoc;

				} catch (getError) {
					if (getError.status === 404) {
						// Document doesn't exist - create it
						const oNewProduct = {
							_id: sSyncKey,
							entityName: "Products",
							SyncKey: sSyncKey,
							Product: sProductCode,
							EAN: sEAN,

							// Context keys
							Customer: oContext.competitorKey,
							Assortment: oContext.assortmentKey,
							SalesOrganization: oCompetitorData.SalesOrganization,
							DistributionChannel: oCompetitorData.DistributionChannel,
							Area: sArea,
							Division: sDivision,
							Family: sFamily,
							Category: sCategory,
							ProductGroup: sProductGroup,

							// Hierarchy text descriptions (if available from context)
							AreaText: oHierarchyTexts.AreaText || "",
							DivisionText: oHierarchyTexts.DivisionText || "",
							FamilyText: oHierarchyTexts.FamilyText || "",
							CategoryText: oHierarchyTexts.CategoryText || "",
							ProductGroupText: oHierarchyTexts.ProductGroupText || "",

							// Default values
							MaterialDescription: sEAN ? `SCAN - EAN: ${sEAN}` : "NOVO PRODUTO",
							Brand: "",
							Currency: oCompetitorData.Currency,

							// Collection fields
							NormalPrice: null,
							PromoPrice: null,
							PromoType: "",
							PromoStartDate: null,
							PromoEndDate: null,
							Observations: "",
							LiquidContent: "",
							LiquidContentUnit: "L",
							IsCollected: false,
							CollectedDate: null,

							// New product flag - always true for products created this way
							IsNewProduct: true,

							// Metadata
							CreatedAt: new Date().toISOString(),
							CreatedBy: sCreatedBy
						};

						try {
							await db.put(oNewProduct);
							console.log("Product created successfully:", sSyncKey);
							return oNewProduct;

						} catch (putError) {
							if (putError.status === 409 && attempt < MAX_RETRIES - 1) {
								// Conflict - another process created a document with this SyncKey
								// Generate new product code and retry
								console.log(`Conflict on attempt ${attempt + 1}, retrying with new product code...`);
								continue;
							}
							throw putError; // Re-throw if not 409 or out of retries
						}
					}
					throw getError; // Re-throw if not 404
				}
			}

			throw new Error("Failed to create product after " + MAX_RETRIES + " retries due to conflicts");
		},

		/**
		 * Fetch competitor shop data (currency, sales org, distribution channel)
		 * @private
		 * @param {string} sCompetitorKey Competitor key
		 * @param {string} sAssortmentKey Assortment key
		 * @returns {Promise<object>} Competitor shop data
		 */
		_fetchCompetitorShopData: async function(sCompetitorKey, sAssortmentKey) {
			const db = new PouchDB(LOCAL_DB_NAME);

			try {
				const result = await db.find({
					selector: {
						entityName: "CompetitorShopList",
						Customer: sCompetitorKey,
						Assortment: sAssortmentKey
					},
					limit: 1
				});

				if (result.docs.length > 0) {
					const oCompetitor = result.docs[0];
					return {
						Currency: oCompetitor.Currency || "EUR",
						SalesOrganization: oCompetitor.SalesOrganization || "",
						DistributionChannel: oCompetitor.DistributionChannel || ""
					};
				}

				// Default values if competitor not found
				return {
					Currency: "EUR",
					SalesOrganization: "",
					DistributionChannel: ""
				};

			} catch (error) {
				console.error("Error fetching competitor shop data from CompetitorShopList:", error);
				// Default fallback
				return {
					Currency: "EUR",
					SalesOrganization: "",
					DistributionChannel: ""
				};
			}
		},

		/**
		 * Fetch hierarchy text descriptions from PouchDB
		 * @private
		 * @param {object} oContext Navigation context with hierarchy keys
		 * @returns {Promise<object>} Hierarchy text descriptions
		 */
		_fetchHierarchyTexts: async function(oContext) {
			const db = new PouchDB(LOCAL_DB_NAME);
			const oTexts = {};

			try {
				// Fetch Area text
				if (oContext.areaKey) {
					const areaResult = await db.find({
						selector: {
							entityName: "Areas",
							Area: oContext.areaKey,
							Customer: oContext.competitorKey,
							Assortment: oContext.assortmentKey
						},
						limit: 1
					});
					if (areaResult.docs.length > 0) {
						oTexts.AreaText = areaResult.docs[0].AreaText;
					}
				}

				// Fetch Division text
				if (oContext.divisionKey) {
					const divisionResult = await db.find({
						selector: {
							entityName: "Divisions",
							Division: oContext.divisionKey,
							Area: oContext.areaKey,
							Customer: oContext.competitorKey,
							Assortment: oContext.assortmentKey
						},
						limit: 1
					});
					if (divisionResult.docs.length > 0) {
						oTexts.DivisionText = divisionResult.docs[0].DivisionText;
					}
				}

				// Fetch Family text
				if (oContext.familyKey) {
					const familyResult = await db.find({
						selector: {
							entityName: "Families",
							Family: oContext.familyKey,
							Division: oContext.divisionKey,
							Area: oContext.areaKey,
							Customer: oContext.competitorKey,
							Assortment: oContext.assortmentKey
						},
						limit: 1
					});
					if (familyResult.docs.length > 0) {
						oTexts.FamilyText = familyResult.docs[0].FamilyText;
					}
				}

				// Fetch Category text
				if (oContext.categoryKey) {
					const categoryResult = await db.find({
						selector: {
							entityName: "Categories",
							Category: oContext.categoryKey,
							Family: oContext.familyKey,
							Division: oContext.divisionKey,
							Area: oContext.areaKey,
							Customer: oContext.competitorKey,
							Assortment: oContext.assortmentKey
						},
						limit: 1
					});
					if (categoryResult.docs.length > 0) {
						oTexts.CategoryText = categoryResult.docs[0].CategoryText;
					}
				}

				// Fetch ProductGroup text
				if (oContext.productGroupKey) {
					const productGroupResult = await db.find({
						selector: {
							entityName: "ProductGroups",
							ProductGroup: oContext.productGroupKey,
							Category: oContext.categoryKey,
							Family: oContext.familyKey,
							Division: oContext.divisionKey,
							Area: oContext.areaKey,
							Customer: oContext.competitorKey,
							Assortment: oContext.assortmentKey
						},
						limit: 1
					});
					if (productGroupResult.docs.length > 0) {
						oTexts.ProductGroupText = productGroupResult.docs[0].ProductGroupText;
					}
				}

			} catch (error) {
				console.error("Error fetching hierarchy texts:", error);
			}

			return oTexts;
		},

		/**
		 * Generate unique product code
		 * @private
		 * @returns {string} Product code
		 */
		_generateProductCode: function() {
			const timestamp = Date.now();
			const random = Math.floor(Math.random() * 100000); // Increased from 1K to 100K for better uniqueness
			const seq = this._scanSequence = (this._scanSequence || 0) + 1; // Sequential counter within session
			return `SCAN${timestamp}${random}${seq}`;			
		},

		/**
		 * Close barcode scanner dialog
		 */
		onCloseBarcodeScanner: function() {
			this._closeBarcodeScanner();
		},

		/**
		 * Close barcode scanner and cleanup
		 * @private
		 */
		_closeBarcodeScanner: function() {
			// Stop Quagga and remove event listeners
			if (typeof window.Quagga !== 'undefined') {
				window.Quagga.stop();
				window.Quagga.offDetected();
			}

			// Close the dialog (but don't destroy - we'll reuse it)
			if (this._oBarcodeScannerDialog) {
				this._oBarcodeScannerDialog.close();
			}
		},

		/**
		 * Handler for manual EAN entry
		 */
		onManualEANSubmit: function() {
			const sManualEAN = this.getView().getModel("scannerModel").getProperty("/manualEAN");

			if (!/^\d{13}$/.test(sManualEAN)) {
				MessageBox.warning(this.getResourceBundle().getText("InvalidEANCode"));
				return;
			}

			this._processBarcodeResult(sManualEAN);
		},

		/**
		 * Check which hierarchy values are missing from context
		 * @private
		 * @param {object} oContext Navigation context
		 * @returns {object} Object indicating which values are missing
		 */
		_checkMissingHierarchy: function(oContext) {
			return {
				needsArea: !oContext.areaKey,
				needsDivision: !oContext.divisionKey,
				needsFamily: !oContext.familyKey,
				needsCategory: !oContext.categoryKey,
				needsProductGroup: !oContext.productGroupKey,
				hasMissingValues: !oContext.areaKey || !oContext.divisionKey || !oContext.familyKey ||
								  !oContext.categoryKey || !oContext.productGroupKey
			};
		},

		/**
		 * Open hierarchy selection dialog for missing values
		 * @private
		 * @param {object} oContext Navigation context
		 * @param {string} sEAN Scanned EAN code
		 * @returns {Promise<object>} Promise that resolves with complete context
		 */
		_promptForHierarchySelection: async function(oContext, sEAN) {
			// Check which values are missing
			const oMissing = this._checkMissingHierarchy(oContext);

			if (!oMissing.hasMissingValues) {
				return oContext; // No missing values, return as-is
			}

			// Load hierarchy dialog if not already loaded
			if (!this._oHierarchySelectionDialog) {
				this._oHierarchySelectionDialog = await Fragment.load({
					name: "com.financor.sd.shoppingapp.view.fragments.HierarchySelectionDialog",
					controller: this
				});
				this.getView().addDependent(this._oHierarchySelectionDialog);
			}

			// Initialize hierarchy model
			const oHierarchyModel = new JSONModel({
				needsArea: oMissing.needsArea,
				needsDivision: oMissing.needsDivision,
				needsFamily: oMissing.needsFamily,
				needsCategory: oMissing.needsCategory,
				needsProductGroup: oMissing.needsProductGroup,

				selectedAreaKey: oContext.areaKey || "",
				selectedDivisionKey: oContext.divisionKey || "",
				selectedFamilyKey: oContext.familyKey || "",
				selectedCategoryKey: oContext.categoryKey || "",
				selectedProductGroupKey: oContext.productGroupKey || "",

				areas: [],
				divisions: [],
				families: [],
				categories: [],
				productGroups: [],

				// Store EAN and original context for later use
				ean: sEAN,
				originalContext: oContext
			});

			this.getView().setModel(oHierarchyModel, "hierarchyModel");

			// Load hierarchy options from database
			await this._loadHierarchyOptions(oContext);

			// Open dialog and return promise that resolves when user confirms
			return new Promise((resolve, reject) => {
				this._hierarchySelectionResolve = resolve;
				this._hierarchySelectionReject = reject;
				this._oHierarchySelectionDialog.open();
			});
		},

		/**
		 * Load hierarchy options from PouchDB
		 * @private
		 * @param {object} oContext Navigation context
		 */
		_loadHierarchyOptions: async function(oContext) {
			const db = new PouchDB(LOCAL_DB_NAME);
			const oHierarchyModel = this.getView().getModel("hierarchyModel");
			const oMissing = this._checkMissingHierarchy(oContext);

			try {
				// Load Areas if needed
				if (oMissing.needsArea) {
					const areaResult = await db.find({
						selector: {
							entityName: "Areas",
							Customer: oContext.competitorKey,
							Assortment: oContext.assortmentKey
						}
					});
					oHierarchyModel.setProperty("/areas", areaResult.docs);
				}

				// Load Divisions if needed (filtered by Area if available)
				if (oMissing.needsDivision) {
					const divisionSelector = {
						entityName: "Divisions",
						Customer: oContext.competitorKey,
						Assortment: oContext.assortmentKey
					};
					if (oContext.areaKey) {
						divisionSelector.Area = oContext.areaKey;
					}
					const divisionResult = await db.find({ selector: divisionSelector });
					oHierarchyModel.setProperty("/divisions", divisionResult.docs);
				}

				// Load Families if needed (filtered by Division if available)
				if (oMissing.needsFamily) {
					const familySelector = {
						entityName: "Families",
						Customer: oContext.competitorKey,
						Assortment: oContext.assortmentKey
					};
					if (oContext.divisionKey) {
						familySelector.Division = oContext.divisionKey;
					}
					const familyResult = await db.find({ selector: familySelector });
					oHierarchyModel.setProperty("/families", familyResult.docs);
				}

				// Load Categories if needed (filtered by Family if available)
				if (oMissing.needsCategory) {
					const categorySelector = {
						entityName: "Categories",
						Customer: oContext.competitorKey,
						Assortment: oContext.assortmentKey
					};
					if (oContext.familyKey) {
						categorySelector.Family = oContext.familyKey;
					}
					const categoryResult = await db.find({ selector: categorySelector });
					oHierarchyModel.setProperty("/categories", categoryResult.docs);
				}

				// Load ProductGroups if needed (filtered by Category if available)
				if (oMissing.needsProductGroup) {
					const productGroupSelector = {
						entityName: "ProductGroups",
						Customer: oContext.competitorKey,
						Assortment: oContext.assortmentKey
					};
					if (oContext.categoryKey) {
						productGroupSelector.Category = oContext.categoryKey;
					}
					const productGroupResult = await db.find({ selector: productGroupSelector });
					oHierarchyModel.setProperty("/productGroups", productGroupResult.docs);
				}

			} catch (error) {
				console.error("Error loading hierarchy options:", error);
				MessageBox.error("Erro ao carregar opções de hierarquia: " + error.message);
			}
		},

		/**
		 * Handler for hierarchy selection confirmation
		 */
		onConfirmHierarchySelection: function() {
			const oHierarchyModel = this.getView().getModel("hierarchyModel");
			const oMissing = {
				needsArea: oHierarchyModel.getProperty("/needsArea"),
				needsDivision: oHierarchyModel.getProperty("/needsDivision"),
				needsFamily: oHierarchyModel.getProperty("/needsFamily"),
				needsCategory: oHierarchyModel.getProperty("/needsCategory"),
				needsProductGroup: oHierarchyModel.getProperty("/needsProductGroup")
			};

			// Validate that all required fields are selected
			const aErrors = [];

			if (oMissing.needsArea && !oHierarchyModel.getProperty("/selectedAreaKey")) {
				aErrors.push(this.getResourceBundle().getText("AreaLabel"));
			}
			if (oMissing.needsDivision && !oHierarchyModel.getProperty("/selectedDivisionKey")) {
				aErrors.push(this.getResourceBundle().getText("DivisionLabel"));
			}
			if (oMissing.needsFamily && !oHierarchyModel.getProperty("/selectedFamilyKey")) {
				aErrors.push(this.getResourceBundle().getText("FamilyLabel"));
			}
			if (oMissing.needsCategory && !oHierarchyModel.getProperty("/selectedCategoryKey")) {
				aErrors.push(this.getResourceBundle().getText("CategoryLabel"));
			}
			if (oMissing.needsProductGroup && !oHierarchyModel.getProperty("/selectedProductGroupKey")) {
				aErrors.push(this.getResourceBundle().getText("ProductGroupLabel"));
			}

			if (aErrors.length > 0) {
				MessageBox.warning(
					this.getResourceBundle().getText("HierarchyValidationError") + ":\n" + aErrors.join(", ")
				);
				return;
			}

			// Build complete context
			const oOriginalContext = oHierarchyModel.getProperty("/originalContext");
			const oCompleteContext = {
				...oOriginalContext,
				areaKey: oHierarchyModel.getProperty("/selectedAreaKey") || oOriginalContext.areaKey,
				divisionKey: oHierarchyModel.getProperty("/selectedDivisionKey") || oOriginalContext.divisionKey,
				familyKey: oHierarchyModel.getProperty("/selectedFamilyKey") || oOriginalContext.familyKey,
				categoryKey: oHierarchyModel.getProperty("/selectedCategoryKey") || oOriginalContext.categoryKey,
				productGroupKey: oHierarchyModel.getProperty("/selectedProductGroupKey") || oOriginalContext.productGroupKey
			};

			// Close dialog
			this._oHierarchySelectionDialog.close();

			// Resolve promise with complete context
			if (this._hierarchySelectionResolve) {
				this._hierarchySelectionResolve(oCompleteContext);
				this._hierarchySelectionResolve = null;
				this._hierarchySelectionReject = null;
			}
		},

		/**
		 * Handler for hierarchy selection cancellation
		 */
		onCancelHierarchySelection: function() {
			// Close dialog
			this._oHierarchySelectionDialog.close();

			// Reject promise
			if (this._hierarchySelectionReject) {
				this._hierarchySelectionReject(new Error("Hierarchy selection cancelled by user"));
				this._hierarchySelectionResolve = null;
				this._hierarchySelectionReject = null;
			}
		},

		/**
		 * Handler for Area selection change - cascades to reload child levels
		 */
		onAreaChange: async function(oEvent) {
			const sSelectedArea = oEvent.getParameter("selectedItem")?.getKey();
			const oHierarchyModel = this.getView().getModel("hierarchyModel");
			const oOriginalContext = oHierarchyModel.getProperty("/originalContext");

			if (!sSelectedArea) {
				return;
			}

			// Clear all child selections
			oHierarchyModel.setProperty("/selectedDivisionKey", "");
			oHierarchyModel.setProperty("/selectedFamilyKey", "");
			oHierarchyModel.setProperty("/selectedCategoryKey", "");
			oHierarchyModel.setProperty("/selectedProductGroupKey", "");

			// Reload Divisions filtered by new Area
			if (oHierarchyModel.getProperty("/needsDivision")) {
				const db = new PouchDB(LOCAL_DB_NAME);
				try {
					const divisionResult = await db.find({
						selector: {
							entityName: "Divisions",
							Customer: oOriginalContext.competitorKey,
							Assortment: oOriginalContext.assortmentKey,
							Area: sSelectedArea
						}
					});
					oHierarchyModel.setProperty("/divisions", divisionResult.docs);
				} catch (error) {
					console.error("Error loading divisions:", error);
				}
			}

			// Clear child level options
			oHierarchyModel.setProperty("/families", []);
			oHierarchyModel.setProperty("/categories", []);
			oHierarchyModel.setProperty("/productGroups", []);
		},

		/**
		 * Handler for Division selection change - cascades to reload child levels
		 */
		onDivisionChange: async function(oEvent) {
			const sSelectedDivision = oEvent.getParameter("selectedItem")?.getKey();
			const oHierarchyModel = this.getView().getModel("hierarchyModel");
			const oOriginalContext = oHierarchyModel.getProperty("/originalContext");

			if (!sSelectedDivision) {
				return;
			}

			// Clear all child selections
			oHierarchyModel.setProperty("/selectedFamilyKey", "");
			oHierarchyModel.setProperty("/selectedCategoryKey", "");
			oHierarchyModel.setProperty("/selectedProductGroupKey", "");

			// Reload Families filtered by new Division
			if (oHierarchyModel.getProperty("/needsFamily")) {
				const db = new PouchDB(LOCAL_DB_NAME);
				try {
					const familyResult = await db.find({
						selector: {
							entityName: "Families",
							Customer: oOriginalContext.competitorKey,
							Assortment: oOriginalContext.assortmentKey,
							Division: sSelectedDivision
						}
					});
					oHierarchyModel.setProperty("/families", familyResult.docs);
				} catch (error) {
					console.error("Error loading families:", error);
				}
			}

			// Clear child level options
			oHierarchyModel.setProperty("/categories", []);
			oHierarchyModel.setProperty("/productGroups", []);
		},

		/**
		 * Handler for Family selection change - cascades to reload child levels
		 */
		onFamilyChange: async function(oEvent) {
			const sSelectedFamily = oEvent.getParameter("selectedItem")?.getKey();
			const oHierarchyModel = this.getView().getModel("hierarchyModel");
			const oOriginalContext = oHierarchyModel.getProperty("/originalContext");

			if (!sSelectedFamily) {
				return;
			}

			// Clear all child selections
			oHierarchyModel.setProperty("/selectedCategoryKey", "");
			oHierarchyModel.setProperty("/selectedProductGroupKey", "");

			// Reload Categories filtered by new Family
			if (oHierarchyModel.getProperty("/needsCategory")) {
				const db = new PouchDB(LOCAL_DB_NAME);
				try {
					const categoryResult = await db.find({
						selector: {
							entityName: "Categories",
							Customer: oOriginalContext.competitorKey,
							Assortment: oOriginalContext.assortmentKey,
							Family: sSelectedFamily
						}
					});
					oHierarchyModel.setProperty("/categories", categoryResult.docs);
				} catch (error) {
					console.error("Error loading categories:", error);
				}
			}

			// Clear child level options
			oHierarchyModel.setProperty("/productGroups", []);
		},

		/**
		 * Handler for Category selection change - cascades to reload ProductGroups
		 */
		onCategoryChange: async function(oEvent) {
			const sSelectedCategory = oEvent.getParameter("selectedItem")?.getKey();
			const oHierarchyModel = this.getView().getModel("hierarchyModel");
			const oOriginalContext = oHierarchyModel.getProperty("/originalContext");

			if (!sSelectedCategory) {
				return;
			}

			// Clear ProductGroup selection
			oHierarchyModel.setProperty("/selectedProductGroupKey", "");

			// Reload ProductGroups filtered by new Category
			if (oHierarchyModel.getProperty("/needsProductGroup")) {
				const db = new PouchDB(LOCAL_DB_NAME);
				try {
					const productGroupResult = await db.find({
						selector: {
							entityName: "ProductGroups",
							Customer: oOriginalContext.competitorKey,
							Assortment: oOriginalContext.assortmentKey,
							Category: sSelectedCategory
						}
					});
					oHierarchyModel.setProperty("/productGroups", productGroupResult.docs);
				} catch (error) {
					console.error("Error loading product groups:", error);
				}
			}
		}
	});
});
