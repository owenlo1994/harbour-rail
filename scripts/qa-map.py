"""Local visual/interaction QA. Installed Playwright + system Chromium, no PBF downloads."""
import asyncio
import json
import re
from pathlib import Path
from playwright.async_api import async_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
async def main():
    payload=json.loads((ROOT/'data/reports/development-map.json').read_text())
    assert payload['allMatchedKeys']==120
    assert payload['publication']=='development-only'
    assert all(f['properties']['line']!='TCL' and f['properties']['sourceWayId'] not in [1176509649,1558652644,1558652643] for f in payload['network']['features'])
    assert all(s['line']!='TCL' for s in payload['stations']['stations'])
    assert not (ROOT/'public/data/network.geojson').exists()
    assert not (ROOT/'public/data/stations.json').exists()
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
        page=await browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
        errors=[]; failed=[]; http_failures=[]
        page.on('pageerror',lambda e: errors.append(str(e)))
        # React StrictMode intentionally aborts its first development-only fetch.
        page.on('requestfailed',lambda r: failed.append({'url':r.url,'failure':r.failure}) if r.failure!='net::ERR_ABORTED' else None)
        page.on('response',lambda r: http_failures.append({'url':r.url,'status':r.status}) if r.status>=400 else None)
        await page.goto('http://127.0.0.1:5173/',wait_until='domcontentloaded')
        await page.locator('[data-map-ready="true"]').wait_for(timeout=90000)
        await page.wait_for_timeout(6500)
        assert await page.get_by_role('button',name='東涌綫').is_disabled()
        assert await page.locator('.station-card').get_by_text('TML:SUW',exact=True).count()==1
        assert await page.locator('.station-card').get_by_text('SWT',exact=True).count()==1
        assert not await page.evaluate('document.documentElement.scrollWidth > innerWidth')
        await page.screenshot(path=str(ROOT/'docs/screenshots/desktop-network.png'),full_page=True)
        await page.get_by_role('button',name='切換傾斜視角').click()
        await page.wait_for_timeout(850)
        await expect(page.get_by_test_id('camera')).to_have_text(re.compile(r'^55°'),timeout=20000)
        await page.get_by_role('button',name='旋轉地圖',exact=True).click()
        await page.wait_for_timeout(750)
        await expect(page.get_by_test_id('camera')).to_have_text(re.compile(r'30°$'),timeout=20000)
        await page.screenshot(path=str(ROOT/'docs/screenshots/desktop-tilted.png'),full_page=True)
        await page.get_by_role('button',name='重設地圖').click()
        await page.wait_for_timeout(800)
        await page.get_by_role('button',name='荃灣綫 Tsuen Wan Line TWL',exact=True).click()
        assert await page.get_by_role('button',name='荃灣綫 Tsuen Wan Line TWL',exact=True).get_attribute('aria-pressed')=='true'
        await page.get_by_role('button',name='全部').click()
        await page.get_by_role('button',name='EN',exact=True).click()
        assert await page.locator('html').get_attribute('lang')=='en'
        assert await page.locator('.station-card h2').inner_text()=='Sung Wong Toi'
        await page.get_by_role('button',name='繁中',exact=True).click()
        await page.set_viewport_size({'width':390,'height':844})
        await page.get_by_role('button',name='關閉車站資訊').click()
        await page.get_by_role('button',name='重設地圖').click()
        await page.wait_for_timeout(4500)
        assert not await page.evaluate('document.documentElement.scrollWidth > innerWidth')
        await page.screenshot(path=str(ROOT/'docs/screenshots/mobile-network.png'),full_page=True)
        await page.get_by_role('textbox',name='搜尋車站').fill('宋皇臺')
        await page.locator('.search-results button').filter(has_text='宋皇臺').first.click()
        await page.wait_for_timeout(3500)
        assert await page.locator('.station-card').get_by_text('TML:SUW',exact=True).count()==1
        await page.screenshot(path=str(ROOT/'docs/screenshots/mobile-station.png'),full_page=True)
        # Verify a real MapLibre point click: zoom centres the source point, close the overlay, click canvas centre.
        await page.get_by_role('button',name='關閉車站資訊').click()
        canvas=await page.locator('canvas.maplibregl-canvas').bounding_box()
        await page.mouse.click(canvas['x']+canvas['width']/2,canvas['y']+canvas['height']/2)
        await page.locator('.station-card').wait_for(timeout=5000)
        assert await page.locator('.station-card').get_by_text('TML:SUW',exact=True).count()==1
        await page.get_by_role('button',name='資料來源',exact=True).click()
        await page.get_by_role('dialog').wait_for()
        assert 'ODbL' in await page.get_by_role('dialog').inner_text()
        await page.get_by_role('button',name='關閉',exact=True).click()
        assert not errors,errors
        assert not failed,failed
        assert not http_failures,http_failures
        result={'date':'2026-11-17','browser':'system Chromium via Playwright; software WebGL','viewports':[{'width':1440,'height':1000},{'width':390,'height':844}],'checks':['120/120 keys in private audit','TCL and uncertain ways absent from dev payload','public outputs absent','no horizontal overflow','station official/OSM refs retained','line filter','rotation 30deg','pitch 55deg','Chinese/English switch','mobile search','real canvas station click','source attribution dialog'],'screenshots':['desktop-network.png','desktop-tilted.png','mobile-network.png','mobile-station.png'],'pageErrors':errors,'failedRequests':failed,'httpFailures':http_failures}
        (ROOT/'data/reports/browser-qa.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
        print(json.dumps(result,ensure_ascii=False),flush=True)
        await browser.close()
asyncio.run(main())
