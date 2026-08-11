const NodeHelper = require("node_helper");
const path = require("path");
const { getDailyPoints } = require("./points-store");

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

      getDailyPoints({ ...settings, timeout: payload.timeout })
        .then((result) => this.sendSocketNotification("PLUS_POINTS", result))
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
