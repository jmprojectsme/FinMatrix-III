# FinMatrix Tests

These tests run automatically on GitHub every time you push, so you don't need a laptop.

## What is tested

| File | What it checks |
|---|---|
| `engine.test.js` | Accounting engine and validation rules: journal entries for cash/bank/credit sales and purchases, VAT and rounding, debit = credit, Trial Balance, Income Statement and Balance Sheet totals for a standard dataset |
| `helpers/app.js` | Shared helper that opens the app in a simulated browser (used by the `ui-*` tests) |
| `ui-sales.test.js` | The real Sales form in a simulated browser: Cash/Bank/Credit sales post to the right account, payment method survives reopen and reload, posted sales are locked, and sales saved by older versions are not changed |
| `ui-validation.test.js` | Input validation on the real Sales and Purchases forms: negative amounts and more than 2 decimals rejected on Save; Post blocked for missing date/account, zero amounts, or no lines; old records untouched |
| `ui-xss.test.js` | Security: text typed by users (names, references, accounts, company name) is shown as plain text on every screen and can never run as code; Chart of Accounts group names with quotes work |
| `ui-dates.test.js` | One date per document: the Date field at the top is saved and locked when posted, and every report (Journal, Trial Balance, Income Statement, Balance Sheet, Sales/Purchases by Account, lists) puts a document in the same period; older documents use their first line's date and are not changed |
| `pwa.test.js` | App packaging: manifest is valid, icons exist, every file the service worker caches exists, every script in `index.html` exists |

Before the tests, GitHub also checks that every `.js` file has valid syntax.

## Reading the results (from your phone)

1. Open the repository in the GitHub app or browser.
2. Look at the latest commit: ✅ = all tests passed, ❌ = something broke, 🟡 = still running.
3. Tap the icon → **Details** to see which test failed and why.

## TODO tests (known bugs)

Some tests are marked `{ todo: "..." }`. They describe bugs found in the technical audit.
They still run and are listed as **TODO**, but they do not turn the check red.

When you fix one of those bugs:

1. Remove the `{ todo: "..." }` part from that test.
2. Push. The test must now pass — from then on it protects your fix.

## Running locally (optional)

With Node.js 20 or newer (on Android you can use Termux):

```
npm install
npm test
```

`npm install` downloads the test tools (jsdom, fake-indexeddb) into `node_modules/`.
They are used only by the tests — the app itself does not use them.

## Rule

Nothing is merged into `main` unless the check is ✅.
