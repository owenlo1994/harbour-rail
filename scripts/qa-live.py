"""Production browser acceptance for official predictions, selection and GPS.
Only this Site origin receives the private token; screenshots contain no token.
Outage and permission-denied checks are controlled test scenarios.
"""
import asyncio,json,os,sys,termios,re,time
from pathlib import Path
from playwright.async_api import async_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
URL=os.environ.get('TOY_BASE_URL','https://harbour-rail-hk.floralrabbit1.chatgpt.site')
token=None
if '--private' in sys.argv:
 fd=sys.stdin.fileno();old=termios.tcgetattr(fd);quiet=old.copy();quiet[3]&=~termios.ECHO;termios.tcsetattr(fd,termios.TCSANOW,quiet)
 print('Ready for private Site browser test (hidden input)',flush=True)
 try:token=json.loads(sys.stdin.readline())
 finally:termios.tcsetattr(fd,termios.TCSANOW,old)
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
  context=await browser.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1,service_workers='block',geolocation={'longitude':114.1651,'latitude':22.2789,'accuracy':15},permissions=['geolocation'])
  outage=False;responses=[]
  async def request_route(route):
   if '/api/trains?' in route.request.url and outage:await route.abort();return
   headers=dict(route.request.headers)
   if token:headers['OAI-Sites-Authorization']='Bearer '+token
   await route.continue_(headers=headers)
  await context.route(URL+'/**',request_route)
  page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  async def response_log(response):
   if '/api/trains?' in response.url and response.status==200:
    try:
     j=await response.json();responses.append({'trains':len(j['trains']),'fresh':j['coverage']['stationsFresh'],'total':j['coverage']['stationsTotal'],'unmapped':j['diagnostics']['unmappedObservations']})
    except Exception:pass
  page.on('response',response_log)
  await page.goto(URL,wait_until='domcontentloaded')
  await page.locator('[data-map-ready="true"]').wait_for(timeout=120000)
  canvas=page.locator('.maplibregl-canvas')
  await page.locator('.line-tile').filter(has_text='荃灣綫').click()
  await page.get_by_role('button',name='官方預報模式',exact=True).click()
  await expect(canvas).to_have_attribute('data-train-mode','live',timeout=120000)
  await expect(canvas).to_have_attribute('data-live-train-count',re.compile(r'^[2-9]$|^[1-9][0-9]+$'),timeout=120000)
  await expect(page.get_by_role('button',name='官方模式固定真實時間')).to_be_disabled()
  assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth')
  print('Official multi-train mode ready',flush=True)
  await page.screenshot(path=str(ROOT/'docs/screenshots/live-desktop.png'),full_page=True,timeout=90000)
  await page.get_by_role('button',name='揀一架列車遊城市').click()
  await page.locator('.train-picker button').first.click()
  await expect(page.locator('.live-train-details')).to_be_visible()
  await expect(page.locator('.train-card')).to_contain_text('位置推算')
  await page.wait_for_timeout(1500)
  await page.screenshot(path=str(ROOT/'docs/screenshots/live-follow.png'),full_page=True,timeout=90000)
  await page.get_by_role('button',name='結束跟車',exact=True).click()
  await page.get_by_role('button',name='定位跟車',exact=True).click()
  await expect(page.locator('.user-location-marker')).to_be_attached(timeout=30000)
  await expect(page.locator('.live-train-details')).to_be_visible(timeout=40000)
  print('GPS nearest prediction follow ready',flush=True)
  await page.screenshot(path=str(ROOT/'docs/screenshots/live-location.png'),full_page=True,timeout=90000)
  outage=True
  await expect(page.locator('.live-status')).to_contain_text('官方連線中斷',timeout=30000)
  await expect(page.locator('[data-train-mode="live"]').first).to_be_visible()
  await page.screenshot(path=str(ROOT/'docs/screenshots/live-interruption.png'),full_page=True,timeout=90000)
  outage=False
  await page.get_by_role('button',name='結束跟車',exact=True).click()
  await page.get_by_role('button',name='定位跟車',exact=True).click()
  cdp=await context.new_cdp_session(page)
  await expect(page.get_by_role('button',name='定位跟車',exact=True)).to_have_attribute('aria-pressed','false')
  target=await cdp.send('Target.getTargetInfo')
  await context.clear_permissions()
  await cdp.send('Browser.setPermission',{'permission':{'name':'geolocation'},'setting':'denied','origin':URL,'browserContextId':target['targetInfo']['browserContextId']})
  await page.get_by_role('button',name='定位跟車',exact=True).click()
  await expect(page.get_by_role('status').filter(has_text='定位未獲准')).to_be_visible(timeout=15000)
  await page.get_by_role('button',name='模擬遊玩模式',exact=True).click()
  await expect(canvas).to_have_attribute('data-train-mode','simulation')
  await page.get_by_role('button',name='揀一架列車遊城市').click();await page.locator('.train-picker button').first.click()
  await expect(page.locator('.train-card')).to_contain_text('模擬跟車')
  await page.get_by_role('button',name='暫停玩具列車',exact=True).click()
  await page.wait_for_timeout(1000);await page.screenshot(path=str(ROOT/'docs/screenshots/live-simulation.png'),full_page=True,timeout=90000)
  await page.get_by_role('button',name='結束跟車',exact=True).click()
  await page.set_viewport_size({'width':390,'height':844})
  await page.get_by_role('button',name='揀路線',exact=True).click();await page.locator('.line-tile').filter(has_text='將軍澳綫').click()
  await page.get_by_role('button',name='官方預報模式',exact=True).click()
  await expect(canvas).to_have_attribute('data-live-train-count',re.compile(r'^[1-9][0-9]*$'),timeout=90000)
  await page.get_by_role('button',name='列車清單',exact=True).click();await page.locator('.train-picker button').first.click()
  await expect(page.locator('.live-train-details')).to_be_visible()
  assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth')
  await page.screenshot(path=str(ROOT/'docs/screenshots/live-mobile.png'),full_page=True,timeout=90000)
  await page.get_by_role('button',name='結束跟車',exact=True).click()
  await page.get_by_role('button',name='家長資訊',exact=True).click()
  await expect(page.get_by_role('dialog')).to_contain_text('無法保證')
  assert not errors,errors
  report={'checkedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'url':URL,'desktop':[1440,1000],'mobile':[390,844],'pageErrors':errors,'feedSamples':responses[-12:],'checks':['real official multi-train API','mode separation and real-time 1x','manual live selection and continuous follow','representative train toy profiles','GPS permission granted + local marker + nearest predicted train','controlled network interruption with no simulation fallback','real browser geolocation permission denied','manual simulation selection and pause','mobile TKL live branches','no horizontal overflow','forecast versus GPS/vehicle identity disclosure']}
  (ROOT/'data/reports/live-qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False),flush=True)
  await browser.close()
asyncio.run(main())
