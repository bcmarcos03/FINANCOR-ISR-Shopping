/**
 * Application-wide constants and configuration values
 * Centralized location for all magic numbers, strings, and configuration
 *
 * @namespace com.financor.sd.shoppingapp.utils.Constants
 */
sap.ui.define([], function () {
	"use strict";

	return {
		/**
		 * Database Configuration
		 */
		DATABASE: {
			LOCAL_DB_NAME: "financorDB"
		},

		/**
		 * Entity Names used in PouchDB
		 */
		ENTITY_NAMES: {
			PRODUCTS: "Products",
			AREAS: "Areas",
			DIVISIONS: "Divisions",
			FAMILIES: "Families",
			CATEGORIES: "Categories",
			PRODUCT_GROUPS: "ProductGroups",
			COMPETITOR_SHOP_LIST: "CompetitorShopList",
			SHOPPING_LIST: "ShoppingList",
			USER_CARD: "UserCard",
			COLLECTED_PRICES: "CollectedPrices"
		},

		/**
		 * Database field names used in selectors
		 */
		FIELD_NAMES: {
			ENTITY_NAME: "entityName",
			CUSTOMER: "Customer",
			ASSORTMENT: "Assortment",
			EAN: "EAN",
			SYNC_KEY: "SyncKey",
			IS_COLLECTED: "IsCollected",
			AREA: "Area",
			DIVISION: "Division",
			FAMILY: "Family",
			CATEGORY: "Category",
			PRODUCT_GROUP: "ProductGroup"
		},

		/**
		 * Text description field names for hierarchy levels
		 */
		TEXT_FIELDS: {
			AREA_DESC: "AreaDesc",
			DIVISION_DESC: "DivisionDesc",
			FAMILY_DESC: "FamilyDesc",
			CATEGORY_DESC: "CategoryDesc",
			PRODUCT_GROUP_DESC: "ProductGroupDesc"
		},

		/**
		 * Unknown/default values for hierarchy when not selected
		 */
		UNKNOWN_VALUES: {
			AREA: "UNKNOWN_AREA",
			DIVISION: "UNKNOWN_DIVISION",
			FAMILY: "UNKNOWN_FAMILY",
			CATEGORY: "UNKNOWN_CATEGORY",
			GROUP: "UNKNOWN_GROUP"
		},

		/**
		 * Validation constants
		 */
		VALIDATION: {
			EAN_LENGTH: 13,
			EAN_REGEX: /^\d{13}$/
		},

		/**
		 * Timing constants (in milliseconds)
		 */
		TIMING: {
			NAVIGATION_DELAY: 300,
			POUCHDB_SYNC_DELAY: 50,
			RECENT_CREATION_THRESHOLD: 10000,
			MAX_RETRIES: 3,
			ODATA_TIMEOUT: 30000  // 30 seconds for OData requests
		},

		/**
		 * Product code generation constants
		 */
		PRODUCT_CODE: {
			MAX_RANDOM: 100000,
			PREFIX: "PRD"
		},

		/**
		 * Camera/barcode scanner configuration
		 */
		CAMERA: {
			IDEAL_WIDTH: 1280,
			IDEAL_HEIGHT: 720
		},

		/**
		 * HTTP status code ranges
		 */
		HTTP_STATUS: {
			SUCCESS_MIN: 200,
			SUCCESS_MAX: 300
		},

		/**
		 * Default values
		 */
		DEFAULTS: {
			LIQUID_UNIT: "L",
			CREATOR: "User",
			LANGUAGE: "pt-PT"
		},

		/**
		 * Route names used in navigation
		 */
		ROUTES: {
			MAIN: "main",
			COMPETITORS: "competitors",
			SHOPPING: "shopping",
			PRODUCT_SEARCH: "ProductSearch",
			AREA_LIST: "AreaList",
			DIVISION_LIST: "DivisionList",
			FAMILY_LIST: "FamilyList",
			CATEGORY_LIST: "CategoryList",
			PRODUCT_GROUP_LIST: "ProductGroupList",
			PRODUCT_LIST: "ProductList",
			PRODUCT_PRICE_ENTRY: "ProductPriceEntryForm",
			COLLECTED_PRICES: "CollectedPrices"
		},

		/**
		 * Hierarchy levels configuration
		 */
		HIERARCHY_LEVELS: {
			AREA: {
				name: "Area",
				key: "areaKey",
				textField: "AreaDesc",
				entityName: "Areas",
				parentLevel: null
			},
			DIVISION: {
				name: "Division",
				key: "divisionKey",
				textField: "DivisionDesc",
				entityName: "Divisions",
				parentLevel: "Area"
			},
			FAMILY: {
				name: "Family",
				key: "familyKey",
				textField: "FamilyDesc",
				entityName: "Families",
				parentLevel: "Division"
			},
			CATEGORY: {
				name: "Category",
				key: "categoryKey",
				textField: "CategoryDesc",
				entityName: "Categories",
				parentLevel: "Family"
			},
			PRODUCT_GROUP: {
				name: "ProductGroup",
				key: "productGroupKey",
				textField: "ProductGroupDesc",
				entityName: "ProductGroups",
				parentLevel: "Category"
			}
		}
	};
});
