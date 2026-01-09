sap.ui.define([
	"./BaseController",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/Fragment",
	"sap/ui/core/format/DateFormat",
	"sap/ui/model/odata/v2/ODataModel",
	"com/financor/sd/shoppingapp/utils/Constants",
	"com/financor/sd/shoppingapp/services/DatabaseService",
	"com/financor/sd/shoppingapp/utils/Formatters"
], function (BaseController, MessageBox, MessageToast, JSONModel, Fragment, DateFormat, ODataModel, Constants, DatabaseService, Formatters) {
	"use strict";

	return BaseController.extend("com.financor.sd.shoppingapp.controller.Main", {
		_oUserCardPopover: null,

		onInit: function () {
			// Initialize main model for pending sync count
			const oMainModel = new JSONModel({
				pendingSyncCount: 0
			});
			this.getView().setModel(oMainModel, "mainModel");

			// Initialize user card model
			if (!this.getView().getModel("userCardModel")) {
				this.getView().setModel(new JSONModel({}), "userCardModel");
			}

			// Initialize home model for user avatar
			if (!this.getView().getModel("home")) {
				this.getView().setModel(new JSONModel({
					user: {
						iconSrc: "sap-icon://collaborate",
						FullName: "Carregando..."
					}
				}), "home");
			}

			// Load initial data
			this._loadLastSyncTime();
			this._loadUserCardData();
			this._loadPendingSyncCount();
		},

		// ============================================================
		// Navigation Handlers
		// ============================================================

		onPressShopping: function () {
			this.getOwnerComponent().getRouter().navTo(Constants.ROUTES.COMPETITORS);
		},

		onPressCollectedPrices: function () {
			this.getOwnerComponent().getRouter().navTo(Constants.ROUTES.COLLECTED_PRICES);
		},

		// ============================================================
		// Sync Functions
		// ============================================================

		onPressSync: async function () {
			if (!navigator.onLine) {
				MessageBox.error(this.getResourceBundle().getText("OfflineSyncError"));
				return;
			}

			this.getView().setBusy(true);

			// SAFEGUARD: Absolute maximum timeout to guarantee UI cleanup
			const maxTimeoutMs = Constants.TIMING.ODATA_TIMEOUT * 2; // 60 seconds
			const safeguardTimer = setTimeout(() => {
				console.error("[SYNC] Safeguard timeout triggered - forcing UI cleanup");
				this.getView().setBusy(false);
				MessageBox.error(
					this.getResourceBundle().getText("SyncForceTimeoutError", [maxTimeoutMs / 1000]),
					{ title: this.getResourceBundle().getText("SyncTimeoutTitle") }
				);
			}, maxTimeoutMs);

			let diagnostics = null;

			try {
				// Create OData model on-demand (only when syncing)
			let oModel = this.getOwnerComponent().getModel();
			if (!oModel) {
				const oManifest = this.getOwnerComponent().getManifestEntry("/sap.app/dataSources/mainService");
				const sServiceUrl = oManifest.uri;
				oModel = new ODataModel({
					serviceUrl: sServiceUrl,
					useBatch: true,
					defaultCountMode: "Inline",
					timeout: Constants.TIMING.ODATA_TIMEOUT
				});
				this.getOwnerComponent().setModel(oModel);
			}
			let uploadResult = { success: 0, failed: 0, errors: [] };

			// Perform network diagnostics before attempting metadata load
			const oManifest = this.getOwnerComponent().getManifestEntry("/sap.app/dataSources/mainService");
			diagnostics = await this._performNetworkDiagnostics(oManifest.uri);

				const db = DatabaseService.getDB();

				// Upload collected products to OData (if needed)
				try {
					await db.createIndex({
						index: {
							fields: ['entityName', 'IsCollected'],
							name: 'entitiesCollectedIndex'
						}
					});

					let productsToUpdate = await db.find({
						selector: {
							entityName: 'Products',
							IsCollected: true
						}
					});

					if (productsToUpdate.docs.length > 0) {
						try {
						// Validate products before sync
						const validation = this._validateProductsForSync(productsToUpdate.docs);

						if (!validation.isValid) {
							console.error("Validation errors:", validation.errors);

							const sErrorMessage = "Alguns produtos têm dados em falta:\n\n" +
								validation.errors.slice(0, 5).join("\n") +
								(validation.errors.length > 5 ? `\n... e mais ${validation.errors.length - 5} erros` : "") +
								"\n\nTente sincronizar novamente os dados mestres.";

							MessageBox.error(sErrorMessage, {
								title: "Erro de Sincronização"
							});

							clearTimeout(safeguardTimer);
							this.getView().setBusy(false);
							return;
						}

						// CRITICAL: Ensure OData metadata is loaded with EXPLICIT timeout
						console.log("[SYNC] Waiting for OData metadata to load...");

						const metadataPromise = new Promise((resolve, reject) => {
							oModel.metadataLoaded().then(() => {
								console.log("[SYNC] OData metadata loaded successfully");
								resolve();
							}).catch((metadataError) => {
								console.error("[SYNC] Metadata loading failed:", metadataError);
								reject(metadataError);
							});
						});

						// Wrap with explicit timeout to prevent hanging
						await this._promiseWithTimeout(
							metadataPromise,
							Constants.TIMING.ODATA_TIMEOUT,
							"Metadata Loading"
						);

						console.log("[SYNC] Metadata loaded, proceeding with upload");

						// Show progress to user
						MessageToast.show(this.getResourceBundle().getText("SendingPricesMessage", [productsToUpdate.docs.length]));

						// Upload collected prices to server
						uploadResult = await this._savePouchDBToOdata(oModel, productsToUpdate.docs);

						console.log(`Upload results: ${uploadResult.success} success, ${uploadResult.failed} failed`);

						// Handle failures - keep only failed items for retry
						if (uploadResult.failed > 0) {
							// Mark successful uploads to exclude from next sync
							if (uploadResult.success > 0) {
								await this._markSuccessfulAsUploaded(db, productsToUpdate.docs, uploadResult);
							}

							// Ask user whether to proceed with sync despite failures
							const proceed = await this._confirmPartialFailure(uploadResult);
							if (!proceed) {
								this.getView().setBusy(false);
								return; // User cancelled - keep all collected data for retry
							}
							// User proceeds - failed items will be lost but were explicitly acknowledged
						}

					} catch (uploadError) {
						console.error("Upload error:", uploadError);

						// Critical error - ask user whether to continue
						const proceed = await this._confirmUploadFailure(uploadError, productsToUpdate.docs.length);
						if (!proceed) {
							clearTimeout(safeguardTimer);
							this.getView().setBusy(false);
							return; // User cancelled - keep collected data
						}
						// If user proceeds despite error, collected data will be lost
					}
				}

				} catch (e) {
					console.error("Error processing collected products:", e);
					// Continue with sync - this is not critical to fail the entire sync
				}

				// Reset PouchDB and download fresh data
				// Only reached if upload succeeded OR user confirmed proceeding despite failures
				try {
					await DatabaseService.destroyAndRecreate();
					console.log("Database reset for fresh sync");
				} catch (e) {
					console.error("Error resetting database:", e);
					throw e; // Re-throw to prevent partial sync state
				}

				await this._delay(50);

				const sets = [
					"CompetitorShopList",
					"ShoppingList",
					"Products",
					"ProductGroups",
					"Categories",
					"Families",
					"Divisions",
					"Areas",
					"UserCard"
				];

				for (const set of sets) {
					const data = await this._readODataSet(oModel, "/" + set);
					await this._saveODataToPouchDB(set, data);
				}

				// Enhanced success message with upload count
			let successMessage = this.getResourceBundle().getText("SyncCompletedTitle");
			if (uploadResult.success > 0) {
				successMessage = `${uploadResult.success} preços enviados. ${successMessage}`;
			}
			MessageBox.success(successMessage);
				this._updateLastSyncTime();
				this._loadUserCardData();
				this._loadPendingSyncCount();

			} catch (error) {
				console.error("[SYNC] Sync failed:", error);

				// Classify error and show appropriate message
				const classification = this._classifyError(error, diagnostics || {});
				const timeoutSeconds = Constants.TIMING.ODATA_TIMEOUT / 1000;

				this._showSyncError(classification, diagnostics || {}, timeoutSeconds);

			} finally {
				// Clear safeguard timer
				clearTimeout(safeguardTimer);

				// Always remove busy state
				this.getView().setBusy(false);
				console.log("[SYNC] Sync operation completed, UI cleanup done");
			}
		},

		/**
		 * Wraps a promise with an explicit timeout
		 * @param {Promise} promise - Promise to wrap
		 * @param {number} timeoutMs - Timeout in milliseconds
		 * @param {string} operationName - Name of operation for error messages
		 * @returns {Promise} Promise that rejects on timeout
		 * @private
		 */
		_promiseWithTimeout: function(promise, timeoutMs, operationName) {
			return Promise.race([
				promise,
				new Promise((_, reject) => {
					setTimeout(() => {
						reject({
							isTimeout: true,
							operation: operationName,
							timeoutMs: timeoutMs,
							message: `${operationName} exceeded timeout of ${timeoutMs}ms`,
							statusCode: 0
						});
					}, timeoutMs);
				})
			]);
		},

		/**
		 * Performs network diagnostics to help identify connectivity issues
		 * @param {string} serviceUrl - Backend service URL
		 * @returns {Promise<object>} Diagnostic information
		 * @private
		 */
		_performNetworkDiagnostics: async function(serviceUrl) {
			const diagnostics = {
				timestamp: new Date().toISOString(),
				navigatorOnline: navigator.onLine,
				connectionType: navigator.connection?.effectiveType || "unknown",
				isCordova: !!window.cordova,
				serviceUrl: serviceUrl,
				userAgent: navigator.userAgent,
				platform: window.device?.platform || "browser"
			};

			console.log("[NETWORK DIAGNOSTICS]", JSON.stringify(diagnostics, null, 2));

			return diagnostics;
		},

		/**
		 * Classifies an error and returns appropriate user message
		 * @param {object} error - Error object from OData or timeout
		 * @param {object} diagnostics - Network diagnostics
		 * @returns {object} Classification with message key and details
		 * @private
		 */
		_classifyError: function(error, diagnostics) {
			const classification = {
				type: "unknown",
				messageKey: "SyncFailedTitle",
				details: [],
				showDiagnostics: false
			};

			// Check for timeout
			if (error.isTimeout ||
				error.statusCode === 0 ||
				error.message?.toLowerCase().includes("timeout")) {
				classification.type = "timeout";
				classification.messageKey = "SyncTimeoutError";
				classification.showDiagnostics = true;
				classification.details.push("Operation timed out");
			}

			// Check for network unreachable (typical in emulator)
			else if (error.statusCode === 0 ||
					 error.message?.toLowerCase().includes("network") ||
					 error.message?.toLowerCase().includes("connection") ||
					 error.message?.toLowerCase().includes("failed to fetch")) {
				classification.type = "network_unreachable";
				classification.messageKey = "NetworkUnreachableError";
				classification.showDiagnostics = true;
				classification.details.push("Cannot reach backend server");

				// Add emulator-specific hints
				if (diagnostics.isCordova && diagnostics.platform === "Android") {
					classification.details.push("Android emulator may not route to backend IP");
					classification.details.push("Backend URL: " + diagnostics.serviceUrl);
				}
			}

			// HTTP error (backend reachable but returns error)
			else if (error.statusCode >= 400) {
				classification.type = "http_error";
				classification.messageKey = "SyncHttpError";
				classification.details.push(`HTTP ${error.statusCode}: ${error.message || "Unknown error"}`);
			}

			// Generic error
			else {
				classification.type = "unknown";
				classification.details.push(error.message || error.toString());
			}

			return classification;
		},

		/**
		 * Shows detailed error message with optional diagnostics
		 * @param {object} classification - Error classification
		 * @param {object} diagnostics - Network diagnostics
		 * @param {number} timeoutSeconds - Timeout value used
		 * @private
		 */
		_showSyncError: function(classification, diagnostics, timeoutSeconds) {
			const resourceBundle = this.getResourceBundle();
			let message = "";
			let title = "";

			// Build message based on error type
			switch (classification.type) {
				case "timeout":
					title = resourceBundle.getText("SyncTimeoutTitle");
					message = resourceBundle.getText("SyncTimeoutError", [timeoutSeconds]);
					break;

				case "network_unreachable":
					title = resourceBundle.getText("NetworkUnreachableTitle");
					message = resourceBundle.getText("NetworkUnreachableError");
					break;

				case "http_error":
					title = resourceBundle.getText("SyncHttpErrorTitle");
					message = resourceBundle.getText("SyncHttpError");
					break;

				default:
					title = resourceBundle.getText("SyncFailedTitle");
					message = resourceBundle.getText("SyncFailedMessage");
			}

			// Add technical details if diagnostics should be shown
			if (classification.showDiagnostics && classification.details.length > 0) {
				message += "\n\n" + resourceBundle.getText("TechnicalDetails") + ":\n";
				message += classification.details.join("\n");

				// Add network info for emulator issues
				if (diagnostics.isCordova) {
					message += "\n\n" + resourceBundle.getText("NetworkInfo") + ":\n";
					message += `Platform: ${diagnostics.platform}\n`;
					message += `Connection: ${diagnostics.connectionType}\n`;
					message += `Backend: ${diagnostics.serviceUrl}`;
				}
			}

			MessageBox.error(message, {
				title: title,
				actions: [MessageBox.Action.CLOSE, resourceBundle.getText("RetrySync")],
				emphasizedAction: MessageBox.Action.CLOSE,
				onClose: (action) => {
					if (action === resourceBundle.getText("RetrySync")) {
						this.onPressSync();
					}
				}
			});
		},

		_loadPendingSyncCount: async function () {
			try {
				const db = DatabaseService.getDB();

				await db.createIndex({
					index: {
						fields: ['entityName', 'IsCollected'],
						name: 'entitiesCollectedIndex'
					}
				});

				const result = await db.find({
					selector: {
						entityName: 'Products',
						IsCollected: true
					}
				});

				const count = result.docs.length;
				this.getView().getModel("mainModel").setProperty("/pendingSyncCount", count);

			} catch (e) {
				console.error("Error loading pending sync count:", e);
				this.getView().getModel("mainModel").setProperty("/pendingSyncCount", 0);
			}
		},

		_validateProductsForSync: function(aProducts) {
		const aErrors = [];

		aProducts.forEach((product, index) => {
			const sProductId = product.MaterialDescription || product.SyncKey || `Product ${index + 1}`;

			if (!product.SalesOrganization || product.SalesOrganization === "") {
				aErrors.push(`${sProductId}: Missing SalesOrganization`);
			}
			if (!product.DistributionChannel || product.DistributionChannel === "") {
				aErrors.push(`${sProductId}: Missing DistributionChannel`);
			}
			if (!product.Customer) {
				aErrors.push(`${sProductId}: Missing Customer`);
			}
			if (!product.Assortment) {
				aErrors.push(`${sProductId}: Missing Assortment`);
			}
		});

		return {
			isValid: aErrors.length === 0,
			errors: aErrors
		};
	},

	_readODataSet: function (oModel, sPath) {
			return new Promise((resolve, reject) => {
				oModel.read(sPath, {
					success: (oData) => resolve(oData.results || oData),
					error: (oError) => reject(oError)
				});
			});
		},

		_saveODataToPouchDB: async function (entityName, data) {
			const db = DatabaseService.getDB();

			const docs = data.map(item => {
				const clean = this._cleanODataItem(item);
				const id = clean.SyncKey;

				return {
					_id: id,
					...clean,
					entityName: entityName,
					timestamp: new Date().toISOString()
				};
			});

			try {
				const response = await db.bulkDocs(docs);
				console.log(`✔ ${entityName}: Saved to PouchDB (${docs.length} records)`);
				return response;
			} catch (err) {
				console.error(`Error saving to PouchDB: ${entityName}:`, err);
				throw err;
			}
		},

		_cleanODataItem: function (item) {
			const clone = { ...item };
			delete clone.__metadata;

			Object.keys(clone).forEach(k => {
				if (k.startsWith("_") || k.startsWith("$")) {
					delete clone[k];
				}
			});

			return clone;
		},

		_delay: function (ms) {
			return new Promise(resolve => setTimeout(resolve, ms));
		},

		// ============================================================
		// Sync Time Functions
		// ============================================================

		_loadLastSyncTime: function () {
			const sTimestamp = localStorage.getItem("lastSyncTimestamp");
			let oData = { LastSync: null };

			if (sTimestamp) {
				oData.LastSync = new Date(sTimestamp);
			}

			const oSyncModel = new JSONModel(oData);
			this.getOwnerComponent().setModel(oSyncModel, "syncModel");
		},

		_updateLastSyncTime: function () {
			const now = new Date();
			localStorage.setItem("lastSyncTimestamp", now.toISOString());

			const oSyncModel = this.getOwnerComponent().getModel("syncModel");
			if (oSyncModel) {
				oSyncModel.setData({ LastSync: now });
			}
		},

		// ============================================================
		// User Card Functions
		// ============================================================

		_loadUserCardData: async function () {
			const oUserCard = await this._readUserCardFromPouch();

			if (oUserCard) {
				this.getView().getModel("userCardModel").setData(oUserCard);
				this.getView().getModel("home").setProperty("/user/FullName", oUserCard.FullName);
			} else {
				console.warn("UserCard not found in PouchDB");
				this.getView().getModel("home").setProperty("/user/FullName", this.getResourceBundle().getText("NotSynchronized"));
			}
		},

		_readUserCardFromPouch: async function () {
			try {
				const db = DatabaseService.getDB();
				const result = await db.allDocs({ include_docs: true });

				const aUserCardDocs = result.rows
					.map(row => row.doc)
					.filter(doc => doc.entityName === 'UserCard');

				return aUserCardDocs.length > 0 ? aUserCardDocs[0] : null;
			} catch (error) {
				console.error("Error reading UserCard from PouchDB:", error);
				return null;
			}
		},

		onPressUserCard: async function (oEvent) {
			const oAvatar = oEvent.getSource();
			this.getView().setBusy(true);

			try {
				await this._loadUserCardData();
				const oUserCardData = this.getView().getModel("userCardModel").getData();

				if (!oUserCardData || !oUserCardData.FullName) {
					MessageToast.show(this.getResourceBundle().getText("UserCardDataUnavailable"));
					return;
				}

				if (!this._oUserCardPopover) {
					this._oUserCardPopover = await Fragment.load({
						name: "com.financor.sd.shoppingapp.view.fragments.UserCardPopover",
						controller: this
					});
					this.getView().addDependent(this._oUserCardPopover);
				}

				this._oUserCardPopover.openBy(oAvatar);

			} catch (sError) {
				MessageBox.error("Erro ao exibir o Cartão de Usuário: " + sError.message);
			} finally {
				this.getView().setBusy(false);
			}
		},

		// ============================================================
		// Collected Prices Upload Functions
		// ============================================================

		_toSapDate: function (isoString) {
			// Return Date object - OData Model will handle conversion to backend format
			if (!isoString) return null;
			const date = new Date(isoString);
			if (isNaN(date.getTime())) return null;
			return date;
		},

		_toSapTime: function (isoString) {
			// Convert to Edm.Time format (milliseconds since midnight)
			if (!isoString) return null;
			const date = new Date(isoString);
			if (isNaN(date.getTime())) return null;

			// Calculate milliseconds since midnight UTC
			const hours = date.getUTCHours();
			const minutes = date.getUTCMinutes();
			const seconds = date.getUTCSeconds();
			const ms = (hours * 3600 + minutes * 60 + seconds) * 1000;

			return { __edmType: "Edm.Time", ms: ms };
		},

		_prepareCollectedPricePayload: function (product) {
			// Prepare payload for CollectedPrices entity
			return {
				// Product identification fields - ensure strings
				SyncKey: String(product.SyncKey || ""),
				Product: product.IsNewProduct ? "" : String(product.Product || ""),
				MaterialName: String(product.MaterialDescription || ""),
				EAN: String(product.EAN || ""),
				Brand: String(product.Brand || ""),

				// Hierarchical classification (for reference) - ensure strings
				Customer: this._formatCustomerNumber(product.Customer),
				Assortment: String(product.Assortment || ""),
				SalesOrganization: String(product.SalesOrganization || ""),
				DistributionChannel: String(product.DistributionChannel || ""),
				Area: String(product.Area || ""),
				Division: String(product.Division || ""),
				Family: String(product.Family || ""),
				Category: String(product.Category || ""),
				ProductGroup: String(product.ProductGroup || ""),

				// Collected price data
				NormalPrice: product.NormalPrice ? parseFloat(product.NormalPrice).toFixed(2) : "0.00",
				PromoPrice: product.PromoPrice ? parseFloat(product.PromoPrice).toFixed(2) : null,
				PromoType: product.PromoType || "",
				PromoStartDate: this._toSapDate(product.PromoStartDate),
				PromoEndDate: this._toSapDate(product.PromoEndDate),
				Observations: product.Observations || "",
				LiquidContent: product.LiquidContent || "",
				LiquidUnit: product.LiquidContentUnit || "L",
				Currency: String(product.Currency || "EUR"),
				CollectedDate: this._toSapDate(product.CollectedDate),
				CollectedTime: this._toSapTime(product.CollectedDate),
				LastChangedAt: product.CollectedDate ? new Date(product.CollectedDate) : new Date()
			};
		},

		_formatMaterialNumber: function (material) {
			// Format material number with leading zeros (SAP MATNR format - 18 chars)
			if (!material) return "";
			const sMaterial = String(material).trim();
			// Pad with leading zeros to 18 characters
			return sMaterial.padStart(18, "0");
		},

		_formatCustomerNumber: function (customer) {
			// Format customer number with leading zeros (SAP KUNNR format - 10 chars)
			if (!customer) return "";
			const sCustomer = String(customer).trim();
			// Pad with leading zeros to 10 characters
			return sCustomer.padStart(10, "0");
		},

		_savePouchDBToOdata: function (oModel, productsArray) {
			return new Promise((resolve, reject) => {
				const results = {
					success: 0,
					failed: 0,
					errors: [],
					total: productsArray.length
				};

				// Use deferred batch mode for better control
				oModel.setDeferredGroups(["collectedPrices"]);
				oModel.setChangeGroups({
					"CollectedPrices": {
						groupId: "collectedPrices",
						single: false  // Batch multiple changes
					}
				});

				// Create entries for all products (not sent yet)
				productsArray.forEach((product) => {
					const payload = this._prepareCollectedPricePayload(product);

					oModel.createEntry("/CollectedPrices", {
						properties: payload,
						groupId: "collectedPrices"
					});
				});

				// Submit all changes in a single batch request
				oModel.submitChanges({
					groupId: "collectedPrices",
					success: (oData) => {
						// Parse batch response
						const batchResponse = oData.__batchResponses || [];

						batchResponse.forEach((response) => {
							if (response.response) {
								// Error response
								const statusCode = response.response.statusCode;
								if (statusCode >= 400) {
									results.failed++;
									results.errors.push({
										error: response.response.message || response.response.body,
										statusCode: statusCode
									});
								}
							} else if (response.__changeResponses) {
								// Success responses
								response.__changeResponses.forEach((change) => {
									if (change.statusCode && change.statusCode >= 200 && change.statusCode < 300) {
										results.success++;
									} else {
										results.failed++;
										results.errors.push({
											error: change.message || "Unknown error",
											statusCode: change.statusCode
										});
									}
								});
						} });

						console.log(`Batch upload: ${results.success} success, ${results.failed} failed`);
						resolve(results);
					},
					error: (oError) => {
						console.error("Batch upload failed:", oError);
						results.failed = productsArray.length;

						// Check if error is timeout-related
						const isTimeout = oError.statusCode === 0 ||
										  oError.message?.includes("timeout") ||
										  oError.message?.includes("Timeout");

					results.errors.push({
						error: isTimeout
							? this.getResourceBundle().getText("NetworkTimeoutMessage")
							: (oError.message || oError.toString()),
						isCritical: true,
						isTimeout: isTimeout
					});
					reject(results);
				}
				});

				// Reset deferred groups after submission
				oModel.setDeferredGroups([]);
			});
		},

		_markSuccessfulAsUploaded: async function (db, products, uploadResult) {
			// Mark successfully uploaded products to prevent re-upload
			// This way, if sync fails, only failed items remain for retry

			const successfulCount = uploadResult.success;
			let marked = 0;

			for (const product of products) {
				if (marked >= successfulCount) break;

				try {
					// Remove IsCollected flag from successful uploads
					product.IsCollected = false;
					product.UploadedDate = new Date().toISOString();
					await db.put(product);
					marked++;
				} catch (error) {
					console.error(`Failed to mark product ${product.SyncKey}:`, error);
				}
			}

			console.log(`Marked ${marked} products as uploaded`);
		},

		_confirmPartialFailure: function (uploadResult) {
			return new Promise((resolve) => {
				const message =
					`✓ ${uploadResult.success} preços enviados com sucesso\n` +
					`✗ ${uploadResult.failed} preços falharam\n\n` +
					`Continuar com sincronização?\n` +
					`AVISO: Os preços não enviados serão perdidos.`;

				MessageBox.warning(message, {
					title: "Envio Parcial",
					actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
					emphasizedAction: MessageBox.Action.CANCEL,
					onClose: (action) => {
						resolve(action === MessageBox.Action.OK);
					}
				});
			});
		},

		_confirmUploadFailure: function (error, count) {
			return new Promise((resolve) => {
				const message =
					`Erro ao enviar preços coletados:\n${error.message}\n\n` +
					`Continuar com sincronização?\n` +
					`AVISO: ${count} preços coletados serão perdidos.`;

				MessageBox.error(message, {
					title: "Erro de Envio",
					actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
					emphasizedAction: MessageBox.Action.CANCEL,
					onClose: (action) => {
						resolve(action === MessageBox.Action.OK);
					}
				});
			});
		},

		// ============================================================
		// Formatters
		// ============================================================

		formatSrc: function (sSrc) {
			return sSrc;
		},

		formatDateTime: function (oDate) {
			if (!oDate || !(oDate instanceof Date)) {
				return this.getResourceBundle().getText("NeverSynchronized");
			}

			const oDateFormat = DateFormat.getDateTimeInstance({
				pattern: "dd/MM/yyyy HH:mm:ss"
			});

			return Formatters.formatDateTime(oDate);
		}
	});
});
