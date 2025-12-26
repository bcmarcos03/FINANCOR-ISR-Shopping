/**
 * Centralized formatting utility functions
 * Provides consistent formatting for dates, prices, numbers, and SAP-specific formats
 *
 * @namespace com.financor.sd.shoppingapp.utils.Formatters
 */
sap.ui.define([
	"sap/ui/core/format/DateFormat"
], function (DateFormat) {
	"use strict";

	return {
		/**
		 * Formats a date/time with a custom pattern
		 * @param {Date|string} vDate - Date to format
		 * @param {string} sPattern - Format pattern (default: "dd/MM/yyyy HH:mm:ss")
		 * @returns {string} Formatted date string or empty string if invalid
		 */
		formatDateTime: function (vDate, sPattern = "dd/MM/yyyy HH:mm:ss") {
			if (!vDate) {
				return "";
			}

			const oDate = vDate instanceof Date ? vDate : new Date(vDate);

			if (isNaN(oDate.getTime())) {
				return "";
			}

			const oDateFormat = DateFormat.getDateTimeInstance({
				pattern: sPattern
			});

			return oDateFormat.format(oDate);
		},

		/**
		 * Formats a collected date for display
		 * @param {Date|string} vDate - Date to format
		 * @returns {string} Formatted date in Portuguese format (dd/MM/yyyy HH:mm)
		 */
		formatCollectedDate: function (vDate) {
			if (!vDate) {
				return "";
			}

			const oDate = vDate instanceof Date ? vDate : new Date(vDate);

			if (isNaN(oDate.getTime())) {
				return "";
			}

			const sDay = String(oDate.getDate()).padStart(2, "0");
			const sMonth = String(oDate.getMonth() + 1).padStart(2, "0");
			const sYear = oDate.getFullYear();
			const sHours = String(oDate.getHours()).padStart(2, "0");
			const sMinutes = String(oDate.getMinutes()).padStart(2, "0");

			return `${sDay}/${sMonth}/${sYear} ${sHours}:${sMinutes}`;
		},

		/**
		 * Formats a price with currency symbol
		 * @param {number|string} vPrice - Price value
		 * @param {string} sCurrency - Currency code (default: "EUR")
		 * @returns {string} Formatted price string (e.g., "1.99 EUR")
		 */
		formatPrice: function (vPrice, sCurrency = "EUR") {
			if (vPrice === null || vPrice === undefined || vPrice === "") {
				return "";
			}

			const fPrice = typeof vPrice === "string" ? parseFloat(vPrice) : vPrice;

			if (isNaN(fPrice)) {
				return "";
			}

			return `${fPrice.toFixed(2)} ${sCurrency}`;
		},

		/**
		 * Formats a promotional price with currency symbol
		 * Handles null/empty values gracefully
		 * @param {number|string} vPrice - Promotional price value
		 * @param {string} sCurrency - Currency code (default: "EUR")
		 * @returns {string} Formatted promotional price or "-" if not set
		 */
		formatPromoPrice: function (vPrice, sCurrency = "EUR") {
			if (vPrice === null || vPrice === undefined || vPrice === "") {
				return "-";
			}

			const fPrice = typeof vPrice === "string" ? parseFloat(vPrice) : vPrice;

			if (isNaN(fPrice)) {
				return "-";
			}

			return `${fPrice.toFixed(2)} ${sCurrency}`;
		},

		/**
		 * Formats a customer number to SAP format (10 digits, zero-padded)
		 * @param {string|number} vCustomerNumber - Customer number
		 * @returns {string} Formatted customer number (e.g., "0000012345")
		 */
		formatCustomerNumber: function (vCustomerNumber) {
			if (!vCustomerNumber) {
				return "";
			}

			const sNumber = String(vCustomerNumber);
			return sNumber.padStart(10, "0");
		},

		/**
		 * Formats a material number to SAP format (18 digits, zero-padded)
		 * @param {string|number} vMaterialNumber - Material number
		 * @returns {string} Formatted material number (e.g., "000000000000123456")
		 */
		formatMaterialNumber: function (vMaterialNumber) {
			if (!vMaterialNumber) {
				return "";
			}

			const sNumber = String(vMaterialNumber);
			return sNumber.padStart(18, "0");
		},

		/**
		 * Converts a JavaScript Date to SAP OData date format
		 * @param {Date|string} vDate - Date to convert
		 * @returns {string} SAP date string in format "yyyy-MM-dd" or empty string if invalid
		 */
		toSapDate: function (vDate) {
			if (!vDate) {
				return "";
			}

			const oDate = vDate instanceof Date ? vDate : new Date(vDate);

			if (isNaN(oDate.getTime())) {
				return "";
			}

			const sYear = oDate.getFullYear();
			const sMonth = String(oDate.getMonth() + 1).padStart(2, "0");
			const sDay = String(oDate.getDate()).padStart(2, "0");

			return `${sYear}-${sMonth}-${sDay}`;
		},

		/**
		 * Converts a JavaScript Date to SAP OData time format (Edm.Time)
		 * @param {Date|string} vDate - Date/time to convert
		 * @returns {string} SAP time string in format "PT##H##M##S" (e.g., "PT14H30M00S")
		 */
		toSapTime: function (vDate) {
			if (!vDate) {
				return "PT00H00M00S";
			}

			const oDate = vDate instanceof Date ? vDate : new Date(vDate);

			if (isNaN(oDate.getTime())) {
				return "PT00H00M00S";
			}

			const iHours = oDate.getHours();
			const iMinutes = oDate.getMinutes();
			const iSeconds = oDate.getSeconds();

			const sHours = String(iHours).padStart(2, "0");
			const sMinutes = String(iMinutes).padStart(2, "0");
			const sSeconds = String(iSeconds).padStart(2, "0");

			return `PT${sHours}H${sMinutes}M${sSeconds}S`;
		},

		/**
		 * Formats a SAP time string (Edm.Time) to readable format
		 * @param {string} sSapTime - SAP time string (e.g., "PT14H30M00S")
		 * @returns {string} Formatted time (e.g., "14:30:00")
		 */
		formatSapTime: function (sSapTime) {
			if (!sSapTime || typeof sSapTime !== "string") {
				return "";
			}

			// Parse PT14H30M00S format
			const oMatch = sSapTime.match(/PT(\d+)H(\d+)M(\d+)S/);

			if (!oMatch) {
				return "";
			}

			const sHours = oMatch[1].padStart(2, "0");
			const sMinutes = oMatch[2].padStart(2, "0");
			const sSeconds = oMatch[3].padStart(2, "0");

			return `${sHours}:${sMinutes}:${sSeconds}`;
		},

		/**
		 * Formats a number with decimal places
		 * @param {number|string} vNumber - Number to format
		 * @param {number} iDecimals - Number of decimal places (default: 2)
		 * @returns {string} Formatted number string
		 */
		formatNumber: function (vNumber, iDecimals = 2) {
			if (vNumber === null || vNumber === undefined || vNumber === "") {
				return "";
			}

			const fNumber = typeof vNumber === "string" ? parseFloat(vNumber) : vNumber;

			if (isNaN(fNumber)) {
				return "";
			}

			return fNumber.toFixed(iDecimals);
		},

		/**
		 * Formats a liquid content with unit
		 * @param {number|string} vContent - Content value
		 * @param {string} sUnit - Unit (L, ml, Kg, etc.)
		 * @returns {string} Formatted content string (e.g., "1.5 L")
		 */
		formatLiquidContent: function (vContent, sUnit) {
			if (!vContent || !sUnit) {
				return "";
			}

			const fContent = typeof vContent === "string" ? parseFloat(vContent) : vContent;

			if (isNaN(fContent)) {
				return "";
			}

			return `${fContent} ${sUnit}`;
		},

		/**
		 * Formats a boolean value to Yes/No text
		 * @param {boolean} bValue - Boolean value
		 * @param {string} sYesText - Text for true (default: "Sim")
		 * @param {string} sNoText - Text for false (default: "Não")
		 * @returns {string} Yes/No text
		 */
		formatBoolean: function (bValue, sYesText = "Sim", sNoText = "Não") {
			return bValue ? sYesText : sNoText;
		},

		/**
		 * Truncates a string to a maximum length with ellipsis
		 * @param {string} sText - Text to truncate
		 * @param {number} iMaxLength - Maximum length (default: 50)
		 * @returns {string} Truncated text with "..." if needed
		 */
		truncate: function (sText, iMaxLength = 50) {
			if (!sText || typeof sText !== "string") {
				return "";
			}

			if (sText.length <= iMaxLength) {
				return sText;
			}

			return sText.substring(0, iMaxLength - 3) + "...";
		}
	};
});
