/**
 * Singleton service for managing PouchDB database operations
 * Provides centralized access to the local database with standardized query methods
 *
 * @namespace com.financor.sd.shoppingapp.services.DatabaseService
 */
sap.ui.define([
	"com/financor/sd/shoppingapp/utils/Constants"
], function (Constants) {
	"use strict";

	let instance = null;

	/**
	 * DatabaseService class - Singleton pattern
	 * @class
	 */
	class DatabaseService {
		constructor() {
			if (instance) {
				return instance;
			}

			this._db = new PouchDB(Constants.DATABASE.LOCAL_DB_NAME);
			this._initializeIndexes();

			instance = this;
		}

		/**
		 * Initializes database indexes for efficient querying
		 * @private
		 */
		_initializeIndexes() {
			// Create index for entity name queries
			this._db.createIndex({
				index: {
					fields: [Constants.FIELD_NAMES.ENTITY_NAME]
				}
			}).catch(err => {
				console.error("Error creating entityName index:", err);
			});

			// Create index for EAN lookups
			this._db.createIndex({
				index: {
					fields: [Constants.FIELD_NAMES.ENTITY_NAME, Constants.FIELD_NAMES.EAN]
				}
			}).catch(err => {
				console.error("Error creating EAN index:", err);
			});

			// Create index for collected prices
			this._db.createIndex({
				index: {
					fields: [Constants.FIELD_NAMES.ENTITY_NAME, Constants.FIELD_NAMES.IS_COLLECTED]
				}
			}).catch(err => {
				console.error("Error creating IsCollected index:", err);
			});
		}

		/**
		 * Gets the PouchDB database instance
		 * @returns {PouchDB} Database instance
		 */
		getDB() {
			return this._db;
		}

		/**
		 * Finds documents by entity name with optional filters
		 * @param {string} sEntityName - Entity type to search for
		 * @param {Array<{fieldName: string, value: any}>} aFilters - Array of filter objects
		 * @returns {Promise<Array>} Array of matching documents
		 */
		async findByEntityName(sEntityName, aFilters = []) {
			try {
				const selector = {
					[Constants.FIELD_NAMES.ENTITY_NAME]: sEntityName
				};

				// Add additional filters
				aFilters.forEach(filter => {
					selector[filter.fieldName] = filter.value;
				});

				const result = await this._db.find({
					selector: selector
				});

				return result.docs || [];
			} catch (error) {
				console.error(`Error finding ${sEntityName}:`, error);
				throw error;
			}
		}

		/**
		 * Finds a product by EAN code
		 * @param {string} sEAN - 13-digit EAN code
		 * @param {string} sCustomer - Customer/competitor key
		 * @param {string} sAssortment - Assortment key
		 * @returns {Promise<object|null>} Product document or null if not found
		 */
		async findByEAN(sEAN, sCustomer, sAssortment) {
			try {
				const result = await this._db.find({
					selector: {
						[Constants.FIELD_NAMES.ENTITY_NAME]: Constants.ENTITY_NAMES.PRODUCTS,
						[Constants.FIELD_NAMES.CUSTOMER]: sCustomer,
						[Constants.FIELD_NAMES.ASSORTMENT]: sAssortment,
						[Constants.FIELD_NAMES.EAN]: sEAN
					}
				});

				return result.docs && result.docs.length > 0 ? result.docs[0] : null;
			} catch (error) {
				console.error("Error finding product by EAN:", error);
				throw error;
			}
		}

		/**
		 * Finds a document by its SyncKey or _id
		 * @param {string} sSyncKey - SyncKey or document _id
		 * @returns {Promise<object|null>} Document or null if not found
		 */
		async findBySyncKey(sSyncKey) {
			try {
				const doc = await this._db.get(sSyncKey);
				return doc;
			} catch (error) {
				if (error.status === 404) {
					return null;
				}
				console.error("Error finding document by SyncKey:", error);
				throw error;
			}
		}

		/**
		 * Creates a new document with retry logic for conflict handling
		 * @param {object} oDocument - Document to create
		 * @param {number} iMaxRetries - Maximum number of retry attempts (default: 3)
		 * @returns {Promise<object>} Created document with _id and _rev
		 * @throws {Error} If creation fails after max retries
		 */
		async createDocument(oDocument, iMaxRetries = Constants.TIMING.MAX_RETRIES) {
			let attempts = 0;

			while (attempts < iMaxRetries) {
				try {
					const result = await this._db.put(oDocument);
					return {
						...oDocument,
						_id: result.id,
						_rev: result.rev
					};
				} catch (error) {
					if (error.status === 409) {
						// Conflict - document with this _id already exists
						attempts++;
						if (attempts >= iMaxRetries) {
							throw new Error(`Failed to create document after ${iMaxRetries} retries due to conflicts`);
						}

						// Regenerate document ID and retry
						const timestamp = Date.now();
						const random = Math.floor(Math.random() * Constants.PRODUCT_CODE.MAX_RANDOM);
						oDocument._id = `${oDocument._id}_${timestamp}_${random}`;

						// Also update SyncKey if it exists
						if (oDocument[Constants.FIELD_NAMES.SYNC_KEY]) {
							oDocument[Constants.FIELD_NAMES.SYNC_KEY] = oDocument._id;
						}
					} else {
						// Other error - don't retry
						throw error;
					}
				}
			}
		}

		/**
		 * Updates an existing document
		 * @param {string} sDocId - Document ID
		 * @param {object} oUpdates - Fields to update
		 * @returns {Promise<object>} Updated document
		 */
		async updateDocument(sDocId, oUpdates) {
			try {
				const doc = await this._db.get(sDocId);
				const updatedDoc = {
					...doc,
					...oUpdates
				};
				const result = await this._db.put(updatedDoc);
				return {
					...updatedDoc,
					_rev: result.rev
				};
			} catch (error) {
				console.error("Error updating document:", error);
				throw error;
			}
		}

		/**
		 * Deletes a document
		 * @param {string} sDocId - Document ID
		 * @returns {Promise<void>}
		 */
		async deleteDocument(sDocId) {
			try {
				const doc = await this._db.get(sDocId);
				await this._db.remove(doc);
			} catch (error) {
				console.error("Error deleting document:", error);
				throw error;
			}
		}

		/**
		 * Gets all documents of a specific entity type
		 * @param {string} sEntityName - Entity type
		 * @returns {Promise<Array>} Array of documents
		 */
		async getAllByEntityName(sEntityName) {
			return this.findByEntityName(sEntityName, []);
		}

		/**
		 * Queries the database with a custom selector
		 * @param {object} oSelector - PouchDB selector object
		 * @returns {Promise<Array>} Array of matching documents
		 */
		async query(oSelector) {
			try {
				const result = await this._db.find({
					selector: oSelector
				});
				return result.docs || [];
			} catch (error) {
				console.error("Error querying database:", error);
				throw error;
			}
		}

		/**
		 * Gets all documents (use with caution)
		 * @returns {Promise<Array>} Array of all documents
		 */
		async getAllDocuments() {
			try {
				const result = await this._db.allDocs({
					include_docs: true
				});
				return result.rows.map(row => row.doc);
			} catch (error) {
				console.error("Error getting all documents:", error);
				throw error;
			}
		}

		/**
		 * Bulk insert/update documents
		 * @param {Array<object>} aDocs - Array of documents to insert/update
		 * @returns {Promise<Array>} Array of results
		 */
		async bulkDocs(aDocs) {
			try {
				const result = await this._db.bulkDocs(aDocs);
				return result;
			} catch (error) {
				console.error("Error bulk inserting documents:", error);
				throw error;
			}
		}

		/**
		 * Destroys the current database and recreates it
		 * Used during full sync to clear all local data
		 * @returns {Promise<void>}
		 */
		async destroyAndRecreate() {
			try {
				await this._db.destroy();
				this._db = new PouchDB(Constants.DATABASE.LOCAL_DB_NAME);
				this._initializeIndexes();
			} catch (error) {
				console.error("Error destroying and recreating database:", error);
				throw error;
			}
		}

		/**
		 * Counts documents matching a selector
		 * @param {object} oSelector - PouchDB selector object
		 * @returns {Promise<number>} Count of matching documents
		 */
		async count(oSelector) {
			try {
				const result = await this._db.find({
					selector: oSelector,
					fields: ["_id"]
				});
				return result.docs ? result.docs.length : 0;
			} catch (error) {
				console.error("Error counting documents:", error);
				throw error;
			}
		}

		/**
		 * Checks if database is empty
		 * @returns {Promise<boolean>} True if database is empty
		 */
		async isEmpty() {
			try {
				const info = await this._db.info();
				return info.doc_count === 0;
			} catch (error) {
				console.error("Error checking if database is empty:", error);
				throw error;
			}
		}
	}

	// Return singleton instance
	return new DatabaseService();
});
