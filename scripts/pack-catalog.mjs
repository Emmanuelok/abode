import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
const source=readFileSync(new URL('../lib/catalog-data.json',import.meta.url));
// Keep the source catalogue readable while avoiding a multi-megabyte JavaScript literal.
const packed=gzipSync(source,{level:9}).toString('base64')+'\n';
const output=new URL('../lib/catalog-packed.txt',import.meta.url);
if(!existsSync(output)||readFileSync(output,'utf8')!==packed)writeFileSync(output,packed);
