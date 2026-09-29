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

  getHeader() {
    return this.config.title;
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

    if (this.loading) {
      wrapper.className += " small dimmed";
      wrapper.textContent = "Laden…";
    } else if (this.error) {
      wrapper.className += " small plus-points__error";
      wrapper.textContent = this.error.message;
    } else {
      const content = document.createElement("div");
      content.className = "plus-points__content";
      content.appendChild(this.getSummaryDom());
      content.appendChild(this.getChartDom());
      wrapper.appendChild(content);
    }

    if (this.points?.fetchedAt) {
      const updated = document.createElement("div");
      updated.className = "xsmall dimmed plus-points__updated";
      updated.textContent = `Bijgewerkt ${new Date(this.points.fetchedAt).toLocaleDateString("nl-NL", {
        day: "2-digit",
        month: "2-digit"
      })}`;
      wrapper.appendChild(updated);
    }

    if (this.points?.stale) {
      const warning = document.createElement("div");
      warning.className = "xsmall plus-points__error";
      warning.textContent = "Laatste bekende stand; PLUS kon vandaag niet worden bereikt.";
      wrapper.appendChild(warning);
    }

    return wrapper;
  },

  getSummaryDom() {
    const summary = document.createElement("div");
    summary.className = "plus-points__summary";

    const totalPoints = Number.isFinite(Number(this.points.totalPoints))
      ? Number(this.points.totalPoints)
      : Number(String(this.points.points).replaceAll(".", "").replace(",", "."));
    const values = [
      [totalPoints, "punten"],
      [this.points.fullCards, "volle kaarten"],
      [this.points.redeemableValue, "euro"]
    ];

    values.forEach(([rawValue, label], index) => {
      const metric = document.createElement("div");
      metric.className = "plus-points__metric";

      const value = document.createElement("div");
      value.className = "plus-points__metric-value bright";
      const numericValue = rawValue === null || rawValue === undefined ? NaN : Number(rawValue);
      value.textContent = Number.isFinite(numericValue)
        ? index === 2
          ? `€ ${numericValue.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : numericValue.toLocaleString("nl-NL")
        : "–";

      const caption = document.createElement("div");
      caption.className = "xsmall dimmed plus-points__metric-label";
      caption.textContent = label;

      metric.appendChild(value);
      metric.appendChild(caption);
      summary.appendChild(metric);
    });

    return summary;
  },

  getChartDom() {
    const chart = document.createElement("div");
    chart.className = "plus-points__chart";

    const records = (this.points.history || [])
      .map((record) => ({ date: record.date, value: Number(record.totalPoints) }))
      .filter((record) => record.date && Number.isFinite(record.value))
      .sort((left, right) => left.date.localeCompare(right.date));

    if (!records.length) {
      chart.className += " xsmall dimmed";
      chart.textContent = "Nog geen historie";
      return chart;
    }

    const width = 190;
    const height = 54;
    const padding = 3;
    const values = records.map((record) => record.value);
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const range = maximum - minimum || 1;
    const points = records.map((record, index) => {
      const x = records.length === 1
        ? width / 2
        : padding + (index / (records.length - 1)) * (width - padding * 2);
      const y = height - padding - ((record.value - minimum) / range) * (height - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    if (records.length === 1) {
      points.unshift(`${padding},${height / 2}`);
      points.push(`${width - padding},${height / 2}`);
    }

    const svgNamespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNamespace, "svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Puntensaldo over de afgelopen zes maanden");

    const line = document.createElementNS(svgNamespace, "polyline");
    line.setAttribute("points", points.join(" "));
    line.setAttribute("class", "plus-points__line");
    svg.appendChild(line);

    const period = document.createElement("div");
    period.className = "xsmall dimmed plus-points__period";
    period.textContent = "afgelopen 6 maanden";

    chart.appendChild(svg);
    chart.appendChild(period);
    return chart;
  }
});
