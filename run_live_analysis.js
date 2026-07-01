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

    // Set viewport
    await page.setViewport({ width: 1280, height: 720 });

    // Navigate to the live analysis page
    const filePath = path.join(__dirname, '.agents/artifacts/LIVE_GAME_ANALYSIS.html');
    const fileUrl = `file://${filePath}`;

    console.log('🎮 Loading live game analysis page...');
    await page.goto(fileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    console.log('⏳ Waiting for analysis to complete (this may take 5-10 minutes)...');

    // Wait for completion - look for "Analysis Complete!" text
    await page.waitForFunction(() => {
      const status = document.getElementById('status');
      return status && status.textContent.includes('Analysis Complete');
    }, { timeout: 900000 }); // 15 minutes timeout

    console.log('✅ Analysis completed! Extracting results...');

    // Get all the output
    const results = await page.evaluate(() => {
      return {
        games: document.querySelectorAll('.game-box'),
        status: document.getElementById('status').textContent,
        resultsContent: document.getElementById('results-content').innerHTML
      };
    });

    console.log('\n' + '═'.repeat(100));
    console.log(results.resultsContent);
    console.log('═'.repeat(100));

    // Get full page text
    const fullText = await page.evaluate(() => document.body.innerText);

    // Save detailed report
    fs.writeFileSync('GAME_ANALYSIS_LIVE_RESULTS.txt', fullText);
    console.log('\n📄 Full report saved to: GAME_ANALYSIS_LIVE_RESULTS.txt');

    await browser.close();
    process.exit(0);

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
