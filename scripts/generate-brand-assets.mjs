// Original vector artwork; rasterise it into share cards and platform-sized icons.
// Uses the sharp dependency already provided by Next.js. Run: node scripts/generate-brand-assets.mjs
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const sharp = require(require.resolve('sharp', { paths: [dirname(require.resolve('next/package.json'))] }));
const root = resolve(import.meta.dirname, '..');
await Promise.all(['public/icons', 'public/social'].map(path => mkdir(resolve(root, path), { recursive: true })));

const monogram = `<path d="M166 361V237c0-124 194-124 194 0v124h-55V237c0-54-85-54-85 0v124z" fill="#fff7ea"/><circle cx="397" cy="361" r="29" fill="#de6b3e"/>`;
const icon = maskable => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" ${maskable ? '' : 'rx="112"'} fill="#173f35"/><g transform="translate(${maskable ? -9 : -19} ${maskable ? 25 : 5}) scale(${maskable ? '.92' : '1'})">${monogram}</g></svg>`;
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs><pattern id="weave" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M0 10L10 0" stroke="#ddc9a7" stroke-opacity=".20"/></pattern></defs>
<rect width="1200" height="630" fill="#f7f1e5"/>
<rect x="0" y="0" width="1200" height="630" fill="url(#weave)"/>
<path d="M817 630V210a145 145 0 0 1 290 0v420" fill="#173f35"/>
<path d="M852 630V228a109 109 0 0 1 218 0v402" fill="#50705a"/>
<path d="M898 630V284a75 75 0 0 1 150 0v346" fill="#d9c8a6"/>
<path d="M985 630V387a96 96 0 0 1 192 0v243" fill="#b95e3e"/>
<path d="M1050 630V417a73 73 0 0 1 146 0v213" fill="#df9968"/>
<circle cx="765" cy="118" r="24" fill="#c96b46"/>
<path d="M743 560h455" stroke="#173f35" stroke-width="1" stroke-opacity=".2"/>
<text x="78" y="113" font-family="Arial,Helvetica,sans-serif" font-size="15" font-weight="600" letter-spacing="4" fill="#738066">THOUGHTFULLY CHOSEN. BEAUTIFULLY YOURS.</text>
<text x="70" y="280" font-family="Georgia,Times New Roman,serif" font-size="166" font-weight="700" letter-spacing="-12" fill="#173f35">abode<tspan fill="#c96b46">.</tspan></text>
<text x="82" y="357" font-family="Arial,Helvetica,sans-serif" font-size="16" letter-spacing="5" fill="#6f775f">GHANA</text>
<text x="77" y="442" font-family="Georgia,Times New Roman,serif" font-size="43" letter-spacing="-1" fill="#173f35">A home, beautifully yours.</text>
<text x="81" y="490" font-family="Arial,Helvetica,sans-serif" font-size="20" fill="#6b745f">Furniture, home &amp; a little inspiration.</text>
<path d="M82 546h602" stroke="#bcc2ac" stroke-width="1"/>
<text x="82" y="585" font-family="Arial,Helvetica,sans-serif" font-size="13" letter-spacing="2" fill="#6b745f">DISCOVER YOUR NEXT CHAPTER AT ABODE GHANA</text>
</svg>`;

await writeFile(resolve(root, 'public/social/abode-og.svg'), og);
await writeFile(resolve(root, 'public/icons/abode-mark.svg'), icon(false));
await sharp(Buffer.from(og)).png().toFile(resolve(root, 'public/social/abode-og.png'));
for (const size of [192, 512]) {
  await sharp(Buffer.from(icon(false))).resize(size, size).png().toFile(resolve(root, `public/icons/icon-${size}.png`));
  await sharp(Buffer.from(icon(true))).resize(size, size).png().toFile(resolve(root, `public/icons/maskable-${size}.png`));
}
await sharp(Buffer.from(icon(true))).resize(180, 180).png().toFile(resolve(root, 'public/icons/apple-touch-icon.png'));
console.log('Created OG image (1200×630), app icons (192/512), maskable icons (192/512), and Apple icon (180).');
