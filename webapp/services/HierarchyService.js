/**
 * Service for managing hierarchy-related operations
 * Handles hierarchy text fetching, validation, and cascading dropdown logic
 *
 * @namespace com.financor.sd.shoppingapp.services.HierarchyService
 */
sap.ui.define([
	"com/financor/sd/shoppingapp/utils/Constants",
	"com/financor/sd/shoppingapp/services/DatabaseService"
], function (Constants, DatabaseService) {
	"use strict";

	return {
		/**
		 * Fetches text description for a single hierarchy level
		 * @param {string} sEntityName - Entity type (Areas, Divisions, Families, Categories, ProductGroups)
		 * @param {string} sKey - Hierarchy key value
		 * @param {string} sKeyField - Field name for the key (e.g., "Area", "Division")
		 * @param {string} sTextField - Field name containing text description (e.g., "AreaDesc", "DivisionDesc")
		 * @returns {Promise<string>} Text description or empty string if not found
		 */
		fetchHierarchyText: async function (sEntityName, sKey, sKeyField, sTextField) {
			// Return empty string for unknown or missing values
			if (!sKey || sKey.startsWith("UNKNOWN_")) {
				return "";
			}

			try {
				const aDocs = await DatabaseService.findByEntityName(sEntityName, [
					{ fieldName: sKeyField, value: sKey }
				]);

				return aDocs.length > 0 ? aDocs[0][sTextField] : "";
			} catch (error) {
				console.error(`Error fetching hierarchy text for ${sEntityName}:`, error);
				return "";
			}
		},

		/**
		 * Fetches all hierarchy text descriptions for a given context
		 * @param {object} oContext - Context object with hierarchy keys (areaKey, divisionKey, etc.)
		 * @returns {Promise<object>} Object containing all hierarchy text fields
		 */
		fetchAllHierarchyTexts: async function (oContext) {
			const [sAreaText, sDivisionText, sFamilyText, sCategoryText, sGroupText] = await Promise.all([
				this.fetchHierarchyText(
					Constants.ENTITY_NAMES.AREAS,
					oContext.areaKey,
					Constants.FIELD_NAMES.AREA,
					Constants.TEXT_FIELDS.AREA_DESC
				),
				this.fetchHierarchyText(
					Constants.ENTITY_NAMES.DIVISIONS,
					oContext.divisionKey,
					Constants.FIELD_NAMES.DIVISION,
					Constants.TEXT_FIELDS.DIVISION_DESC
				),
				this.fetchHierarchyText(
					Constants.ENTITY_NAMES.FAMILIES,
					oContext.familyKey,
					Constants.FIELD_NAMES.FAMILY,
					Constants.TEXT_FIELDS.FAMILY_DESC
				),
				this.fetchHierarchyText(
					Constants.ENTITY_NAMES.CATEGORIES,
					oContext.categoryKey,
					Constants.FIELD_NAMES.CATEGORY,
					Constants.TEXT_FIELDS.CATEGORY_DESC
				),
				this.fetchHierarchyText(
					Constants.ENTITY_NAMES.PRODUCT_GROUPS,
					oContext.productGroupKey,
					Constants.FIELD_NAMES.PRODUCT_GROUP,
					Constants.TEXT_FIELDS.PRODUCT_GROUP_DESC
				)
			]);

			return {
				AreaText: sAreaText,
				DivisionText: sDivisionText,
				FamilyText: sFamilyText,
				CategoryText: sCategoryText,
				ProductGroupText: sGroupText
			};
		},

		/**
		 * Loads hierarchy options for a specific level with parent filters
		 * @param {string} sLevel - Hierarchy level (Area, Division, Family, Category, ProductGroup)
		 * @param {Array<{fieldName: string, value: any}>} aParentFilters - Parent level filters
		 * @returns {Promise<Array>} Array of option objects
		 */
		loadHierarchyOptions: async function (sLevel, aParentFilters = []) {
			const levelConfig = Constants.HIERARCHY_LEVELS[sLevel.toUpperCase()];

			if (!levelConfig) {
				console.error(`Invalid hierarchy level: ${sLevel}`);
				return [];
			}

			try {
				const aDocs = await DatabaseService.findByEntityName(levelConfig.entityName, aParentFilters);
				return aDocs;
			} catch (error) {
				console.error(`Error loading ${sLevel} options:`, error);
				return [];
			}
		},

		/**
		 * Loads all hierarchy options for cascading dropdowns
		 * @param {object} oContext - Current context with selected parent values
		 * @returns {Promise<object>} Object containing arrays for each hierarchy level
		 */
		loadAllHierarchyOptions: async function (oContext) {
			try {
				// Load Areas (no filter needed)
				const aAreas = await this.loadHierarchyOptions("Area");

				// Load Divisions (filtered by Area)
				const aDivisions = oContext.areaKey
					? await this.loadHierarchyOptions("Division", [
							{ fieldName: Constants.FIELD_NAMES.AREA, value: oContext.areaKey }
					  ])
					: [];

				// Load Families (filtered by Division)
				const aFamilies = oContext.divisionKey
					? await this.loadHierarchyOptions("Family", [
							{ fieldName: Constants.FIELD_NAMES.DIVISION, value: oContext.divisionKey }
					  ])
					: [];

				// Load Categories (filtered by Family)
				const aCategories = oContext.familyKey
					? await this.loadHierarchyOptions("Category", [
							{ fieldName: Constants.FIELD_NAMES.FAMILY, value: oContext.familyKey }
					  ])
					: [];

				// Load ProductGroups (filtered by Category)
				const aProductGroups = oContext.categoryKey
					? await this.loadHierarchyOptions("ProductGroup", [
							{ fieldName: Constants.FIELD_NAMES.CATEGORY, value: oContext.categoryKey }
					  ])
					: [];

				return {
					areas: aAreas,
					divisions: aDivisions,
					families: aFamilies,
					categories: aCategories,
					productGroups: aProductGroups
				};
			} catch (error) {
				console.error("Error loading all hierarchy options:", error);
				throw error;
			}
		},

		/**
		 * Checks which hierarchy levels are missing from context
		 * @param {object} oContext - Context object to validate
		 * @returns {object} Object with missing flags and overall status
		 */
		checkMissingHierarchy: function (oContext) {
			const bNeedsArea = !oContext.areaKey;
			const bNeedsDivision = !oContext.divisionKey;
			const bNeedsFamily = !oContext.familyKey;
			const bNeedsCategory = !oContext.categoryKey;
			const bNeedsProductGroup = !oContext.productGroupKey;

			return {
				needsArea: bNeedsArea,
				needsDivision: bNeedsDivision,
				needsFamily: bNeedsFamily,
				needsCategory: bNeedsCategory,
				needsProductGroup: bNeedsProductGroup,
				hasMissingValues: bNeedsArea || bNeedsDivision || bNeedsFamily || bNeedsCategory || bNeedsProductGroup
			};
		},

		/**
		 * Builds hierarchy context with UNKNOWN defaults for missing values
		 * @param {object} oContext - Original context
		 * @param {boolean} bUseHierarchyContext - Whether to use context values or force UNKNOWN
		 * @returns {object} Complete hierarchy context
		 */
		buildHierarchyContext: function (oContext, bUseHierarchyContext = true) {
			if (!bUseHierarchyContext || !oContext) {
				return {
					areaKey: Constants.UNKNOWN_VALUES.AREA,
					divisionKey: Constants.UNKNOWN_VALUES.DIVISION,
					familyKey: Constants.UNKNOWN_VALUES.FAMILY,
					categoryKey: Constants.UNKNOWN_VALUES.CATEGORY,
					productGroupKey: Constants.UNKNOWN_VALUES.GROUP
				};
			}

			return {
				areaKey: oContext.areaKey || Constants.UNKNOWN_VALUES.AREA,
				divisionKey: oContext.divisionKey || Constants.UNKNOWN_VALUES.DIVISION,
				familyKey: oContext.familyKey || Constants.UNKNOWN_VALUES.FAMILY,
				categoryKey: oContext.categoryKey || Constants.UNKNOWN_VALUES.CATEGORY,
				productGroupKey: oContext.productGroupKey || Constants.UNKNOWN_VALUES.GROUP
			};
		},

		/**
		 * Handles cascading change for hierarchy dropdowns
		 * Clears child selections when parent changes
		 * @param {object} oDialog - Dialog containing the hierarchy form
		 * @param {string} sChangedLevel - Level that changed (Area, Division, Family, Category)
		 * @param {string} sSelectedKey - Newly selected key value
		 * @returns {Promise<void>}
		 */
		handleCascadingChange: async function (oDialog, sChangedLevel, sSelectedKey) {
			// Define child controls to clear based on changed level
			const childControls = {
				Area: ["divisionComboBox", "familyComboBox", "categoryComboBox", "productGroupComboBox"],
				Division: ["familyComboBox", "categoryComboBox", "productGroupComboBox"],
				Family: ["categoryComboBox", "productGroupComboBox"],
				Category: ["productGroupComboBox"]
			};

			// Clear child selections
			const aChildIds = childControls[sChangedLevel] || [];
			aChildIds.forEach(sControlId => {
				const oControl = sap.ui.getCore().byId(sControlId);
				if (oControl) {
					oControl.setSelectedKey("");
					oControl.removeAllItems();
				}
			});

			// Build current context from dialog form
			const oAreaCombo = sap.ui.getCore().byId("areaComboBox");
			const oDivisionCombo = sap.ui.getCore().byId("divisionComboBox");
			const oFamilyCombo = sap.ui.getCore().byId("familyComboBox");
			const oCategoryCombo = sap.ui.getCore().byId("categoryComboBox");

			const oContext = {
				areaKey: oAreaCombo ? oAreaCombo.getSelectedKey() : "",
				divisionKey: oDivisionCombo ? oDivisionCombo.getSelectedKey() : "",
				familyKey: oFamilyCombo ? oFamilyCombo.getSelectedKey() : "",
				categoryKey: oCategoryCombo ? oCategoryCombo.getSelectedKey() : ""
			};

			// Reload options for next level
			try {
				if (sChangedLevel === "Area" && oContext.areaKey) {
					const aDivisions = await this.loadHierarchyOptions("Division", [
						{ fieldName: Constants.FIELD_NAMES.AREA, value: oContext.areaKey }
					]);
					this._populateComboBox("divisionComboBox", aDivisions, Constants.FIELD_NAMES.DIVISION, Constants.TEXT_FIELDS.DIVISION_DESC);
				} else if (sChangedLevel === "Division" && oContext.divisionKey) {
					const aFamilies = await this.loadHierarchyOptions("Family", [
						{ fieldName: Constants.FIELD_NAMES.DIVISION, value: oContext.divisionKey }
					]);
					this._populateComboBox("familyComboBox", aFamilies, Constants.FIELD_NAMES.FAMILY, Constants.TEXT_FIELDS.FAMILY_DESC);
				} else if (sChangedLevel === "Family" && oContext.familyKey) {
					const aCategories = await this.loadHierarchyOptions("Category", [
						{ fieldName: Constants.FIELD_NAMES.FAMILY, value: oContext.familyKey }
					]);
					this._populateComboBox("categoryComboBox", aCategories, Constants.FIELD_NAMES.CATEGORY, Constants.TEXT_FIELDS.CATEGORY_DESC);
				} else if (sChangedLevel === "Category" && oContext.categoryKey) {
					const aProductGroups = await this.loadHierarchyOptions("ProductGroup", [
						{ fieldName: Constants.FIELD_NAMES.CATEGORY, value: oContext.categoryKey }
					]);
					this._populateComboBox("productGroupComboBox", aProductGroups, Constants.FIELD_NAMES.PRODUCT_GROUP, Constants.TEXT_FIELDS.PRODUCT_GROUP_DESC);
				}
			} catch (error) {
				console.error(`Error handling cascading change for ${sChangedLevel}:`, error);
			}
		},

		/**
		 * Helper to populate a ComboBox with items
		 * @private
		 * @param {string} sComboBoxId - ComboBox control ID
		 * @param {Array} aItems - Array of data objects
		 * @param {string} sKeyField - Field name for item key
		 * @param {string} sTextField - Field name for item text
		 */
		_populateComboBox: function (sComboBoxId, aItems, sKeyField, sTextField) {
			const oComboBox = sap.ui.getCore().byId(sComboBoxId);
			if (!oComboBox) {
				return;
			}

			oComboBox.removeAllItems();

			aItems.forEach(oItem => {
				oComboBox.addItem(
					new sap.ui.core.Item({
						key: oItem[sKeyField],
						text: oItem[sTextField]
					})
				);
			});
		}
	};
});
