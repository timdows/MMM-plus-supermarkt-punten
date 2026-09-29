const NodeHelper = require("node_helper");
const path = require("path");
const { getDailyPoints, readHistory } = require("./points-store");

function sixMonthHistory(records, referenceDate = new Date()) {
  const cutoff = new Date(referenceDate);
  cutoff.setMonth(cutoff.getMonth() - 6);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  return records.filter((record) => record.date >= cutoffDate);
}

module.exports = NodeHelper.create({
  start() {
    this.fetchInProgress = false;
  },

  socketNotificationReceived(notification, payload) {
    if (notification !== "PLUS_FETCH_POINTS" || this.fetchInProgress) {
      return;
    }

    this.fetchInProgress = true;
    const settingsPath = path.resolve(__dirname, payload.settingsFile || "settings.json");

    try {
      delete require.cache[require.resolve(settingsPath)];
      const settings = require(settingsPath);

      const storeSettings = { ...settings, timeout: payload.timeout };

      getDailyPoints(storeSettings)
        .then(async (result) => {
          const history = await readHistory(storeSettings);
          this.sendSocketNotification("PLUS_POINTS", {
            ...result,
            history: sixMonthHistory(history.records)
          });
        })
        .catch((error) => {
          this.sendSocketNotification("PLUS_POINTS_ERROR", {
            message: error.message,
            code: error.code,
            details: error.details
          });
        })
        .finally(() => {
          this.fetchInProgress = false;
        });
    } catch (error) {
      this.fetchInProgress = false;
      this.sendSocketNotification("PLUS_POINTS_ERROR", {
        message: `Kan settings niet laden: ${error.message}`
      });
    }
  }
});
