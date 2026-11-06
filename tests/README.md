# FinMatrix Tests

These tests run automatically on GitHub every time you push, so you don't need a laptop.

## What is tested

| File | What it checks |
|---|---|
| `engine.test.js` | Accounting engine: journal entries for cash/bank/credit sales and purchases, VAT and rounding, debit = credit, Trial Balance, Income Statement and Balance Sheet totals for a standard dataset |
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
npm test
```

## Rule

Nothing is merged into `main` unless the check is ✅.
