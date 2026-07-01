const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Load the analysis page
    const filePath = path.join(__dirname, '.agents/artifacts/run_10_games.html');
    const fileUrl = `file://${filePath}`;
    
    console.log('Loading analysis page...');
    await page.goto(fileUrl, { waitUntil: 'networkidle2', timeout: 300000 });
    
    // Wait for analysis to complete
    console.log('Waiting for analysis to complete...');
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return text.includes('ANALYSIS COMPLETE');
    }, { timeout: 300000 });
    
    // Get the output
    const output = await page.evaluate(() => {
      return document.body.innerText;
    });
    
    console.log(output);
    
    // Save to file
    fs.writeFileSync('GAME_ANALYSIS_RESULTS.txt', output);
    console.log('\n✅ Results saved to GAME_ANALYSIS_RESULTS.txt');
    
    await browser.close();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
