Module.register("MMM-plus-supermarkt-punten", {
  defaults: {
    updateIntervalHours: 12,
    settingsFile: "settings.json",
    timeout: 60000,
    title: "Mijn Plus punten"
  },

  start() {
    this.points = null;
    this.error = null;
    this.loading = true;
    this.fetchPoints();

    const configuredHours = Number(this.config.updateIntervalHours);
    const updateIntervalHours =
      Number.isFinite(configuredHours) && configuredHours > 0 ? configuredHours : 12;
    this.timer = setInterval(
      () => this.fetchPoints(),
      updateIntervalHours * 60 * 60 * 1000
    );
  },

  getStyles() {
    return ["MMM-plus-supermarkt-punten.css"];
  },

  fetchPoints() {
    this.sendSocketNotification("PLUS_FETCH_POINTS", {
      settingsFile: this.config.settingsFile,
      timeout: this.config.timeout
    });
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "PLUS_POINTS") {
      this.points = payload;
      this.error = null;
      this.loading = false;
      this.updateDom(500);
    }

    if (notification === "PLUS_POINTS_ERROR") {
      this.error = payload;
      this.loading = false;
      this.updateDom(500);
    }
  },

  getDom() {
    const wrapper = document.createElement("div");
    wrapper.className = "plus-points";

    const title = document.createElement("div");
    title.className = "plus-points__title small dimmed";
    title.textContent = this.config.title;
    wrapper.appendChild(title);

    const value = document.createElement("div");
    value.className = "plus-points__value bright";

    if (this.loading) {
      value.className += " small dimmed";
      value.textContent = "Laden…";
    } else if (this.error) {
      value.className += " small plus-points__error";
      value.textContent = this.error.message;
    } else {
      value.textContent = this.points.points;
    }

    wrapper.appendChild(value);

    if (this.points?.fullCards !== undefined) {
      const breakdown = document.createElement("div");
      breakdown.className = "small dimmed plus-points__breakdown";
      breakdown.textContent =
        `${this.points.fullCards} volle kaarten + ` +
        `${this.points.loosePoints} van ${this.points.pointsPerCard} punten`;
      wrapper.appendChild(breakdown);

      if (this.points.redeemableValue) {
        const redeemable = document.createElement("div");
        redeemable.className = "small dimmed";
        redeemable.textContent = `Inwisselbaar: €${this.points.redeemableValue}`;
        wrapper.appendChild(redeemable);
      }
    }

    if (this.points?.fetchedAt) {
      const updated = document.createElement("div");
      updated.className = "xsmall dimmed";
      const source = this.points.fromCache ? "dagcache" : "PLUS";
      updated.textContent =
        `Bijgewerkt: ${new Date(this.points.fetchedAt).toLocaleString("nl-NL")} (${source})`;
      wrapper.appendChild(updated);
    }

    if (this.points?.stale) {
      const warning = document.createElement("div");
      warning.className = "xsmall plus-points__error";
      warning.textContent = "Laatste bekende stand; PLUS kon vandaag niet worden bereikt.";
      wrapper.appendChild(warning);
    }

    return wrapper;
  }
});
