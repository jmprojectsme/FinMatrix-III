// =====================================================
// config.js — Global State, COA, Company Profile
// =====================================================
window.savedSales           = [];
window.savedPurchases       = [];
window.currentSaleIndex     = null;
window.currentPurchaseIndex = null;

// App info
window.APP_INFO = {
  name:      "FinMatrix",
  version:   "2.0.0",
  developer: "Jaymar Reperuga",
  updated:   "April 2026",
  description: "A free mobile-first accounting tool built for Philippine small businesses and freelancers."
};

// Company profile defaults (overwritten from DB on load)
window.companyProfile = {
  name:         "",
  address:      "",
  nature:       "VAT",      // "VAT" or "Non-VAT"
  tin:          "",
  rdo:          "",
  bir_reg_no:   "",
  contact:      ""
};

window.COA = {
  sales: {
    "Revenue": [
      "Sales Revenue","Service Revenue","Professional Fees",
      "Interest Income","Other Income"
    ]
  },
  purchases: {
    "Cost of Sales": [
      "Cost of Goods Sold","Freight-in"
    ],
    "Operating Expenses": [
      "Salaries & Wages","Rent Expense","Utilities Expense",
      "Office Supplies","Depreciation Expense","Repairs & Maintenance",
      "Advertising Expense","Insurance Expense"
    ],
    "Other Expenses": [
      "Meals & Entertainment","Transportation","Gas & Oil",
      "Miscellaneous Expense"
    ]
  },
  assets: {
    "Current Assets": [
      "Cash on Hand","Cash in Bank","Accounts Receivable",
      "Merchandise Inventory","Prepaid Expenses","Input VAT"
    ],
    "Non-Current Assets": [
      "Property, Plant & Equipment","Accumulated Depreciation",
      "Intangible Assets"
    ]
  },
  liabilities: {
    "Current Liabilities": [
      "Accounts Payable","Accrued Expenses","Output VAT Payable",
      "Income Tax Payable","Unearned Revenue"
    ],
    "Withholding Taxes Payable": [
      "EWT Payable - Professional (10%)",
      "EWT Payable - Rental (5%)",
      "EWT Payable - Supplier (2%)",
      "EWT Payable - Supplier (1%)",
      "Withholding Tax on Compensation"
    ],
    "Government Contributions Payable": [
      "SSS Payable","PhilHealth Payable","Pag-IBIG Payable"
    ],
    "Non-Current Liabilities": [
      "Notes Payable - Long Term","Mortgage Payable"
    ]
  },
  equity: {
    "Owner's Equity": [
      "Owner's Capital","Owner's Drawing",
      "Retained Earnings","Current Year Earnings"
    ]
  }
};
