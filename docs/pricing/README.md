# Australian base-price migration — local review build

All 5,357 catalogue items now receive an explicit AUD pricing status. 180 have conservative category/material/function matches to documented Australian retailer comparables; 5,177 are quote-required with null prices, not zero/free. Original GHS source catalogue JSON/packed data is unchanged. Runtime overlay is `lib/pricing-au.ts`.

## Method and limits

The displayed indicative AUD price is the arithmetic midpoint of the documented comparable range (a single source price remains unchanged). It is NOT an identical-SKU price, supplier quote, guaranteed stock, discount, tax-inclusive offer or confirmed sale price. Matching is by category, material and function; dimensions, brand, construction and exact configuration remain different and require supplier verification. We do not invent a size multiplier. Sets, replacements, covers-only and premium stone finishes are excluded. Insufficient matches are quote-required.

Sources were checked 7 November 2026: Temple & Webster Australia and IKEA Australia. Source links and observed reference ranges are accessible on product pages. Source price differences may reflect retailer sale periods, variant size and construction. Abode displays no comparison-price strike-through or sale claim. GST treatment was not verified; delivery and final GST-inclusive price require a supplier quote. No payment gateway or supplier inventory is configured.

## Currency and records

AUD is the original pricing denomination. The FX endpoint and committed fallback use AUD base, with update timestamps and stale-source disclosure. International displays are estimates. New quote payloads record AUD, pricing version, nullable line prices and incompletePricing; priced-items subtotals exclude unmatched items with visible warnings. The server does not trust submitted prices.

Historical request records are not rewritten. Account/admin pages format old records as GHS when no currency is present. New room plans use AUD; legacy budgets remain GHS in storage and are converted for display only. Explicit budgetCurrency survives validation. New service budgets and registry exports identify AUD. Unpriced items are excluded from automatic budget suggestions and explicit price filters.

## Verification

`verify-au-pricing.mjs` checks coverage, null handling, original catalogue nonmutation, source ranges, exclusion cases, AUD FX, and produces `coverage.json`/per-product CSV. TypeScript passes. Compiled-worker testing verifies AUD/mixed-basket server totals; auth, admin, intake and PWA checks are run separately. Visual QA and final deployment status are reported in the handoff, not assumed here.

This remains a local review build. The earlier GHS-conversion approach is superseded. Do not deploy without the required explicit live-publish approval.
