"""Existing project Chromium runner, against the deployed Site.
Private-site bypass remains in memory and is added ONLY to that Site origin.
"""
import asyncio,json,os,sys,termios,time
from pathlib import Path
from urllib.parse import urlsplit
from playwright.async_api import async_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
URL=os.environ.get('TOY_BASE_URL','https://harbour-rail-hk.floralrabbit1.chatgpt.site')
token=None
if '--private' in sys.argv:
 fd=sys.stdin.fileno();old=termios.tcgetattr(fd);quiet=old.copy();quiet[3]&=~termios.ECHO;termios.tcsetattr(fd,termios.TCSANOW,quiet)
 print('Ready for private Site browser check (hidden input)',flush=True)
 try: token=json.loads(sys.stdin.readline())
 finally: termios.tcsetattr(fd,termios.TCSANOW,old)
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
  context=await browser.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1,service_workers='block')
  if token:
   async def authorize(route):
    headers=dict(route.request.headers);headers['OAI-Sites-Authorization']='Bearer '+token
    await route.continue_(headers=headers)
   await context.route(URL+'/**',authorize)
  page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto(URL,wait_until='domcontentloaded')
  await page.locator('[data-map-ready="true"]').wait_for(timeout=120000)
  await page.wait_for_timeout(5000)
  canvas=page.locator('.maplibregl-canvas')
  buildings=int(await canvas.get_attribute('data-city-buildings'));assert buildings>1000
  landmarks=int(await canvas.get_attribute('data-city-landmarks'));assert landmarks>=10
  await expect(canvas).to_have_attribute('data-city-rails','double-rail-sleepers')
  assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth')
  await page.get_by_role('button',name='暫停玩具列車').click()
  await page.screenshot(path=str(ROOT/'docs/screenshots/city-desktop.png'),full_page=True)
  await page.locator('.line-tile').filter(has_text='東涌綫').click()
  await page.wait_for_timeout(2000)
  await page.get_by_role('button',name='跟住小火車出發').click();await page.locator('.train-card').wait_for(timeout=15000)
  await expect(page.locator('.train-card')).to_contain_text('東涌綫')
  await page.wait_for_timeout(2000)
  await page.screenshot(path=str(ROOT/'docs/screenshots/city-tcl.png'),full_page=True)
  await page.get_by_role('button',name='結束跟車').click()
  await page.get_by_role('textbox',name='搜尋車站').fill('東涌東');await page.locator('.search-results button:visible').first.click()
  await expect(page.locator('.future-card')).to_contain_text('未開通');await expect(page.get_by_role('button',name='睇吓下一班真車')).to_have_count(0)
  await page.wait_for_timeout(2000);await page.screenshot(path=str(ROOT/'docs/screenshots/city-unopened.png'),full_page=True)
  await page.get_by_role('button',name='關閉未開通車站資訊').click()
  await page.get_by_role('textbox',name='搜尋車站').fill('東涌西');await page.locator('.search-results button:visible').first.click()
  await expect(page.locator('.future-card')).to_contain_text('東涌西');await page.get_by_role('button',name='關閉未開通車站資訊').click()
  await page.get_by_role('textbox',name='搜尋車站').fill('宋皇臺');await page.locator('.search-results button:visible').first.click()
  async with page.expect_response(lambda r:'/api/board?' in r.url,timeout=20000) as response:
   await page.get_by_role('button',name='睇吓下一班真車').click()
  board=await(await response.value).json();assert board['state'] in ['official','unavailable']
  await page.get_by_role('button',name='關閉車站資訊').click()
  await page.set_viewport_size({'width':390,'height':844});await page.get_by_role('button',name='玩具城市',exact=True).click()
  await page.wait_for_timeout(4000);assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth')
  await page.screenshot(path=str(ROOT/'docs/screenshots/city-mobile.png'),full_page=True)
  await page.get_by_role('button',name='揀路線',exact=True).click();await page.locator('.line-tile').filter(has_text='東涌綫').click()
  await page.get_by_role('textbox',name='搜尋車站').fill('東涌東');await page.locator('.search-results button:visible').first.click()
  await page.wait_for_timeout(2000);await page.screenshot(path=str(ROOT/'docs/screenshots/city-mobile-unopened.png'),full_page=True)
  await page.get_by_role('button',name='關閉未開通車站資訊').click()
  await page.get_by_role('button',name='家長資訊').click();await expect(page.get_by_role('dialog')).to_contain_text('唔係 GPS')
  assert not errors,errors
  report={'url':URL,'desktop':[1440,1000],'mobile':[390,844],'sourceBuildings':buildings,'sourceLandmarkSculptures':landmarks,'pageErrors':errors,'officialBoardState':board['state'],'checks':['purpose-built cartoon geography style','instanced 3D toy city','double steel rails and sleepers','TCL train follow','East/West unopened search and cards','no API board for unopened stations','mobile route drawer','no horizontal overflow','independent official board','simulation/artistic-height disclosure']}
  (ROOT/'data/reports/city-qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False),flush=True)
  await browser.close()
asyncio.run(main())
