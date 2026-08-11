const path = require("path");
const { chromium } = require("playwright");

const PLUS_URL = "https://ecop-os-app.plus.nl/ECOP_Mobile/";

async function clickVisibleText(page, text, timeout = 5000) {
  const locator = page.getByText(text, { exact: true });

  try {
    await locator.first().click({ timeout });
    return true;
  } catch {
    return false;
  }
}

async function extractPoints(page) {
  const plusPointsLabel = page.getByText("PLUSpunten", { exact: true }).last();
  const pointsSectionText = await plusPointsLabel.evaluate((label) => {
    let element = label;

    while (element && element !== document.body) {
      const text = element.innerText || "";
      if (/volle kaarten/i.test(text) && /punten\s+van/i.test(text)) {
        return text;
      }
      element = element.parentElement;
    }

    return document.body.innerText;
  });

  const lines = pointsSectionText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const normalizedText = pointsSectionText.replace(/\s+/g, " ").trim();
  const cardsMatch = normalizedText.match(/([\d.]+)\s+volle kaarten/i);
  const valueMatch = normalizedText.match(/t\.w\.v\.\s*€\s*([\d.,]+)/i);
  const pointsMatch = normalizedText.match(/([\d.]+)\s+punten\s+van\s+([\d.]+)/i);

  if (cardsMatch && pointsMatch) {
    const fullCards = Number(cardsMatch[1].replaceAll(".", ""));
    const loosePoints = Number(pointsMatch[1].replaceAll(".", ""));
    const pointsPerCard = Number(pointsMatch[2].replaceAll(".", ""));
    const totalPoints = fullCards * pointsPerCard + loosePoints;

    return {
      points: totalPoints.toLocaleString("nl-NL"),
      totalPoints,
      fullCards,
      loosePoints,
      pointsPerCard,
      redeemableValue: valueMatch?.[1] || null,
      sourceText: normalizedText
    };
  }

  const cardsLine = lines.find((line) => /\bvolle (?:spaar)?kaarten\b/i.test(line));
  const loosePointsLine = lines.find((line) => /\bpunten van\b/i.test(line));

  if (cardsLine && loosePointsLine) {
    const cardsMatch = cardsLine.match(/([\d.]+)\s+volle (?:spaar)?kaarten/i);
    const valueMatch = cardsLine.match(/t\.w\.v\.\s*€\s*([\d.,]+)/i);
    const pointsMatch = loosePointsLine.match(/([\d.]+)\s+punten van\s+([\d.]+)/i);

    if (cardsMatch && pointsMatch) {
      const fullCards = Number(cardsMatch[1].replaceAll(".", ""));
      const loosePoints = Number(pointsMatch[1].replaceAll(".", ""));
      const pointsPerCard = Number(pointsMatch[2].replaceAll(".", ""));
      const totalPoints = fullCards * pointsPerCard + loosePoints;

      return {
        points: totalPoints.toLocaleString("nl-NL"),
        totalPoints,
        fullCards,
        loosePoints,
        pointsPerCard,
        redeemableValue: valueMatch?.[1] || null,
        sourceText: `${cardsLine}; ${loosePointsLine}`
      };
    }
  }

  const patterns = [
    /(?:plus[ -]?)?punten\s*:?[\s€]*([\d.,]+)/i,
    /([\d.,]+)\s*(?:plus[ -]?)?punten/i,
    /(?:spaar|punten)[^\d]{0,30}([\d.,]+)/i
  ];

  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        return { points: match[1], sourceText: line };
      }
    }
  }

  const relevantLines = lines
    .filter((line) => /punt|spaar|saldo|zegel/i.test(line))
    .slice(0, 20);

  const error = new Error(
    "Inloggen is gelukt, maar het puntensaldo is nog niet herkend. " +
      "De relevante paginaregels staan in error.details."
  );
  error.code = "POINTS_NOT_FOUND";
  error.details = relevantLines;
  throw error;
}

async function navigateToPlusPoints(page, settings = {}) {
  const timeout = settings.timeout || 60000;

  // Deze route komt overeen met Meer > Sparen met de app.
  await page.goto(`${PLUS_URL}SavingsOverview`, {
    waitUntil: "domcontentloaded",
    timeout
  });

  const plusPointsCard = page.getByText("PLUSpunten", { exact: true }).first();
  await plusPointsCard.waitFor({ state: "visible", timeout });
  await plusPointsCard.click();
  await page.waitForURL(/\/SavingsDetails/i, { timeout });
  await page.getByText(/Bijgewerkt op/i).waitFor({
    state: "visible",
    timeout
  });
}

async function openLoggedInPage(settings = {}) {
  if (!settings.username || !settings.password) {
    throw new Error("Vul username en password in settings.json in.");
  }

  const browser = await chromium.launch({
    headless: settings.headless !== false,
    slowMo: settings.slowMo || 0
  });

  try {
    const context = await browser.newContext({
      locale: "nl-NL",
      viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();

    await page.goto(PLUS_URL, {
      waitUntil: "domcontentloaded",
      timeout: settings.timeout || 60000
    });

    // De OutSystems-app stuurt na het splashscreen door naar onboarding.
    await page.waitForURL(/\/(OnboardingStart|Login|Home|Dashboard)/i, {
      timeout: settings.timeout || 60000
    }).catch(() => {});

    await clickVisibleText(page, "Weigeren", 10000);

    if (!/\/Login/i.test(page.url())) {
      await clickVisibleText(page, "Inloggen", 10000);
    }

    await page.locator("#Input_EmailFirst").waitFor({
      state: "visible",
      timeout: settings.timeout || 60000
    });
    await page.locator("#Input_EmailFirst").fill(settings.username);
    await page.locator("#Input_Password").fill(settings.password);
    await page.getByText("Inloggen", { exact: true }).last().click();

    const invalidLogin = page.getByText(
      /De combinatie van jouw e-mailadres en wachtwoord is onjuist/i
    );

    await Promise.race([
      page.waitForURL((url) => !/\/Login/i.test(url.pathname), {
        timeout: settings.timeout || 60000
      }),
      invalidLogin.waitFor({ state: "visible", timeout: settings.timeout || 60000 })
    ]).catch(() => {});

    if (await invalidLogin.isVisible().catch(() => false)) {
      const error = new Error("PLUS heeft de gebruikersnaam of het wachtwoord afgekeurd.");
      error.code = "INVALID_CREDENTIALS";
      throw error;
    }

    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    return { browser, context, page };
  } catch (error) {
    await browser.close();
    throw error;
  }
}

async function scrapePoints(settings = {}) {
  const { browser, page } = await openLoggedInPage(settings);

  try {
    await navigateToPlusPoints(page, settings);

    if (settings.debug) {
      const screenshotPath = path.resolve(__dirname, "plus-debug.png");
      await page.screenshot({ path: screenshotPath, fullPage: true });
    }

    const result = await extractPoints(page);
    return {
      ...result,
      fetchedAt: new Date().toISOString(),
      pageUrl: page.url()
    };
  } finally {
    await browser.close();
  }
}

module.exports = {
  scrapePoints,
  extractPoints,
  openLoggedInPage,
  navigateToPlusPoints
};
