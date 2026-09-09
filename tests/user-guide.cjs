const {chromium}=require('../.qa/node_modules/playwright');
const assert=require('node:assert/strict');

(async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>route.request().url().startsWith('http://localhost:8081')?route.continue():route.abort());
  await page.goto('http://localhost:8081/index.html?preview=1');
  await page.waitForTimeout(300);
  await page.evaluate(()=>{const guide=document.querySelector('#featureGuideDialog');if(guide?.open)guide.close()});
  await page.locator('[data-more-menu]').click();
  await page.locator('#settingsButton').click();
  const guide=page.locator('#settingsDialog a.settings-row[href^="sapporo-trip-user-manual.pdf"]');
  await assert.doesNotReject(()=>guide.waitFor({state:'visible'}));
  assert.match(await guide.textContent(),/사용자 안내.*장소 불러오기부터 일정·예약·경비 입력까지/s);
  const response=await page.request.get('http://localhost:8081/sapporo-trip-user-manual.pdf?v=10');
  assert.equal(response.ok(),true);assert.match(response.headers()['content-type'],/application\/pdf/);
  assert.deepEqual(errors,[]);
  await browser.close();console.log('PASS mobile settings user guide and PDF response');
})().catch(error=>{console.error(error);process.exit(1)});
