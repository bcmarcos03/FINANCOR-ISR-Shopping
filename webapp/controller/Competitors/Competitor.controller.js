sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "com/financor/sd/shoppingapp/controller/BaseController",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (Controller, BaseController, MessageBox, MessageToast) {
    "use strict";
    const LOCAL_DB_NAME = "financorDB"; // Nome do seu PouchDB local

    return BaseController.extend("com.financor.sd.shoppingapp.controller.Competitors.Competitor", {

        onInit: function () {
            const db = new PouchDB(LOCAL_DB_NAME);
            const oView = this.getView();

            db.allDocs({ include_docs: true }).then(result => {
                console.log("Total de Documentos no PouchDB:", result.rows.length);

                result.rows.slice(0, 22).forEach(row => {
                    console.log("Documento de Exemplo:", row.doc.entityName, row.doc._id);
                });
                const competitorLists = result.rows
                    .map(row => row.doc)
                    .filter(doc => doc.entityName === "CompetitorShopList");
                console.log("Documentos filtrados:", competitorLists.length);

                const oModel = new sap.ui.model.json.JSONModel({
                    CompetitorLists: competitorLists
                });
                console.log("set oModel");
                oView.setModel(oModel, "listModel");

            }).catch(error => {
                console.error("Erro ao carregar dados do PouchDB:", error);
                sap.m.MessageBox.error("Não foi possível carregar a lista de concorrentes.");
            });
        },
        _loadCompetitorsFromPouchDB: async function () {

            const db = new PouchDB(LOCAL_DB_NAME);

            try {

                await db.createIndex({
                    index: { fields: ['entityName'] }
                });
                console.log("index atuaizado");

                const result = await db.find({
                    selector: {
                        entityName: "CompetitorShopList"
                    }
                    //fields: ['_id', 'entityName', 'CompetitorName', 'ShopId', 'CompetitorId']
                });

                const aItems = result.docs;
                const oModel = new sap.ui.model.json.JSONModel(aItems);
                this.getView().setModel(oModel, "competitors");

                console.log(`Competitors carregados: ${aItems.length} registros`);

            } catch (e) {
                console.error("Erro ao carregar CompetitorShopList do PouchDB:", e);
            }
        },
        onCompetitorPress: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext("listModel");
            const oSelectedCompetitor = oContext.getObject();
            const sCompetitorKey = oSelectedCompetitor.Customer;
            const sCompetitorName = oSelectedCompetitor.CustomerFullName;
            const sAssortmentKey = oSelectedCompetitor.Assortment;
            if (sCompetitorKey) {
                this.getOwnerComponent().getRouter().navTo("ProductSearch", {
                    competitorKey: sCompetitorKey,
                    competitorName: encodeURIComponent(sCompetitorName),
                    assortmentKey: sAssortmentKey
                });
            } else {
                sap.m.MessageToast.show("Erro: Chave de Sincronização (SyncKey) não encontrada para este concorrente.");
            }
        }

    });
});