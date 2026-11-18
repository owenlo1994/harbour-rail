import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
  page=await browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto('http://127.0.0.1:5173/',wait_until='domcontentloaded')
  await page.locator('[data-map-ready="true"]').wait_for(timeout=90000)
  await page.wait_for_timeout(6000)
  assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth')
  await page.screenshot(path=str(ROOT/'docs/screenshots/toy-desktop.png'),full_page=True)
  await page.get_by_role('button',name='隨機去探險').click();await page.locator('.train-card').wait_for()
  await page.wait_for_timeout(3500);await page.screenshot(path=str(ROOT/'docs/screenshots/toy-follow.png'),full_page=True)
  await page.get_by_role('button',name='3倍速度',exact=True).click();await page.get_by_role('button',name='暫停玩具列車').click()
  await expect(page.get_by_role('button',name='播放玩具列車')).to_be_visible()
  await page.get_by_role('button',name='播放玩具列車').click()
  await page.get_by_role('textbox',name='搜尋車站').fill('宋皇臺');await page.locator('.search-results button:visible').first.click()
  await page.get_by_role('button',name='收藏車站').click()
  async with page.expect_response(lambda r:'/api/board?' in r.url) as response:
   await page.get_by_role('button',name='睇吓下一班真車').click()
  result=await (await response.value).json();assert result['state'] in ['official','unavailable'];await page.screenshot(path=str(ROOT/'docs/screenshots/toy-official-board.png'),full_page=True)
  await page.get_by_role('button',name='我的收藏').click();await page.get_by_role('dialog').wait_for()
  await expect(page.locator('.saved-station')).to_contain_text('宋皇臺');await page.get_by_role('button',name='關閉視窗').click()
  await page.get_by_role('button',name='關閉車站資訊').click()
  await page.set_viewport_size({'width':390,'height':844});await page.get_by_role('button',name='玩具城市').click()
  await page.wait_for_timeout(3000);assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth')
  await page.screenshot(path=str(ROOT/'docs/screenshots/toy-mobile.png'),full_page=True)
  await page.get_by_role('button',name='揀路線').click();await page.locator('.line-tile').filter(has_text='荃灣綫').click()
  await page.get_by_role('button',name='跟住小火車出發').click();await page.locator('.train-card').wait_for()
  await page.get_by_role('button',name='結束跟車').click()
  await page.get_by_role('textbox',name='搜尋車站').fill('海洋公園');await page.locator('.search-results button:visible').first.click()
  await page.screenshot(path=str(ROOT/'docs/screenshots/toy-mobile-station.png'),full_page=True)
  await page.get_by_role('button',name='關閉車站資訊').click()
  await page.get_by_role('button',name='家長資訊').click();await page.get_by_role('dialog').wait_for()
  await expect(page.get_by_role('dialog')).to_contain_text('唔係 GPS');await page.get_by_role('button',name='關閉視窗').click()
  assert not errors,errors
  report={'desktop':[1440,1000],'mobile':[390,844],'pageErrors':errors,'officialBoardState':result['state'],'checks':['WebGL 3D toy layer','train following','speed and pause','station search','favorite','server-side official board','mobile route drawer','mobile station close unblocked','simulation disclosure','no horizontal overflow']}
  (ROOT/'data/reports/toy-qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False),flush=True)
  await browser.close()
asyncio.run(main())
