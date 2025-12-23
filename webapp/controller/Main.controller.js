sap.ui.define([
	"./BaseController",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/Fragment",
	"sap/ui/core/format/DateFormat"
], function (BaseController, MessageBox, MessageToast, JSONModel, Fragment, DateFormat) {
	"use strict";

	const LOCAL_DB_NAME = "financorDB";

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
			this.getOwnerComponent().getRouter().navTo("competitors");
		},

		onPressCollectedPrices: function () {
			this.getOwnerComponent().getRouter().navTo("CollectedPrices");
		},

		// ============================================================
		// Sync Functions
		// ============================================================

		onPressSync: async function () {
			if (!navigator.onLine) {
				MessageBox.error("Você está offline. A sincronização requer conexão com a internet.");
				return;
			}

			this.getView().setBusy(true);
			try {				
				let oModel = this.getOwnerComponent().getModel();
			let uploadResult = { success: 0, failed: 0, errors: [] };
				

				const db = new PouchDB(LOCAL_DB_NAME);

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
						// Show progress to user
						MessageToast.show(`Enviando ${productsToUpdate.docs.length} preços coletados...`);

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
							this.getView().setBusy(false);
							return; // User cancelled - keep collected data
						}
						// If user proceeds despite error, collected data will be lost
					}
				}
				} catch (e) {
					console.error("Error uploading collected products:", e);
				}

				// Reset PouchDB and download fresh data
				try {
					await db.destroy();
					console.log("PouchDB destroyed for fresh sync");
				} catch (e) {
					console.error("Error destroying PouchDB:", e);
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
			let successMessage = "Sincronização Concluída";
			if (uploadResult.success > 0) {
				successMessage = `${uploadResult.success} preços enviados. ${successMessage}`;
			}
			MessageBox.success(successMessage);
				this._updateLastSyncTime();
				this._loadUserCardData();
				this._loadPendingSyncCount();

			} catch (error) {
				console.error("Sync failed:", error);
				MessageBox.error("Falha na Sincronização");
			} finally {
				this.getView().setBusy(false);
			}
		},

		_loadPendingSyncCount: async function () {
			try {
				const db = new PouchDB(LOCAL_DB_NAME);

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

		_readODataSet: function (oModel, sPath) {
			return new Promise((resolve, reject) => {
				oModel.read(sPath, {
					success: (oData) => resolve(oData.results || oData),
					error: (oError) => reject(oError)
				});
			});
		},

		_saveODataToPouchDB: async function (entityName, data) {
			const db = new PouchDB(LOCAL_DB_NAME);

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
				this.getView().getModel("home").setProperty("/user/FullName", "Não Sincronizado");
			}
		},

		_readUserCardFromPouch: async function () {
			try {
				const db = new PouchDB(LOCAL_DB_NAME);
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
					MessageToast.show("Dados do Cartão de Usuário não disponíveis. Por favor, Sincronize o App.");
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
				// Product identification fields
				SyncKey: product.SyncKey,
				Product: product.Product,
				MaterialName: product.MaterialDescription,
				EAN: product.EAN,
				Brand: product.Brand,

				// Hierarchical classification (for reference)
				Customer: product.Customer,
				Assortment: product.Assortment,
				Area: product.Area,
				Division: product.Division,
				Family: product.Family,
				Category: product.Category,
				ProductGroup: product.ProductGroup,

				// Collected price data
				NormalPrice: product.NormalPrice ? parseFloat(product.NormalPrice).toFixed(2) : "0.00",
				PromoPrice: product.PromoPrice ? parseFloat(product.PromoPrice).toFixed(2) : null,
				PromoType: product.PromoType || "",
				PromoStartDate: this._toSapDate(product.PromoStartDate),
				PromoEndDate: this._toSapDate(product.PromoEndDate),
				Observations: product.Observations || "",
				LiquidContent: product.LiquidContent || "",
				LiquidUnit: product.LiquidContentUnit || "L",
				CollectedDate: this._toSapDate(product.CollectedDate),
			CollectedTime: this._toSapTime(product.CollectedDate),
			LastChangedAt: product.CollectedDate ? new Date(product.CollectedDate) : new Date()
			};
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
						results.errors.push({
							error: oError.message || oError.toString(),
							isCritical: true
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
				return "Nunca Sincronizado";
			}

			const oDateFormat = DateFormat.getDateTimeInstance({
				pattern: "dd/MM/yyyy HH:mm:ss"
			});

			return oDateFormat.format(oDate);
		}
	});
});
