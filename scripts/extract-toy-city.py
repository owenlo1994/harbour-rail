"""Deterministic decorative city assets from the same local, MD5-verified OSM PBF.
Geometry anchors are source coordinates; dimensions/colours/heights are toy art,
not surveyed buildings or terrain. No network requests, no railway edits.
"""
from pathlib import Path
import collections, hashlib, json, math, re
import osmium
ROOT = Path(__file__).resolve().parents[1]
PBF = ROOT / 'data/raw/hong-kong-latest.osm.pbf'
if not PBF.is_file(): raise SystemExit('PBF_INPUT_MISSING: put the local PBF in data/raw; no download/fallback.')
sidecar = ROOT / 'data/raw' / (PBF.resolve().name + '.md5')
if not sidecar.is_file() or hashlib.file_digest(PBF.open('rb'), 'md5').hexdigest() != sidecar.read_text().split()[0]:
    raise SystemExit('PBF_MD5_MISMATCH_OR_MISSING: stopped.')
METRES_X, METRES_Y = 102900, 111320
buildings = {}
roads = []
hills = {}
greens = {}
landmarks = {}
stats = collections.Counter()
# Exact, recorded OSM name tokens; no guessed attraction coordinates.
MATCHES = [
 ('buddha', r'天壇大佛|^Tian Tan Buddha$'),
 ('clock', r'^前九廣鐵路鐘樓$|^尖沙咀鐘樓$|Former Kowloon.Canton Railway Clock Tower'),
 ('space', r'香港太空館|Hong Kong Space Museum'),
 ('icc', r'^環球貿易廣場$|^International Commerce Centre$'),
 ('ifc', r'^國際金融中心二期$|^Two International Finance Centre$|^IFC Two$'),
 ('bank', r'^中銀大廈$|^Bank of China Tower$'),
 ('convention', r'^香港會議展覽中心$|^Hong Kong Convention and Exhibition Centre$'),
 ('temple', r'^嗇色園黃大仙祠$|^黃大仙祠$|^Wong Tai Sin Temple$'),
 ('castle', r'^奇妙夢想城堡$|^Castle of Magical Dreams$'),
 ('wheel', r'^香港摩天輪$|^Hong Kong Observation Wheel$'),
 ('stadium', r'啟德主場館|Kai Tak Stadium'),
 ('ferry', r'^中環天星碼頭$|^Central Star Ferry Pier$'),
 ('tower', r'^尖沙咀文化中心$|^香港文化中心$|^Hong Kong Cultural Centre$'),
]
def inside(lon,lat): return 113.82 < lon < 114.45 and 22.17 < lat < 22.57
def point(nodes):
    points=[(n.lon,n.lat) for n in nodes if n.location.valid()]
    if len(points)<3: return None
    # Area centroid of the source footprint; computation is explicit metadata.
    ring=points if points[0]==points[-1] else points+[points[0]]
    ox,oy=ring[0]; local=[((x-ox)*METRES_X,(y-oy)*METRES_Y) for x,y in ring]
    twice_area=cx=cy=0
    for (x,y),(u,v) in zip(local,local[1:]):
        cross=x*v-u*y;twice_area+=cross;cx+=(x+u)*cross;cy+=(y+v)*cross
    if abs(twice_area)<2: return None
    lon,lat=ox+cx/(3*twice_area)/METRES_X,oy+cy/(3*twice_area)/METRES_Y
    if not inside(lon,lat): return None
    xs=[p[0] for p in local];ys=[p[1] for p in local]
    return lon,lat,max(xs)-min(xs),max(ys)-min(ys),abs(twice_area)/2

def attraction(id,t,coords):
    names=[t[k] for k in ['name','name:zh','name:zh-Hant','name:en'] if t.get(k)]
    if not names: return
    for kind,pattern in MATCHES:
        if any(re.search(pattern,name,re.I) for name in names):
            # Prefer the Kowloon Wong Tai Sin temple; same-named Lantau POI is a different source site.
            if kind=='temple' and not (114.18<coords[0]<114.21 and 22.33<coords[1]<22.36): continue
            # Prefer a named building footprint over a duplicate tourism point.
            rank=2 if t.get('building') else 1
            if rank>landmarks.get(kind,{}).get('rank',0):
                landmarks[kind]={'id':id,'kind':kind,'name':t.get('name:zh',t.get('name','')),'coordinates':coords,'rank':rank,'sourceTags':t}

