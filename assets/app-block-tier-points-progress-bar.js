class TierPointsProgressBar extends HTMLElement {
  static POINTS_FIRST_TIER = 100;
  static POINTS_SECOND_TIER = 700;
  static POINTS_MAX = 1000;
  static FIRST_STOP = 33.33;
  static SECOND_STOP = 66.66;
  static TIER_STOPS = [0, 33.33, 66.66, 100];

  connectedCallback() {
    if (this.dataset.initialized === "true") return;

    this.dataset.initialized = "true";
    this.marker = this.querySelector(".tier-points-progress-bar__marker");
    this.pointsInput = this.querySelector("[data-tier-points-input]");
    this.percentageInput = this.querySelector("[data-tier-percentage-input]");

    this.pointsInput?.addEventListener("input", () => {
      const points = Number.parseFloat(this.pointsInput.value);
      if (Number.isFinite(points)) this.setPoints(points);
    });

    this.percentageInput?.addEventListener("input", () => {
      const percentage = Number.parseFloat(this.percentageInput.value);
      if (Number.isFinite(percentage)) this.setPercentage(percentage);
    });

    this.setPercentage(Number.parseFloat(this.dataset.progress || "0"));
  }

  clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
  }

  percentageFromPoints(points) {
    const value = this.clamp(points, 0, TierPointsProgressBar.POINTS_MAX);

    if (value <= TierPointsProgressBar.POINTS_FIRST_TIER) {
      return (value / TierPointsProgressBar.POINTS_FIRST_TIER) * TierPointsProgressBar.FIRST_STOP;
    }

    if (value <= TierPointsProgressBar.POINTS_SECOND_TIER) {
      return TierPointsProgressBar.FIRST_STOP +
        ((value - TierPointsProgressBar.POINTS_FIRST_TIER) /
          (TierPointsProgressBar.POINTS_SECOND_TIER - TierPointsProgressBar.POINTS_FIRST_TIER)) *
          (TierPointsProgressBar.SECOND_STOP - TierPointsProgressBar.FIRST_STOP);
    }

    return TierPointsProgressBar.SECOND_STOP +
      ((value - TierPointsProgressBar.POINTS_SECOND_TIER) /
        (TierPointsProgressBar.POINTS_MAX - TierPointsProgressBar.POINTS_SECOND_TIER)) *
        (100 - TierPointsProgressBar.SECOND_STOP);
  }

  pointsFromPercentage(percentage) {
    const value = this.clamp(percentage, 0, 100);

    if (value <= TierPointsProgressBar.FIRST_STOP) {
      return (value / TierPointsProgressBar.FIRST_STOP) * TierPointsProgressBar.POINTS_FIRST_TIER;
    }

    if (value <= TierPointsProgressBar.SECOND_STOP) {
      return TierPointsProgressBar.POINTS_FIRST_TIER +
        ((value - TierPointsProgressBar.FIRST_STOP) /
          (TierPointsProgressBar.SECOND_STOP - TierPointsProgressBar.FIRST_STOP)) *
          (TierPointsProgressBar.POINTS_SECOND_TIER - TierPointsProgressBar.POINTS_FIRST_TIER);
    }

    return TierPointsProgressBar.POINTS_SECOND_TIER +
      ((value - TierPointsProgressBar.SECOND_STOP) /
        (100 - TierPointsProgressBar.SECOND_STOP)) *
        (TierPointsProgressBar.POINTS_MAX - TierPointsProgressBar.POINTS_SECOND_TIER);
  }

  setPoints(points) {
    const value = this.clamp(points, 0, TierPointsProgressBar.POINTS_MAX);
    this.render(this.percentageFromPoints(value), value);
  }

  setPercentage(percentage) {
    const value = this.clamp(percentage, 0, 100);
    this.render(value, this.pointsFromPercentage(value));
  }

  isTierStop(percentage) {
    return TierPointsProgressBar.TIER_STOPS.some(
      (stop) => Math.abs(percentage - stop) < 0.005,
    );
  }

  render(percentage, points) {
    const roundedPercentage = Number(percentage.toFixed(2));
    this.style.setProperty("--tier-progress", `${roundedPercentage}%`);
    this.dataset.progress = roundedPercentage.toString();
    this.setAttribute("aria-label", `Tier progress: ${roundedPercentage} percent`);

    if (this.marker) this.marker.hidden = this.isTierStop(roundedPercentage);
    if (this.percentageInput) this.percentageInput.value = roundedPercentage.toString();
    if (this.pointsInput) this.pointsInput.value = Math.round(points).toString();
  }
}

if (!customElements.get("tier-points-progress-bar")) {
  customElements.define("tier-points-progress-bar", TierPointsProgressBar);
}
