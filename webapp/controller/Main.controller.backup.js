sap.ui.define([
	"./BaseController",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"sap/ui/model/json/JSONModel",
	"sap/m/Popover",
	"sap/ui/core/Fragment"
], function (BaseController, MessageBox, MessageToast, JSONModel, Popover, Fragment) {
	"use strict";
	const SAP_ODATA_URL = "/sap/opu/odata/sap/ZSHOPPING_COMPETITORS/";
	const ENTITY_SET_COMPETITOR = "CompetitorShopList";
	const LOCAL_DB_NAME = "financorDB"; //PouchDB local

	return BaseController.extend("com.financor.sd.shoppingapp.controller.Main", {
		_oUserCardPopover: null,
		onInit: function () {
			console.log("Start");
			this._loadLastSyncTime();
			if (!this.getView().getModel("userCardModel")) {
				this.getView().setModel(new JSONModel({}), "userCardModel");
			}
			if (!this.getView().getModel("home")) {
				this.getView().setModel(new JSONModel({
					user: {
						iconSrc: "sap-icon://collaborate",
						FullName: "Carregando..."
					},
					homeIconSrc: "sap-icon://home"
				}), "home");
			}
			this._loadUserCardData();
			this._loadLastSyncTime();
		},
		onPressShopping: function () {
			console.log("Navigating to Competitors...");
			this.getOwnerComponent().getRouter().navTo("competitors");
		},
		onPressCollectedPrices: function () {
			console.log("Navigating to Collected Prices...");
			this.getOwnerComponent().getRouter().navTo("CollectedPrices");
		},
		sayHello: function () {
			MessageBox.show("Hello World!");
		},
		readODataSet: async function (oModel, sPath) {
			return new Promise((resolve, reject) => {
				oModel.read(sPath, {
					success: (oData) => resolve(oData.results || oData),
					error: (oError) => reject(oError)
				});
			});
		},
		onPressSync: async function () {
			// procurar novo método. pois dependerá de VPN e não só internet
			if (!navigator.onLine) {

				MessageBox.error("Você está offline. A sincronização requer conexão com a internet.");
				return;
			}
			this.getView().setBusy(true);
			try {
				const oModel = new sap.ui.model.odata.v2.ODataModel({
					serviceUrl: "/sap/opu/odata/sap/ZSHOPPING_COMPETITORS/",
					defaultBindingMode: "OneWay",
					defaultHeaders: {
						"X-CSRF-Token": "Fetch"
					},
					withCredentials: true
				});
				// Acessa o PouchDB local
				const db = new PouchDB(LOCAL_DB_NAME);


				//**UPDATE PRODUCTS FROM POUCHDB TO ODATA */
				// Create index for finding Products
				try {
					await db.createIndex({
						index: {
							fields: ['entityName', 'isCollected'],
							name: 'entitiesCollectedIndex'
						}
						});

						// Find collected products to update
					let productsToUpdate = await db.find({
						selector: {
							entityName: 'Products',
							IsCollected: true },
						});
					if (productsToUpdate.docs.length > 0) {
						let productsToUpdateJSON = JSON.stringify(productsToUpdate.docs);
						// this._savePouchDBToOdata(productsToUpdateJSON)

					}

				} catch (e) {

				}

				//**RESETS POUCHDB CONTENT*/
				try {

					await db.destroy();
					console.log('Delete DB');
				} catch (e) {

				}
				await this._delay(50);
				const sets = ["CompetitorShopList", "ShoppingList", "Products", "ProductGroups", "Categories", "Families", "Divisions", "Areas", "UserCard"];
				for (let set of sets) {
					const data = await this.readODataSet(oModel, "/" + set);
					await this._saveODataToPouchDB(LOCAL_DB_NAME, set, data);
				}
				MessageBox.success("Sincronização Concluida");
				this._updateLastSyncTime();
				this._loadUserCardData();
			} catch (error) {
				console.error("Falha Sincronização");
				MessageBox.error("Falha Sync");
			} finally {
				this.getView().setBusy(false);
			}

		},
		_cleanODataItem: function (item) {
			const clone = { ...item };

			// Remover metadados OData
			delete clone.__metadata;

			// Remover campos iniciados com "_"
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
		/**
		 * OData > PouchDB.
		 * @param {String} dbName - PouchDB local
		 * @param {String} entityName - entityname ("Products")
		 * @param {Array} data -  OData
		 */
		_saveODataToPouchDB: async function (dbName, entityName, data) {
			const newdb = new PouchDB(LOCAL_DB_NAME);
			// Normaliza os documentos
			const docs = data.map(item => {
				const clean = this._cleanODataItem(item);
				// é necessário chave única
				const id = clean.SyncKey;

				let doc = {
					_id: id,
					...clean,
					entityName: entityName,
					timestamp: new Date().toISOString()
				};
				//delete doc.SyncKey;
				return doc;
			});

			try {
				const response = await newdb.bulkDocs(docs);
				console.log(`✔ ${entityName}: Salvo no PouchDB (${docs.length} registros)`);
				return response;
			} catch (err) {
				console.error(`Erro ao salvar no PouchDB: ${entityName}:`, err);
				throw err;
			}
		},
		_loadLastSyncTime: function () {
			const sTimestamp = localStorage.getItem("lastSyncTimestamp");
			let oData = { LastSync: null };

			if (sTimestamp) {
				oData.LastSync = new Date(sTimestamp);
			}
			const oSyncModel = new sap.ui.model.json.JSONModel(oData);
			this.getOwnerComponent().setModel(oSyncModel, "syncModel");
		},

		// Salva o timestamp no sucesso da sincronização
		_updateLastSyncTime: function () {
			const now = new Date();
			const sTimestamp = now.toISOString();

			localStorage.setItem("lastSyncTimestamp", sTimestamp);

			const oSyncModel = this.getOwnerComponent().getModel("syncModel");
			if (oSyncModel) {
				oSyncModel.setData({ LastSync: now });
			}
		},
		_loadUserCardData: async function () {
			const oUserCard = await this._readUserCardFromPouch();
			if (oUserCard) {
				this.getView().getModel("userCardModel").setData(oUserCard);

				this.getView().getModel("home").setProperty("/user/FullName", oUserCard.FullName);
			} else {
				console.warn("UserCard não encontrado no PouchDB local.");
				this.getView().getModel("home").setProperty("/user/FullName", "Não Sincronizado");
			}
		},
		_readUserCardFromPouch: async function () {
			const db = new PouchDB(LOCAL_DB_NAME);
			try {
				const result = await db.allDocs({ include_docs: true });
				const aUserCardDocs = result.rows
					.map(row => row.doc)
					.filter(doc => doc.entityName === 'UserCard');
				return aUserCardDocs.length > 0 ? aUserCardDocs[0] : null;

			} catch (error) {
				console.error("Erro ao ler UserCard do PouchDB:", error);
				return null;
			}
		},
		//AVATAR CARD
		onPressUserCard: async function (oEvent) {
			const oAvatar = oEvent.getSource();
			this.getView().setBusy(true);

			try {
				// load dados
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
		// FORMATTER: Icon source
		formatSrc: function (sSrc) {
			return sSrc;
		},
		// FORMATER DATETIME
		formatDateTime: function (oDate) {
			if (!oDate || !(oDate instanceof Date)) {
				return "Nunca Sincronizado";
			}
			const oDateFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({
				pattern: "dd/MM/yyyy HH:mm:ss"
			});
			return oDateFormat.format(oDate);
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
	});
});