class City(osmium.SimpleHandler):
    def node(self,n):
        if not len(n.tags): return
        if not n.location.valid() or not inside(n.location.lon,n.location.lat):return
        t=dict(n.tags);coords=[round(n.location.lon,7),round(n.location.lat,7)]
        attraction('node/'+str(n.id),t,coords)
        if t.get('natural')=='peak':
            cell=(round(n.location.lon/.016),round(n.location.lat/.016))
            hills.setdefault(cell,{'id':n.id,'coordinates':coords,'name':t.get('name:zh',t.get('name',''))})
    def way(self,w):
        t=dict(w.tags)
        if t.get('building') not in [None,'no'] or t.get('landuse') in ['forest','grass','recreation_ground'] or t.get('leisure')=='park' or t.get('natural')=='wood' or any(re.search(pattern,t.get('name',''),re.I) for _,pattern in MATCHES):
            p=point(w.nodes)
            if p:
                x,y,width,depth,area=p
                coords=[round(x,7),round(y,7)]
                attraction('way/'+str(w.id),t,coords)
                if t.get('building') not in [None,'no'] and area>=35:
                    stats['buildingFootprintsSeen']+=1
                    # One source building per 145 m cell gives dense, bounded GPU instancing.
                    cell=(math.floor(x*METRES_X/145),math.floor(y*METRES_Y/145))
                    if area > buildings.get(cell,{'area':0})['area']:
                        edge=next(((b.lon-a.lon)*METRES_X,(b.lat-a.lat)*METRES_Y) for a,b in zip(w.nodes,list(w.nodes)[1:]) if a.location.valid() and b.location.valid())
                        buildings[cell]={'area':area,'value':[w.id,*coords,round(min(95,max(35,width))),round(min(80,max(30,depth))),round(70+(w.id%7)*24),round(math.atan2(edge[1],edge[0]),3)]}
                elif area>1000:
                    cell=(math.floor(x*METRES_X/500),math.floor(y*METRES_Y/500))
                    greens.setdefault(cell,[w.id,*coords])
        highway=t.get('highway')
        if highway in ['motorway','trunk','primary','secondary','tertiary'] and t.get('area')!='yes':
            coords=[[round(n.lon,7),round(n.lat,7)] for n in w.nodes if n.location.valid()]
            if len(coords)>1 and any(inside(*p) for p in coords):
                # Simplify only source intermediate road vertices; never touches rail.
                kept=[coords[0]]
                for c in coords[1:-1]:
                    if math.hypot((c[0]-kept[-1][0])*METRES_X,(c[1]-kept[-1][1])*METRES_Y)>55:kept.append(c)
                kept.append(coords[-1])
                roads.append({'type':'Feature','geometry':{'type':'LineString','coordinates':kept},'properties':{'id':w.id,'class':highway,'bridge':t.get('bridge') not in [None,'no'],'tunnel':t.get('tunnel') not in [None,'no']}})
City().apply_file(str(PBF),locations=True)
r=osmium.io.Reader(str(PBF));header=r.header();timestamp=header.get('osmosis_replication_timestamp') or None;r.close()
meta={'source':'Geofabrik Hong Kong OSM PBF','sourceFile':PBF.resolve().name,'timestamp':timestamp,'sha256':hashlib.file_digest(PBF.open('rb'),'sha256').hexdigest(),'attribution':'© OpenStreetMap contributors','license':'ODbL-1.0','appearance':'decorative-not-survey','inferred':True,'anchorMethod':'Area centroid of actual source building ways; peaks and POIs retain source positions. Dimensions and heights are illustrative toy art, not measurements.'}
data={'metadata':meta,'buildings':[b['value'] for _,b in sorted(buildings.items())],'roads':{'type':'FeatureCollection','features':[r for r in roads if r['properties']['bridge'] and not r['properties']['tunnel'] and r['properties']['class'] in ['motorway','trunk','primary']]} ,'hills':list(hills.values()),'greens':list(greens.values()),'landmarks':[{k:v for k,v in l.items() if k!='rank'} for l in landmarks.values()]}
out=ROOT/'apps/web/public/data/toy-city.json';out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
report={**stats,'buildings':len(buildings),'roadWays':len(roads),'bridgeWays':len(data['roads']['features']),'hills':len(hills),'greens':len(greens),'landmarks':[{k:v for k,v in l.items() if k!='sourceTags'} for l in landmarks.values()],'metadata':meta}
(ROOT/'data/reports/toy-city.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k not in ['landmarks','metadata']},ensure_ascii=False))
print('Landmarks: '+', '.join(l['kind']+' '+l['name'] for l in landmarks.values()))
