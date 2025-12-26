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
                // Hierarchy fields
                areaKey: "",
                divisionKey: "",
                familyKey: "",
                categoryKey: "",
                productGroupKey: "",
                // Hierarchy options
                areas: [],
                divisions: [],
                families: [],
                categories: [],
                productGroups: [],
                // Metadata
                competitorKey: "",
                assortmentKey: "",
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
                    const oFormModel = this.getView().getModel("formModel");

                    // Check if this is a newly scanned product with unknown hierarchy
                    const bIsNewScannedProduct = this._isNewScannedProduct(oProduct);

                    if (bIsNewScannedProduct) {
                        // Clean slate - reset hierarchy to empty for user to fill
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
                            // Hierarchy fields - empty for clean record
                            areaKey: "",
                            divisionKey: "",
                            familyKey: "",
                            categoryKey: "",
                            productGroupKey: "",
                            // Hierarchy options - start clean
                            areas: [],
                            divisions: [],
                            families: [],
                            categories: [],
                            productGroups: [],
                            // Metadata
                            competitorKey: oProduct.Customer || "",
                            assortmentKey: oProduct.Assortment || "",
                            _originalProduct: oProduct
                        });

                        // Load only top-level hierarchy (areas) for user to select
                        await this._loadAreas();
                    } else {
                        // Existing product or product with known hierarchy
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
                            // Hierarchy fields - use existing values
                            areaKey: oProduct.Area || "",
                            divisionKey: oProduct.Division || "",
                            familyKey: oProduct.Family || "",
                            categoryKey: oProduct.Category || "",
                            productGroupKey: oProduct.ProductGroup || "",
                            // Hierarchy options (will be loaded)
                            areas: [],
                            divisions: [],
                            families: [],
                            categories: [],
                            productGroups: [],
                            // Metadata
                            competitorKey: oProduct.Customer || "",
                            assortmentKey: oProduct.Assortment || "",
                            _originalProduct: oProduct
                        });

                        // Load full hierarchy cascade
                        await this._loadHierarchyOptions();
                    }
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

        /**
         * Check if product is a newly scanned product with unknown hierarchy
         * @private
         * @param {object} oProduct Product document
         * @returns {boolean} True if new scanned product
         */
        _isNewScannedProduct: function (oProduct) {
            // Check if product has UNKNOWN hierarchy values
            const bHasUnknownHierarchy = (
                oProduct.Area === "UNKNOWN_AREA" ||
                oProduct.Division === "UNKNOWN_DIVISION" ||
                oProduct.Family === "UNKNOWN_FAMILY" ||
                oProduct.Category === "UNKNOWN_CATEGORY" ||
                oProduct.ProductGroup === "UNKNOWN_GROUP"
            );

            // Check if product was recently created by barcode scanner (within last 10 seconds)
            const bRecentlyCreated = oProduct.CreatedBy === "BarcodeScanner" &&
                oProduct.CreatedAt &&
                (new Date() - new Date(oProduct.CreatedAt)) < 10000;

            return bHasUnknownHierarchy || bRecentlyCreated;
        },

        /**
         * Load only Areas (top-level hierarchy) for new scanned products
         * @private
         */
        _loadAreas: async function() {
            const oFormModel = this.getView().getModel("formModel");
            const sCompetitorKey = oFormModel.getProperty("/competitorKey");
            const sAssortmentKey = oFormModel.getProperty("/assortmentKey");

            const db = new PouchDB(LOCAL_DB_NAME);

            try {
                // Load Areas
                const areaResult = await db.find({
                    selector: {
                        entityName: "Areas",
                        Customer: sCompetitorKey,
                        Assortment: sAssortmentKey
                    }
                });
                oFormModel.setProperty("/areas", areaResult.docs);

                // Clear all lower-level hierarchy options
                oFormModel.setProperty("/divisions", []);
                oFormModel.setProperty("/families", []);
                oFormModel.setProperty("/categories", []);
                oFormModel.setProperty("/productGroups", []);

            } catch (error) {
                console.error("Error loading areas:", error);
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

            // Validate hierarchy fields
            const aHierarchyErrors = [];
            if (!oFormData.areaKey) {
                aHierarchyErrors.push(this.getResourceBundle().getText("AreaLabel"));
            }
            if (!oFormData.divisionKey) {
                aHierarchyErrors.push(this.getResourceBundle().getText("DivisionLabel"));
            }
            if (!oFormData.familyKey) {
                aHierarchyErrors.push(this.getResourceBundle().getText("FamilyLabel"));
            }
            if (!oFormData.categoryKey) {
                aHierarchyErrors.push(this.getResourceBundle().getText("CategoryLabel"));
            }
            if (!oFormData.productGroupKey) {
                aHierarchyErrors.push(this.getResourceBundle().getText("ProductGroupLabel"));
            }

            if (aHierarchyErrors.length > 0) {
                MessageBox.warning(
                    this.getResourceBundle().getText("HierarchyValidationError") + ":\n" + aHierarchyErrors.join(", ")
                );
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

        _loadHierarchyOptions: async function() {
            const oFormModel = this.getView().getModel("formModel");
            const sCompetitorKey = oFormModel.getProperty("/competitorKey");
            const sAssortmentKey = oFormModel.getProperty("/assortmentKey");
            const sAreaKey = oFormModel.getProperty("/areaKey");
            const sDivisionKey = oFormModel.getProperty("/divisionKey");
            const sFamilyKey = oFormModel.getProperty("/familyKey");
            const sCategoryKey = oFormModel.getProperty("/categoryKey");

            const db = new PouchDB(LOCAL_DB_NAME);

            try {
                // Load Areas
                const areaResult = await db.find({
                    selector: {
                        entityName: "Areas",
                        Customer: sCompetitorKey,
                        Assortment: sAssortmentKey
                    }
                });
                oFormModel.setProperty("/areas", areaResult.docs);

                // Load Divisions filtered by Area if available
                const divisionSelector = {
                    entityName: "Divisions",
                    Customer: sCompetitorKey,
                    Assortment: sAssortmentKey
                };
                if (sAreaKey) {
                    divisionSelector.Area = sAreaKey;
                }
                const divisionResult = await db.find({ selector: divisionSelector });
                oFormModel.setProperty("/divisions", divisionResult.docs);

                // Load Families filtered by Division if available
                const familySelector = {
                    entityName: "Families",
                    Customer: sCompetitorKey,
                    Assortment: sAssortmentKey
                };
                if (sDivisionKey) {
                    familySelector.Division = sDivisionKey;
                }
                const familyResult = await db.find({ selector: familySelector });
                oFormModel.setProperty("/families", familyResult.docs);

                // Load Categories filtered by Family if available
                const categorySelector = {
                    entityName: "Categories",
                    Customer: sCompetitorKey,
                    Assortment: sAssortmentKey
                };
                if (sFamilyKey) {
                    categorySelector.Family = sFamilyKey;
                }
                const categoryResult = await db.find({ selector: categorySelector });
                oFormModel.setProperty("/categories", categoryResult.docs);

                // Load ProductGroups filtered by Category if available
                const productGroupSelector = {
                    entityName: "ProductGroups",
                    Customer: sCompetitorKey,
                    Assortment: sAssortmentKey
                };
                if (sCategoryKey) {
                    productGroupSelector.Category = sCategoryKey;
                }
                const productGroupResult = await db.find({ selector: productGroupSelector });
                oFormModel.setProperty("/productGroups", productGroupResult.docs);

            } catch (error) {
                console.error("Error loading hierarchy options:", error);
                MessageBox.error("Erro ao carregar opções de hierarquia: " + error.message);
            }
        },

        onAreaChange: async function(oEvent) {
            const sSelectedArea = oEvent.getParameter("selectedItem")?.getKey();
            const oFormModel = this.getView().getModel("formModel");
            const sCompetitorKey = oFormModel.getProperty("/competitorKey");
            const sAssortmentKey = oFormModel.getProperty("/assortmentKey");

            if (!sSelectedArea) {
                return;
            }

            // Clear all child selections
            oFormModel.setProperty("/divisionKey", "");
            oFormModel.setProperty("/familyKey", "");
            oFormModel.setProperty("/categoryKey", "");
            oFormModel.setProperty("/productGroupKey", "");

            // Reload Divisions filtered by new Area
            const db = new PouchDB(LOCAL_DB_NAME);
            try {
                const divisionResult = await db.find({
                    selector: {
                        entityName: "Divisions",
                        Customer: sCompetitorKey,
                        Assortment: sAssortmentKey,
                        Area: sSelectedArea
                    }
                });
                oFormModel.setProperty("/divisions", divisionResult.docs);
            } catch (error) {
                console.error("Error loading divisions:", error);
            }

            // Clear child level options
            oFormModel.setProperty("/families", []);
            oFormModel.setProperty("/categories", []);
            oFormModel.setProperty("/productGroups", []);
        },

        onDivisionChange: async function(oEvent) {
            const sSelectedDivision = oEvent.getParameter("selectedItem")?.getKey();
            const oFormModel = this.getView().getModel("formModel");
            const sCompetitorKey = oFormModel.getProperty("/competitorKey");
            const sAssortmentKey = oFormModel.getProperty("/assortmentKey");

            if (!sSelectedDivision) {
                return;
            }

            // Clear all child selections
            oFormModel.setProperty("/familyKey", "");
            oFormModel.setProperty("/categoryKey", "");
            oFormModel.setProperty("/productGroupKey", "");

            // Reload Families filtered by new Division
            const db = new PouchDB(LOCAL_DB_NAME);
            try {
                const familyResult = await db.find({
                    selector: {
                        entityName: "Families",
                        Customer: sCompetitorKey,
                        Assortment: sAssortmentKey,
                        Division: sSelectedDivision
                    }
                });
                oFormModel.setProperty("/families", familyResult.docs);
            } catch (error) {
                console.error("Error loading families:", error);
            }

            // Clear child level options
            oFormModel.setProperty("/categories", []);
            oFormModel.setProperty("/productGroups", []);
        },

        onFamilyChange: async function(oEvent) {
            const sSelectedFamily = oEvent.getParameter("selectedItem")?.getKey();
            const oFormModel = this.getView().getModel("formModel");
            const sCompetitorKey = oFormModel.getProperty("/competitorKey");
            const sAssortmentKey = oFormModel.getProperty("/assortmentKey");

            if (!sSelectedFamily) {
                return;
            }

            // Clear all child selections
            oFormModel.setProperty("/categoryKey", "");
            oFormModel.setProperty("/productGroupKey", "");

            // Reload Categories filtered by new Family
            const db = new PouchDB(LOCAL_DB_NAME);
            try {
                const categoryResult = await db.find({
                    selector: {
                        entityName: "Categories",
                        Customer: sCompetitorKey,
                        Assortment: sAssortmentKey,
                        Family: sSelectedFamily
                    }
                });
                oFormModel.setProperty("/categories", categoryResult.docs);
            } catch (error) {
                console.error("Error loading categories:", error);
            }

            // Clear child level options
            oFormModel.setProperty("/productGroups", []);
        },

        onCategoryChange: async function(oEvent) {
            const sSelectedCategory = oEvent.getParameter("selectedItem")?.getKey();
            const oFormModel = this.getView().getModel("formModel");
            const sCompetitorKey = oFormModel.getProperty("/competitorKey");
            const sAssortmentKey = oFormModel.getProperty("/assortmentKey");

            if (!sSelectedCategory) {
                return;
            }

            // Clear ProductGroup selection
            oFormModel.setProperty("/productGroupKey", "");

            // Reload ProductGroups filtered by new Category
            const db = new PouchDB(LOCAL_DB_NAME);
            try {
                const productGroupResult = await db.find({
                    selector: {
                        entityName: "ProductGroups",
                        Customer: sCompetitorKey,
                        Assortment: sAssortmentKey,
                        Category: sSelectedCategory
                    }
                });
                oFormModel.setProperty("/productGroups", productGroupResult.docs);
            } catch (error) {
                console.error("Error loading product groups:", error);
            }
        },

        _saveToPouch: async function (oFormData) {
            const db = new PouchDB(LOCAL_DB_NAME);

            // Get the original product to get _rev
            const oOriginalProduct = oFormData._originalProduct;

            if (!oOriginalProduct || !oOriginalProduct._rev) {
                throw new Error("Produto original não encontrado");
            }

            // Get original SyncKey for comparison
            const sOriginalSyncKey = oOriginalProduct.SyncKey || oOriginalProduct._id;

            // Preserve original Product field, or extract from SyncKey as fallback
            const sProductCode = oOriginalProduct.Product || (() => {
                const aParts = sOriginalSyncKey.split("_");
                return aParts[aParts.length - 1];
            })();

            // Build new SyncKey with updated hierarchy
            const sNewSyncKey = [
                "Products",
                oFormData.assortmentKey,
                oFormData.competitorKey,
                oFormData.areaKey,
                oFormData.divisionKey,
                oFormData.familyKey,
                oFormData.categoryKey,
                oFormData.productGroupKey,
                sProductCode
            ].join("_");

            // Check if hierarchy changed (SyncKey changed)
            const bHierarchyChanged = sOriginalSyncKey !== sNewSyncKey;

            // Get hierarchy text descriptions from selected items
            const oAreaItem = oFormData.areas.find(item => item.Area === oFormData.areaKey);
            const oDivisionItem = oFormData.divisions.find(item => item.Division === oFormData.divisionKey);
            const oFamilyItem = oFormData.families.find(item => item.Family === oFormData.familyKey);
            const oCategoryItem = oFormData.categories.find(item => item.Category === oFormData.categoryKey);
            const oProductGroupItem = oFormData.productGroups.find(item => item.ProductGroup === oFormData.productGroupKey);

            // Build updated product data
            const oUpdatedProduct = {
                ...oOriginalProduct,
                Product: sProductCode,
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
                // Hierarchy fields - keys
                Area: oFormData.areaKey,
                Division: oFormData.divisionKey,
                Family: oFormData.familyKey,
                Category: oFormData.categoryKey,
                ProductGroup: oFormData.productGroupKey,
                // Hierarchy fields - text descriptions
                AreaText: oAreaItem ? oAreaItem.AreaText : "",
                DivisionText: oDivisionItem ? oDivisionItem.DivisionText : "",
                FamilyText: oFamilyItem ? oFamilyItem.FamilyText : "",
                CategoryText: oCategoryItem ? oCategoryItem.CategoryText : "",
                ProductGroupText: oProductGroupItem ? oProductGroupItem.ProductGroupText : "",
                CollectedDate: new Date().toISOString(),
                IsCollected: true
            };

            let response;

            if (bHierarchyChanged) {
                // Hierarchy changed - need to create new document with new SyncKey and delete old one
                console.log("Hierarchy changed, recreating product with new SyncKey:", sNewSyncKey);

                // Create new product with new SyncKey
                const oNewProduct = {
                    ...oUpdatedProduct,
                    _id: sNewSyncKey,
                    SyncKey: sNewSyncKey,
                    Product: sProductCode
                };
                delete oNewProduct._rev; // Remove _rev for new document

                // Save new product
                response = await db.put(oNewProduct);

                // Delete old product
                await db.remove(oOriginalProduct);
                console.log("Old product deleted:", oOriginalProduct._id);
            } else {
                // Hierarchy unchanged - just update existing document
                console.log("Hierarchy unchanged, updating existing product");
                response = await db.put(oUpdatedProduct);
            }

            console.log("Product saved successfully:", response);
            return response;
        }
    });
});
