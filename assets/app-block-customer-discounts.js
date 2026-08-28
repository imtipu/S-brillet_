class AppBlockCustomerDiscounts extends HTMLElement {
  static ULTRA_GALAXY_LEVEL = "ULTRA_GALAXY";

  static ULTRA_GALAXY_REQUIRED_POINTS = 1000;

  async connectedCallback() {
    if (this.dataset.initialized === "true") {
      return;
    }

    this.dataset.initialized = "true";
    this.addEventListener("click", this.handleDiscountClick.bind(this));
    this.addEventListener("click", this.handleRefreshDiscounts.bind(this));

    await this.renderDiscounts();
  }

  get elements() {
    return {
      status: this.querySelector("[data-discounts-status]"),
      items: this.querySelector("[data-discounts-items]"),
      btn_refresh: this.querySelector("[data-refresh-button]"),
    };
  }

  async getDiscounts() {
    const response = await fetch("/apps/sbrillet/api/customer/discounts");
    if (!response.ok) {
      throw new Error(response.statusText || "Failed to load discounts");
    }

    return response.json();
  }

  async getCart() {
    const root = window.Shopify?.routes?.root || "/";
    const response = await fetch(`${root}cart.js`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(response.statusText || "Failed to load cart");
    }

    return response.json();
  }

  getFirstExistingValue(source, keys) {
    if (!source) return undefined;

    for (const key of keys) {
      if (source[key] !== undefined && source[key] !== null) {
        return source[key];
      }
    }

    return undefined;
  }

  toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = value?.toString() || "";
    return element.innerHTML;
  }

  escapeAttribute(value) {
    return this.escapeHtml(value).replaceAll('"', "&quot;");
  }

  normalizeTierLevel(value) {
    return value?.toString().trim().toUpperCase().replaceAll(" ", "_") || "";
  }

  normalizeDiscountsResponse(response) {
    const data = response?.data || response;
    const discounts =
      data?.discounts ||
      data?.rewards ||
      data?.items ||
      data?.customerDiscounts ||
      [];

    return Array.isArray(discounts) ? discounts : [];
  }

  getTierLevel(discount) {
    const tier =
      discount?.tier ||
      discount?.tierConfig ||
      discount?.loyalty_tier_config ||
      discount?.loyaltyTierConfig ||
      discount?.customer?.tier ||
      discount?.customer?.tierConfig ||
      {};

    return this.normalizeTierLevel(
      this.getFirstExistingValue(discount, [
        "tierLevel",
        "level",
        "nextTierLevel",
        "rewardTierLevel",
      ]) ||
        this.getFirstExistingValue(tier, ["tierLevel", "level"]) ||
        discount?.customer?.tierLevel,
    );
  }

  getEarnedPoints(discount) {
    return this.toNumber(
      this.getFirstExistingValue(discount, [
        "earnedPoints",
        "earningPoints",
        "pointsEarned",
        "sparklePoints",
        "points",
        "orderEarnedPoints",
      ]),
    );
  }

  getPointsBeforeOrder(discount) {
    return this.getFirstExistingValue(discount, [
      "pointsBeforeOrder",
      "previousTotalPoints",
      "totalPointsBeforeOrder",
      "customerPreviousPoints",
    ]);
  }

  allocateUltraGalaxyPoints(discount) {
    const earnedPoints = this.getEarnedPoints(discount);
    const rawPointsBeforeOrder = this.getPointsBeforeOrder(discount);
    const hasPointsBeforeOrder =
      rawPointsBeforeOrder !== undefined && rawPointsBeforeOrder !== null;
    const pointsBeforeOrder = this.toNumber(rawPointsBeforeOrder);
    const pointsAfterOrder = pointsBeforeOrder + earnedPoints;
    const tierLevel = this.getTierLevel(discount);
    const ultraGalaxyRequirement =
      this.toNumber(discount?.ultraGalaxyRequiredPoints) ||
      AppBlockCustomerDiscounts.ULTRA_GALAXY_REQUIRED_POINTS;
    const crossesUltraGalaxy =
      (tierLevel === AppBlockCustomerDiscounts.ULTRA_GALAXY_LEVEL &&
        (!hasPointsBeforeOrder ||
          pointsBeforeOrder < ultraGalaxyRequirement)) ||
      (pointsBeforeOrder < ultraGalaxyRequirement &&
        pointsAfterOrder >= ultraGalaxyRequirement);

    if (!crossesUltraGalaxy) {
      return {
        earnedPoints,
        pointsReservedForUltraGalaxy: 0,
        configurableRewardPoints: earnedPoints,
        crossesUltraGalaxy,
      };
    }

    const pointsNeededForUltraGalaxy = Math.max(
      ultraGalaxyRequirement - pointsBeforeOrder,
      0,
    );
    const pointsReservedForUltraGalaxy = Math.min(
      earnedPoints,
      hasPointsBeforeOrder
        ? pointsNeededForUltraGalaxy
        : ultraGalaxyRequirement,
    );

    return {
      earnedPoints,
      pointsReservedForUltraGalaxy,
      configurableRewardPoints: Math.max(
        earnedPoints - pointsReservedForUltraGalaxy,
        0,
      ),
      crossesUltraGalaxy,
    };
  }

  getDiscountTitle(discount, index) {
    return (
      this.getFirstExistingValue(discount, [
        "title",
        "name",
        "code",
        "discountCode",
      ]) || `Discount ${index + 1}`
    );
  }

  getDiscountCode(discount, index) {
    return (
      this.getFirstExistingValue(discount, [
        "code",
        "discountCode",
        "title",
        "name",
      ]) || `Discount ${index + 1}`
    );
  }

  renderDiscountItem(discount, index) {
    const displayTitle = this.getDiscountTitle(discount, index);
    const title = this.escapeHtml(displayTitle);
    const titleAttribute = this.escapeAttribute(displayTitle);
    const code = this.escapeAttribute(this.getDiscountCode(discount, index));

    return `
      <button
        class="customer-discounts__item"
        type="button"
        data-discount-code="${code}"
        data-discount-title="${titleAttribute}"
        aria-pressed="false"
        aria-label="${titleAttribute}"
      >
        <span class="customer-discounts__item-title" data-discount-title-text>${title}</span>
      </button>
    `;
  }

  get cartUpdateUrl() {
    const root = window.Shopify?.routes?.root || "/";
    return `${root}cart/update.js`;
  }

  async applyDiscountCode(code) {
    const response = await fetch(this.cartUpdateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ discount: code }),
    });

    if (!response.ok) {
      throw new Error(response.statusText || "Failed to apply discount");
    }

    return response.json();
  }

  getAppliedDiscountCode(cart) {
    const cartDiscount = cart?.cart_level_discount_applications?.[0];
    if (cartDiscount?.title) return cartDiscount.title;

    const lineDiscount = cart?.items
      ?.flatMap((item) => item.line_level_discount_allocations || [])
      ?.map((allocation) => allocation.discount_application?.title)
      ?.find(Boolean);

    return lineDiscount || "";
  }

  setApplyingState(isApplying) {
    const { items } = this.elements;
    if (!items) return;

    items.querySelectorAll("[data-discount-code]").forEach((button) => {
      button.disabled = isApplying;
    });
  }

  setApplyingDiscount(button, isApplying) {
    const titleElement = button?.querySelector("[data-discount-title-text]");
    if (!button || !titleElement) return;

    const title = button.dataset.discountTitle || titleElement.textContent || "Discount";

    button.classList.toggle("is-applying", isApplying);
    button.setAttribute(
      "aria-label",
      isApplying ? `Applying ${title}` : title,
    );
    titleElement.textContent = isApplying ? "Applying…" : title;
  }

  setUsedDiscountCode(code) {
    const { items } = this.elements;
    if (!items) return;

    items.querySelectorAll("[data-discount-code]").forEach((button) => {
      const isUsed = button.dataset.discountCode === code;
      button.classList.toggle("customer-discounts__item--used", isUsed);
      button.setAttribute("aria-pressed", isUsed ? "true" : "false");
    });
  }

  async handleDiscountClick(event) {
    const button = event.target.closest("[data-discount-code]");
    if (!button || !this.contains(button)) return;

    const code = button.dataset.discountCode;
    if (!code) return;

    this.setStatus("");
    this.setApplyingDiscount(button, true);
    this.setApplyingState(true);

    try {
      const cart = await this.applyDiscountCode(code);
      this.setUsedDiscountCode(this.getAppliedDiscountCode(cart) || code);
      this.setStatus("");
      document.dispatchEvent(
        new CustomEvent("cart:refresh", {
          detail: { discountCode: code },
        }),
      );
    } catch (error) {
      console.error("Failed to apply discount code", error);
      this.setStatus("Unable to apply discount.");
    } finally {
      this.setApplyingDiscount(button, false);
      this.setApplyingState(false);
    }
  }

  async syncUsedDiscountFromCart() {
    try {
      const cart = await this.getCart();
      const code = this.getAppliedDiscountCode(cart);
      if (code) {
        this.setUsedDiscountCode(code);
      }
    } catch (error) {
      console.error("Failed to sync applied discount code", error);
    }
  }

  setStatus(message) {
    const { status } = this.elements;
    if (status) {
      status.textContent = message;
    }
  }

  async renderDiscounts() {
    const { items } = this.elements;

    try {
      const response = await this.getDiscounts();
      const discounts = this.normalizeDiscountsResponse(response);

      if (!discounts.length) {
        this.setStatus("No discounts found.");
        if (items) items.innerHTML = "";
        return;
      }

      this.setStatus("");
      if (items) {
        items.innerHTML = discounts
          .map((discount, index) => this.renderDiscountItem(discount, index))
          .join("");
      }

      await this.syncUsedDiscountFromCart();
    } catch (error) {
      console.error("Failed to render customer discounts", error);
      this.setStatus("Unable to load discounts.");
      if (items) items.innerHTML = "";
    }
  }

  async handleRefreshDiscounts(event) {
    const button = event.target.closest("[data-refresh-button]");
    if (!button || !this.contains(button)) return;

    console.log("refreshing");

    await this.renderDiscounts();
  }
}

if (!customElements.get("customer-discount-list")) {
  customElements.define("customer-discount-list", AppBlockCustomerDiscounts);
}
