const fs = require("fs/promises");
const path = require("path");
const { scrapePoints } = require("./plus-scraper");

const requestsInProgress = new Map();

function historyPath(settings = {}) {
  return path.resolve(__dirname, settings.historyFile || "plus-points-history.json");
}

function dateKey(date = new Date(), timeZone = "Europe/Amsterdam") {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type).value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

async function readHistory(settings = {}) {
  const file = historyPath(settings);

  try {
    const parsed = JSON.parse(await fs.readFile(file, "utf8"));
    return {
      version: 1,
      updatedAt: parsed.updatedAt || null,
      lastAttemptDate: parsed.lastAttemptDate || null,
      lastAttemptAt: parsed.lastAttemptAt || null,
      lastError: parsed.lastError || null,
      records: Array.isArray(parsed.records) ? parsed.records : []
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        version: 1,
        updatedAt: null,
        lastAttemptDate: null,
        lastAttemptAt: null,
        lastError: null,
        records: []
      };
    }
    throw new Error(`Kan puntenhistorie niet lezen: ${error.message}`);
  }
}

async function writeHistory(settings, history) {
  const file = historyPath(settings);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(history, null, 2)}\n`, "utf8");
}

function cachedResult(record, extra = {}) {
  return {
    ...record,
    fromCache: true,
    ...extra
  };
}

async function updateDailyRecord(settings = {}, force = false) {
  const history = await readHistory(settings);
  const today = dateKey(new Date(), settings.timeZone);
  const todayRecord = history.records.find((record) => record.date === today);

  if (todayRecord && !force) {
    return cachedResult(todayRecord);
  }

  const latest = history.records.at(-1);
  if (!force && history.lastAttemptDate === today) {
    if (latest) {
      return cachedResult(latest, {
        stale: true,
        refreshError: history.lastError
      });
    }

    const error = new Error(history.lastError || "De dagelijkse PLUS-ophaling is mislukt.");
    error.code = "DAILY_FETCH_FAILED";
    throw error;
  }

  try {
    const scraped = await scrapePoints(settings);
    const attemptedAt = new Date().toISOString();
    const record = {
      date: today,
      ...scraped,
      savedAt: attemptedAt
    };

    history.records = history.records
      .filter((item) => item.date !== today)
      .concat(record)
      .sort((left, right) => left.date.localeCompare(right.date));
    history.updatedAt = attemptedAt;
    history.lastAttemptDate = today;
    history.lastAttemptAt = attemptedAt;
    history.lastError = null;
    await writeHistory(settings, history);

    return { ...record, fromCache: false };
  } catch (error) {
    history.lastAttemptDate = today;
    history.lastAttemptAt = new Date().toISOString();
    history.lastError = error.message;
    await writeHistory(settings, history);

    if (!latest) throw error;

    return cachedResult(latest, {
      stale: true,
      refreshError: error.message
    });
  }
}

function getDailyPoints(settings = {}, options = {}) {
  const file = historyPath(settings);
  if (requestsInProgress.has(file)) return requestsInProgress.get(file);

  const request = updateDailyRecord(settings, options.force === true).finally(() => {
    requestsInProgress.delete(file);
  });
  requestsInProgress.set(file, request);
  return request;
}

module.exports = {
  dateKey,
  getDailyPoints,
  historyPath,
  readHistory
};
