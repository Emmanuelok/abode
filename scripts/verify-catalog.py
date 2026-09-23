import json,hashlib,collections,sqlite3
from pathlib import Path
from PIL import Image
items=json.loads(Path('lib/catalog-data.json').read_text());assert len(items)==3133
for key in ['id','name','originalId','image']:
 values=[p[key] for p in items];assert len(set(values))==len(items),(key,'duplicates')
image_hashes=set()
for p in items:
 path=Path('public'+p['image']);assert path.is_file(),path
 image_hashes.add(hashlib.sha256(path.read_bytes()).hexdigest())
 with Image.open(path) as im:im.verify()
 assert p['price']>0 and p['department'] and p['subcategory']
assert len(image_hashes)==len(items)
counts=json.loads(Path('lib/category-counts.json').read_text());assert sum(sum(v.values()) for v in counts.values())==len(items)
db=sqlite3.connect(':memory:');schema=Path('drizzle/0000_confused_madame_web.sql').read_text().replace('--> statement-breakpoint','');db.executescript(schema)
q="INSERT INTO shopper_state (user_id,state,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET state = json_set(shopper_state.state, ?, json(?)), updated_at = excluded.updated_at"
for user,key,value in [('guest:test-a','wishlist',[items[0]['id']]),('guest:test-b','wishlist',[]),('guest:test-a','cart',[{'id':items[1]['id'],'quantity':2}])]:
 db.execute(q,(user,json.dumps({key:value}),'2026-09-23','$.'+key,json.dumps(value)))
a=json.loads(db.execute('SELECT state FROM shopper_state WHERE user_id=?',('guest:test-a',)).fetchone()[0]);b=json.loads(db.execute('SELECT state FROM shopper_state WHERE user_id=?',('guest:test-b',)).fetchone()[0]);assert a['wishlist']==[items[0]['id']] and a['cart'][0]['quantity']==2 and b['wishlist']==[]
result={'products':len(items),'unique_main_images':len(image_hashes),'departments':len(counts),'populated_subcategories':sum(len(x) for x in counts.values()),'local_images':'all decode successfully','state_merge_and_user_isolation':'passed','source_metadata':'reference collection; no live inventory'}
Path('docs/catalog-verification.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
