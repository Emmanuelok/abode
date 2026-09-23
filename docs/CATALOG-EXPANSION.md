# Department and catalog expansion

5,357 unique named reference listings across 24 departments and 253 populated submenu collections. Original source IDs are retained. Exact duplicate titles across source locales have been consolidated. Products can appear in multiple relevant collections with one shared identity for bag, saved items, and comparison.

New departments: Window Treatments; Cleaning & Laundry; Cooling & Air Care; Home Fitness; Tools & DIY; Entryway & Hallway; Garden & Plant Care.

The dataset uses authentic licensed reference photography, not connected supplier stock. Main photos are local WebP files; ABO additions are up to 960px. A small set of specialist furniture and decorative references uses Wikimedia Commons photography with individual attribution and licences on each detail page and in /catalog/reference-image-credits.json. CC BY-SA resized images retain their source licence.

Bedroom Sets is an individually-priced collection of coordinating bedroom pieces, explained on the page. Kids Rugs is a design edit without safety certification claims. Museum wallpaper is explicitly a design reference. Prices are illustrative GHS planning estimates. Live inventory, payments and supplier dispatch remain unconnected.

UI: full department directory and search, room photography, product-based subcategory tiles, group filters, compact/spacious grid controls, pagination, quick views, cart interaction, responsive mobile filter drawer, subtle CSS route/product/menu transitions with prefers-reduced-motion support.

The server catalog is bundled as gzip/base64 text and decompressed once per Worker isolate. scripts/pack-catalog.mjs runs before both development and production builds; the integrity check verifies exact equality to the editable JSON source.
