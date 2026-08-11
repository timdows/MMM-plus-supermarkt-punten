const path = require("path");

// PWDEBUG activeert Playwright Inspector. Dit moet vóór het laden van
// Playwright gebeuren.
process.env.PWDEBUG = "1";

const settings = require("./settings.json");
const { openLoggedInPage } = require("./plus-scraper");

async function recordNavigation() {
  let browser;

  try {
    const session = await openLoggedInPage({
      ...settings,
      headless: false,
      slowMo: settings.slowMo || 250
    });
    browser = session.browser;
    const { context, page } = session;
    const tracePath = path.resolve(__dirname, "plus-navigation.zip");

    await context.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: true
    });

    console.log("");
    console.log("Inloggen is gelukt. Klik nu in het browservenster naar je punten.");
    console.log("Gebruik daarna de knop Resume (driehoek) in Playwright Inspector.");
    console.log("Sluit het browservenster niet zelf; dan kan de trace worden opgeslagen.");
    console.log("");

    await page.pause();
    await context.tracing.stop({ path: tracePath });

    console.log(`Navigatie opgeslagen in: ${tracePath}`);
    console.log("Geef nu aan dat je klaar bent; dan kan deze trace worden uitgelezen.");
  } finally {
    if (browser) await browser.close();
  }
}

recordNavigation().catch((error) => {
  console.error(`Opnemen mislukt: ${error.message}`);
  process.exitCode = 1;
});
