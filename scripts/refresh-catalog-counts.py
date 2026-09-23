"""Regenerate menu counts from unique product identities and explicit collection memberships."""
import json,re,collections,unicodedata
from pathlib import Path
slug=lambda s:re.sub(r'[^a-z0-9]+','-',unicodedata.normalize('NFD',s).encode('ascii','ignore').decode().lower()).strip('-')
items=json.loads(Path('lib/catalog-data.json').read_text());departments=json.loads(Path('lib/departments.json').read_text())
labels={d['slug']+'/'+slug(n):n for d in departments for g in d['groups'] for n in g['items']}
for p in items:labels[p['department']+'/'+slug(p['subcategory'])]=p['subcategory']
counts=collections.defaultdict(collections.Counter);dc=collections.Counter();routes=collections.Counter()
for p in items:
 rr=set([p['department']+'/'+slug(p['subcategory'])]+p.get('collections',[]));routes.update(rr);dc.update(set(r.split('/')[0] for r in rr))
 for r in rr:
  d,s=r.split('/');counts[d][labels.get(r,s.replace('-',' ').title())]+=1
for d in departments:
 d['groups']=[g for g in d['groups'] if g['name']!='More to explore']
 known={n for g in d['groups'] for n in g['items']};extras=sorted(n for n in counts[d['slug']] if n not in known)
 if extras:d['groups'].append({'name':'More to explore','items':extras})
empty=[d['slug']+'/'+slug(n) for d in departments for g in d['groups'] for n in g['items'] if not routes[d['slug']+'/'+slug(n)]]
summary={'products':len(items),'departments':len(departments),'collections':sum(len(g['items']) for d in departments for g in d['groups']),'departmentCounts':dc}
for path,value in [('lib/category-counts.json',counts),('lib/departments.json',departments),('lib/catalog-summary.json',summary),('docs/catalog-counts.json',summary)]:Path(path).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({**summary,'empty':empty},indent=2));assert not empty,empty
