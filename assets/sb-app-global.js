class CustomerPointStatStore extends EventTarget {
  constructor() {
    super();
    this.state = {
      loading: false,
      data: null,
      error: null,
    };
    this.request = null;
  }

  getState() {
    return this.state;
  }

  setState(nextState) {
    this.state = {
      ...this.state,
      ...nextState,
    };

    this.dispatchEvent(
      new CustomEvent("change", {
        detail: this.state,
      }),
    );
  }
  subscribe(callback) {
    const handler = (event) => callback(event.detail);

    this.addEventListener("change", handler);

    // Return unsubscribe function
    return () => {
      this.removeEventListener("change", handler);
    };
  }

  async fetchData({ force = false } = {}) {
    if (this.state.loaded && !force) {
      return this.state.data;
    }

    if (this.request) {
      return this.request;
    }
    this.setState({
      loading: true,
      error: null,
    });

    this.request = fetch("/apps/sbrillet/api/customer/point-stats")
      .then(async (response) => {
        if (!response.ok) throw new Error(response.statusText);
        const responseJson = await response.json();
        this.setState({
          data: responseJson?.stats,
          loading: false,
          loaded: true,
        });
        return responseJson?.stats;
      })
      .catch((error) => {
        this.setState({
          loading: false,
          error,
        });

        throw error;
      })
      .finally(() => {
        this.request = null;
      });

    return this.request;
  }
}

class CustomerPointHistoryApi {
  constructor() {
    this.cache = new Map();
    this.requests = new Map();
  }

  normalizeProxyPath(proxyPath = "/apps/sbrillet") {
    const value = String(proxyPath || "/apps/sbrillet").trim();
    return (value || "/apps/sbrillet").replace(/\/+$/, "");
  }

  normalizeLimit(limit = 5) {
    const parsedLimit = Number.parseInt(limit, 10);
    if (Number.isNaN(parsedLimit)) return 5;
    return Math.min(20, Math.max(1, parsedLimit));
  }

  async fetch({ limit = 5, proxyPath = "/apps/sbrillet", force = false } = {}) {
    const normalizedLimit = this.normalizeLimit(limit);
    const normalizedProxyPath = this.normalizeProxyPath(proxyPath);
    const cacheKey = `${normalizedProxyPath}:${normalizedLimit}`;

    if (!force && this.cache.has(cacheKey)) return this.cache.get(cacheKey);
    if (this.requests.has(cacheKey)) return this.requests.get(cacheKey);

    const request = window
      .fetch(
        `${normalizedProxyPath}/api/customer/point-history?limit=${encodeURIComponent(normalizedLimit)}`,
        { headers: { Accept: "application/json" } },
      )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            response.statusText || "Failed to load point history",
          );
        }

        const payload = await response.json();
        if (payload?.ok === false || !Array.isArray(payload?.history)) {
          throw new Error("Invalid point history response");
        }

        const result = {
          ...payload,
          history: payload.history,
          limit: this.normalizeLimit(payload.limit || normalizedLimit),
        };
        this.cache.set(cacheKey, result);
        return result;
      })
      .finally(() => this.requests.delete(cacheKey));

    this.requests.set(cacheKey, request);
    return request;
  }
}

class SBrilletTopVotedProductsStore extends EventTarget {
  constructor() {
    super();
    this.entries = new Map();
  }

  normalizeProxyPath(proxyPath = "/apps/sbrillet") {
    const value = String(proxyPath || "/apps/sbrillet").trim();
    return (value || "/apps/sbrillet").replace(/\/+$/, "");
  }

  getEntry(proxyPath) {
    const normalizedProxyPath = this.normalizeProxyPath(proxyPath);

    if (!this.entries.has(normalizedProxyPath)) {
      this.entries.set(normalizedProxyPath, {
        state: {
          loading: false,
          data: null,
          error: null,
          loaded: false,
        },
        request: null,
        refreshQueued: false,
      });
    }

    return this.entries.get(normalizedProxyPath);
  }

  getState(proxyPath) {
    return this.getEntry(proxyPath).state;
  }

  setState(proxyPath, nextState) {
    const normalizedProxyPath = this.normalizeProxyPath(proxyPath);
    const entry = this.getEntry(normalizedProxyPath);
    entry.state = { ...entry.state, ...nextState };

    this.dispatchEvent(
      new CustomEvent("change", {
        detail: {
          proxyPath: normalizedProxyPath,
          state: entry.state,
        },
      }),
    );
  }

  subscribe(proxyPath, callback) {
    const normalizedProxyPath = this.normalizeProxyPath(proxyPath);
    const handler = (event) => {
      if (event.detail?.proxyPath === normalizedProxyPath) {
        callback(event.detail.state);
      }
    };

    this.addEventListener("change", handler);
    return () => this.removeEventListener("change", handler);
  }

  async fetchData({ proxyPath = "/apps/sbrillet", force = false } = {}) {
    const normalizedProxyPath = this.normalizeProxyPath(proxyPath);
    const entry = this.getEntry(normalizedProxyPath);

    if (entry.state.loaded && !force) return entry.state.data;
    if (entry.request) {
      if (force) entry.refreshQueued = true;
      return entry.request;
    }

    this.setState(normalizedProxyPath, { loading: true, error: null });

    entry.request = window
      .fetch(`${normalizedProxyPath}/api/top-voted-products`, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            response.statusText || "Failed to load top voted products",
          );
        }

        const data = await response.json();
        this.setState(normalizedProxyPath, {
          data,
          loading: false,
          loaded: true,
        });
        return data;
      })
      .catch((error) => {
        this.setState(normalizedProxyPath, { loading: false, error });
        throw error;
      })
      .finally(() => {
        entry.request = null;

        if (entry.refreshQueued) {
          entry.refreshQueued = false;
          this.fetchData({ proxyPath: normalizedProxyPath, force: true }).catch(
            () => {},
          );
        }
      });

    return entry.request;
  }
}

class BlockCustomerDiscounts extends HTMLElement {
  async connectedCallback() {
    if (this.dataset.initialized === "true") {
      return;
    }

    this.dataset.initialized = "true";
    this.handleDiscountClickBound = this.handleDiscountClick.bind(this);
    this.handleReadyToShipClickBound = this.handleReadyToShipClick.bind(this);
    this.syncReadyToShipButtonStateBound =
      this.syncReadyToShipButtonState.bind(this);
    this.handleScrollClickBound = this.handleScrollClick.bind(this);
    this.updateScrollButtonsBound = this.updateScrollButtons.bind(this);
    this.handlePointRedeemSubmitBound = this.handlePointRedeemSubmit.bind(this);
    this.handlePointRedeemToggleClickBound =
      this.handlePointRedeemToggleClick.bind(this);
    this.handlePointRedeemCloseClickBound =
      this.handlePointRedeemCloseClick.bind(this);
    this.handlePointRedeemKeydownBound =
      this.handlePointRedeemKeydown.bind(this);

    this.addEventListener("click", this.handleDiscountClickBound);
    this.addEventListener("click", this.handleReadyToShipClickBound);
    this.addEventListener("click", this.handleScrollClickBound);
    this.elements.pointRedeemForm?.addEventListener(
      "submit",
      this.handlePointRedeemSubmitBound,
    );
    this.elements.pointRedeemToggle?.addEventListener(
      "click",
      this.handlePointRedeemToggleClickBound,
    );
    this.elements.pointRedeemClose?.addEventListener(
      "click",
      this.handlePointRedeemCloseClickBound,
    );
    this.elements.pointRedeemForm?.addEventListener(
      "keydown",
      this.handlePointRedeemKeydownBound,
    );
    this.elements.items?.addEventListener(
      "scroll",
      this.updateScrollButtonsBound,
      { passive: true },
    );
    window.addEventListener("resize", this.updateScrollButtonsBound);
    ["cart:updated", "cart:refresh", "cart:rendered"].forEach(
      (eventName) =>
        document.addEventListener(
          eventName,
          this.syncReadyToShipButtonStateBound,
        ),
    );

    await this.renderDiscounts();
  }

  disconnectedCallback() {
    this.removeEventListener("click", this.handleDiscountClickBound);
    this.removeEventListener("click", this.handleReadyToShipClickBound);
    this.removeEventListener("click", this.handleScrollClickBound);
    this.elements.pointRedeemForm?.removeEventListener(
      "submit",
      this.handlePointRedeemSubmitBound,
    );
    this.elements.pointRedeemToggle?.removeEventListener(
      "click",
      this.handlePointRedeemToggleClickBound,
    );
    this.elements.pointRedeemClose?.removeEventListener(
      "click",
      this.handlePointRedeemCloseClickBound,
    );
    this.elements.pointRedeemForm?.removeEventListener(
      "keydown",
      this.handlePointRedeemKeydownBound,
    );
    this.elements.items?.removeEventListener(
      "scroll",
      this.updateScrollButtonsBound,
    );
    window.removeEventListener("resize", this.updateScrollButtonsBound);
    ["cart:updated", "cart:refresh", "cart:rendered"].forEach(
      (eventName) =>
        document.removeEventListener(
          eventName,
          this.syncReadyToShipButtonStateBound,
        ),
    );
  }

  getPointChoices() {
    return [
      {
        label: "5$",
        points: 100,
        amount: 5,
      },
      {
        label: "10$",
        points: 200,
        amount: 10,
      },
      {
        label: "15$",
        points: 300,
        amount: 15,
      },
      {
        label: "20$",
        points: 400,
        amount: 20,
      },
      {
        label: "30$",
        points: 500,
        amount: 30,
      },
      {
        label: "50$",
        points: 750,
        amount: 50,
      },
    ];
  }

  get elements() {
    return {
      status: this.querySelector("[data-discounts-status]"),
      items: this.querySelector("[data-discounts-items]"),
      previousButton: this.querySelector('[data-scroll-direction="previous"]'),
      nextButton: this.querySelector('[data-scroll-direction="next"]'),
      pointRedeemForm: this.querySelector("[data-point-redeem-form]"),
      pointRedeemPanel: this.querySelector("[data-point-redeem-panel]"),
      pointRedeemToggle: this.querySelector("[data-point-redeem-toggle]"),
      pointRedeemClose: this.querySelector("[data-point-redeem-close]"),
      pointRedeemChoices: this.querySelector("[data-point-redeem-choices]"),
      pointRedeemError: this.querySelector("[data-point-redeem-error]"),
      pointRedeemSuccess: this.querySelector("[data-point-redeem-success]"),
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

  escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = value?.toString() || "";
    return element.innerHTML;
  }

  escapeAttribute(value) {
    return this.escapeHtml(value).replaceAll('"', "&quot;");
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

  async getReadyToShipProduct() {
    const hasFreeItemInOrder =
      String(this.dataset.hasFreeItemInOrder || "").toLowerCase() === "true";
    if (!hasFreeItemInOrder) return;
    const collectionId = this.dataset.readyToShipCollection?.trim();
    if (!collectionId) return;
    const apiPath = "/apps/sbrillet/api/cart/ready-to-ship-product";

    try {
      const url = new URL(apiPath, window.location.origin);
      url.searchParams.set("collectionId", collectionId);
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return null;

      const payload = await response.json();
      const data = payload?.data || payload;
      const variantId = data?.variantId;

      return data?.ok && variantId ? String(variantId) : null;
    } catch (error) {
      console.error("Failed to load Ready-to-Ship product", error);
      return null;
    }
  }

  get readyToShipButtonLabel() {
    return (
      this.dataset.readyToShipButtonLabel || "Free READY-To-SHIP Jewellery Item"
    );
  }

  hasReadyToShipCartLine() {
    return Boolean(
      document.querySelector(
        'm-cart-items [data-is-free-in-order="true"][data-line-price="0"]',
      ),
    );
  }

  renderReadyToShipItem() {
    const label = this.escapeHtml(this.readyToShipButtonLabel);
    const labelAttribute = this.escapeAttribute(this.readyToShipButtonLabel);

    return `
      <button
        class="customer-discounts__item customer-discounts__item--ready-to-ship customer-discounts__item--active"
        type="button"
        data-ready-to-ship-cart-item
        aria-label="${labelAttribute}"
        aria-pressed="true"
        disabled
      >
        <span class="customer-discounts__item-title">${label}</span>
      </button>
    `;
  }

  renderDiscountItem(discount, index) {
    const displayTitle = this.getDiscountTitle(discount, index);
    const title = this.escapeHtml(displayTitle);
    const titleAttribute = this.escapeAttribute(displayTitle);
    const code = this.escapeAttribute(this.getDiscountCode(discount, index));
    const description = this.escapeAttribute(discount?.description || "");

    return `
      <button
        class="customer-discounts__item"
        type="button"
        data-discount-code="${code}"
        data-discount-title="${titleAttribute}"
        aria-pressed="false"
        aria-label="${titleAttribute}"
        ${description ? `title="${description}"` : ""}
      >
        <span class="customer-discounts__item-title" data-discount-title-text>${title}</span>
      </button>
    `;
  }

  renderDiscountSkeletons() {
    return Array.from(
      { length: 3 },
      () => '<span class="customer-discounts__skeleton"></span>',
    ).join("");
  }

  setDiscountsLoading(isLoading) {
    const { items } = this.elements;
    if (!items) return;

    items.setAttribute("aria-busy", isLoading ? "true" : "false");

    if (isLoading) {
      items.innerHTML = this.renderDiscountSkeletons();
    }
  }

  updateScrollButtons() {
    const { items, previousButton, nextButton } = this.elements;
    if (!items) return;

    const canScroll = items.scrollWidth > items.clientWidth + 1;
    const atStart = items.scrollLeft <= 1;
    const atEnd = items.scrollLeft >= items.scrollWidth - items.clientWidth - 1;

    if (previousButton) previousButton.disabled = !canScroll || atStart;
    if (nextButton) nextButton.disabled = !canScroll || atEnd;
  }

  handleScrollClick(event) {
    const button = event.target.closest("[data-scroll-direction]");
    if (!button || !this.contains(button)) return;

    const { items } = this.elements;
    if (!items) return;

    const direction = button.dataset.scrollDirection === "next" ? 1 : -1;
    items.scrollBy({
      left: direction * Math.max(items.clientWidth * 0.75, 160),
      behavior: "smooth",
    });
  }

  get cartUpdateUrl() {
    const root = window.Shopify?.routes?.root || "/";
    return `${root}cart/update.js`;
  }

  get cartAddUrl() {
    const root = window.Shopify?.routes?.root || "/";
    return `${root}cart/add.js`;
  }

  async addReadyToShipVariant(variantId) {
    const response = await fetch(this.cartAddUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ items: [{ id: variantId, quantity: 1 }] }),
    });

    if (!response.ok) {
      throw new Error(
        response.statusText || "Failed to add Ready-to-Ship item",
      );
    }

    return response.json();
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

  getAppliedDiscountCodes(cart) {
    const cartDiscounts = cart?.cart_level_discount_applications || [];
    const lineDiscounts =
      cart?.items?.flatMap(
        (item) => item.line_level_discount_allocations || [],
      ) || [];

    return [...cartDiscounts, ...lineDiscounts]
      .flatMap((discount) => {
        const application = discount?.discount_application || discount;
        return [application?.code, application?.title];
      })
      .filter(Boolean);
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

    const title =
      button.dataset.discountTitle || titleElement.textContent || "Discount";

    button.classList.toggle("is-applying", isApplying);
    button.setAttribute("aria-label", isApplying ? `Applying ${title}` : title);
    titleElement.textContent = isApplying ? "Applying…" : title;
  }

  setUsedDiscountCodes(codes) {
    const { items } = this.elements;
    if (!items) return;

    const appliedCodes = new Set(
      (codes || []).map((code) => String(code).trim().toLowerCase()),
    );

    items.querySelectorAll("[data-discount-code]").forEach((button) => {
      const buttonCodes = [
        button.dataset.discountCode,
        button.dataset.discountTitle,
      ].map((code) =>
        String(code || "")
          .trim()
          .toLowerCase(),
      );
      const isUsed = buttonCodes.some((code) => appliedCodes.has(code));
      button.classList.toggle("customer-discounts__item--used", isUsed);
      button.setAttribute("aria-pressed", isUsed ? "true" : "false");
    });
  }

  setReadyToShipButtonState(button, isInCart) {
    if (!button) return;

    button.classList.toggle("customer-discounts__item--active", isInCart);
    button.disabled = isInCart;
    button.setAttribute("aria-pressed", isInCart ? "true" : "false");
  }

  syncReadyToShipButtonState() {
    window.requestAnimationFrame(() => {
      const { items } = this.elements;
      if (!items) return;

      const hasReadyToShipCartLine = this.hasReadyToShipCartLine();
      const readyToShipItem = items.querySelector(
        "[data-ready-to-ship-cart-item]",
      );

      if (hasReadyToShipCartLine && !readyToShipItem) {
        items.insertAdjacentHTML("beforeend", this.renderReadyToShipItem());
        this.setStatus("");
      } else if (!hasReadyToShipCartLine && readyToShipItem) {
        readyToShipItem.remove();
      }

      if (
        !hasReadyToShipCartLine &&
        !items.querySelector("[data-discount-code]")
      ) {
        this.setStatus(
          this.discountLoadFailed
            ? "Unable to load discounts."
            : "No discounts found.",
        );
      }

      requestAnimationFrame(() => this.updateScrollButtons());
    });
  }

  appendDiscount(discount) {
    const { items } = this.elements;
    const code = discount?.discountCode;
    if (!items || !code) return false;

    const existingItem = items.querySelector(
      `[data-discount-code="${CSS.escape(code)}"]`,
    );
    if (!existingItem) {
      items.insertAdjacentHTML(
        "beforeend",
        this.renderDiscountItem(discount, items.children.length),
      );
    }

    items.scrollTo({ left: items.scrollWidth, behavior: "smooth" });
    requestAnimationFrame(() => this.updateScrollButtons());
    return true;
  }

  async applyAndSelectDiscount(code, button = null) {
    this.setStatus("");
    this.setApplyingDiscount(button, true);
    this.setApplyingState(true);

    try {
      const cart = await this.applyDiscountCode(code);
      this.setUsedDiscountCodes(this.getAppliedDiscountCodes(cart));
      this.setStatus("");
      document.dispatchEvent(
        new CustomEvent("cart:refresh", {
          detail: { discountCode: code },
        }),
      );
      return true;
    } catch (error) {
      console.error("Failed to apply discount code", error);
      this.setStatus("Unable to apply discount.");
      return false;
    } finally {
      this.setApplyingDiscount(button, false);
      this.setApplyingState(false);
    }
  }

  async removeDiscountCode() {
    this.setStatus("Removing discount...");
    this.setApplyingState(true);

    try {
      await this.applyDiscountCode("");
      this.setUsedDiscountCodes([]);
      this.setStatus("");
      document.dispatchEvent(
        new CustomEvent("cart:refresh", {
          detail: { discountCode: "" },
        }),
      );
    } catch (error) {
      console.error("Failed to remove discount code", error);
      this.setStatus("Unable to remove discount.");
    } finally {
      this.setApplyingState(false);
    }
  }

  async handleDiscountClick(event) {
    const button = event.target.closest("[data-discount-code]");
    if (!button || !this.contains(button)) return;

    const code = button.dataset.discountCode;
    if (!code) return;

    if (button.classList.contains("customer-discounts__item--used")) {
      await this.removeDiscountCode();
      return;
    }

    await this.applyAndSelectDiscount(code, button);
  }

  async handleReadyToShipClick(event) {
    const button = event.target.closest("[data-ready-to-ship-variant-id]");
    if (!button || !this.contains(button) || button.disabled) return;

    const variantId = button.dataset.readyToShipVariantId;
    if (!variantId) return;

    const titleElement = button.querySelector(
      "[data-ready-to-ship-title-text]",
    );
    const title =
      button.dataset.readyToShipTitle ||
      titleElement?.textContent ||
      "Ready-to-Ship item";

    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    if (titleElement) titleElement.textContent = "Adding…";
    this.setStatus("");

    try {
      await this.addReadyToShipVariant(variantId);
      this.setReadyToShipButtonState(button, true);
      this.setStatus("");
      document.dispatchEvent(
        new CustomEvent("cart:refresh", {
          detail: { readyToShipVariantId: variantId },
        }),
      );
    } catch (error) {
      console.error("Failed to add Ready-to-Ship item", error);
      this.setStatus("Unable to add Ready-to-Ship item.");
    } finally {
      if (!button.classList.contains("customer-discounts__item--active")) {
        button.disabled = false;
      }
      button.removeAttribute("aria-busy");
      if (titleElement) titleElement.textContent = title;
    }
  }

  async syncUsedDiscountFromCart() {
    try {
      const cart = await this.getCart();
      this.setUsedDiscountCodes(this.getAppliedDiscountCodes(cart));
      this.syncReadyToShipButtonState();
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
    this.setDiscountsLoading(true);

    const discountResult = await this.getDiscounts().then(
      (value) => ({ status: "fulfilled", value }),
      (reason) => ({ status: "rejected", reason }),
    );
    const discounts =
      discountResult.status === "fulfilled"
        ? this.normalizeDiscountsResponse(discountResult.value)
        : [];
    const hasReadyToShipCartLine = this.hasReadyToShipCartLine();
    this.discountLoadFailed = discountResult.status === "rejected";

    if (discountResult.status === "rejected") {
      console.error(
        "Failed to render customer discounts",
        discountResult.reason,
      );
    }

    if (items) {
      const itemMarkup = [
        ...discounts.map((discount, index) =>
          this.renderDiscountItem(discount, index),
        ),
        ...(hasReadyToShipCartLine
          ? [this.renderReadyToShipItem()]
          : []),
      ].join("");

      items.innerHTML = itemMarkup;
      this.setDiscountsLoading(false);
    }

    if (!discounts.length && !hasReadyToShipCartLine) {
      this.setStatus(
        discountResult.status === "rejected"
          ? "Unable to load discounts."
          : "No discounts found.",
      );
    } else {
      this.setStatus("");
      await this.syncUsedDiscountFromCart();
    }

    requestAnimationFrame(() => this.updateScrollButtons());
  }

  setPointRedeemMessage(type, message = "") {
    const { pointRedeemError, pointRedeemSuccess } = this.elements;
    if (pointRedeemError) pointRedeemError.textContent = "";
    if (pointRedeemSuccess) pointRedeemSuccess.textContent = "";

    const messageElement =
      type === "success" ? pointRedeemSuccess : pointRedeemError;
    if (messageElement) messageElement.textContent = message;
  }

  get isPointRedeemOpen() {
    return (
      this.elements.pointRedeemToggle?.getAttribute("aria-expanded") === "true"
    );
  }

  async getPointStats() {
    return window.customerPointStatStore.fetchData();
  }

  renderPointChoices(availablePoints) {
    const { pointRedeemChoices } = this.elements;
    if (!pointRedeemChoices) return;

    const choices = this.getPointChoices().filter(
      ({ points }) => points <= availablePoints,
    );
    pointRedeemChoices.setAttribute("aria-busy", "false");
    pointRedeemChoices.innerHTML = choices.length
      ? choices
          .map(
            ({ label, points }) => `
              <button type="submit" class="btn-point-submit" data-point-redeem-points="${points}" aria-label="Redeem ${points} points for ${this.escapeAttribute(label)} off">
                <span>${this.escapeHtml(label)} off</span>
                <small>${points} points</small>
              </button>
            `,
          )
          .join("")
      : '<p class="point-redeem-choices__empty">You do not have enough points to redeem a reward.</p>';
  }

  setPointRedeemOpen(isOpen) {
    const {
      pointRedeemForm,
      pointRedeemPanel,
      pointRedeemToggle,
      pointRedeemClose,
      pointRedeemChoices,
    } = this.elements;
    if (
      !pointRedeemForm ||
      !pointRedeemPanel ||
      !pointRedeemToggle ||
      !pointRedeemClose ||
      !pointRedeemChoices
    ) {
      return;
    }

    pointRedeemForm.classList.toggle("is-open", isOpen);
    pointRedeemPanel.classList.toggle("is-open", isOpen);
    pointRedeemPanel.setAttribute("aria-hidden", isOpen ? "false" : "true");
    pointRedeemToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    pointRedeemClose.hidden = !isOpen;
    pointRedeemClose.disabled = !isOpen;
    pointRedeemChoices.setAttribute("aria-hidden", isOpen ? "false" : "true");
    pointRedeemChoices.querySelectorAll("button").forEach((button) => {
      button.disabled = !isOpen;
    });

    if (isOpen) {
      requestAnimationFrame(() =>
        pointRedeemChoices.querySelector("button")?.focus(),
      );
    }
  }

  async handlePointRedeemToggleClick(event) {
    if (this.isPointRedeemOpen) return;

    event.preventDefault();
    this.setPointRedeemOpen(true);
    this.setPointRedeemMessage();
    const { pointRedeemChoices } = this.elements;
    if (pointRedeemChoices) {
      pointRedeemChoices.setAttribute("aria-busy", "true");
      pointRedeemChoices.innerHTML =
        '<p class="point-redeem-choices__empty">Loading available rewards...</p>';
    }

    try {
      const pointStats = await this.getPointStats();
      if (!this.isPointRedeemOpen) return;
      this.renderPointChoices(
        Math.max(0, Number(pointStats?.totalPoints) || 0),
      );
      requestAnimationFrame(() =>
        pointRedeemChoices?.querySelector("button")?.focus(),
      );
    } catch (error) {
      console.error("Failed to load available point rewards", error);
      if (pointRedeemChoices)
        pointRedeemChoices.setAttribute("aria-busy", "false");
      this.setPointRedeemMessage("error", "Unable to load available rewards.");
    }
  }

  handlePointRedeemCloseClick() {
    this.setPointRedeemOpen(false);
    this.elements.pointRedeemToggle?.focus();
  }

  handlePointRedeemKeydown(event) {
    if (event.key !== "Escape" || !this.isPointRedeemOpen) return;

    event.preventDefault();
    this.setPointRedeemOpen(false);
    this.elements.pointRedeemToggle?.focus();
  }

  setPointRedeemState(isSubmitting) {
    const { pointRedeemForm } = this.elements;
    if (!pointRedeemForm) return;

    const isDisabled = isSubmitting || !this.isPointRedeemOpen;
    pointRedeemForm.querySelectorAll("button").forEach((element) => {
      element.disabled = isDisabled;
    });
  }

  async handlePointRedeemSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const points = Number(event.submitter?.dataset.pointRedeemPoints);
    if (!Number.isFinite(points) || points <= 0) {
      this.setPointRedeemMessage("error", "Choose a reward to redeem.");
      return;
    }

    this.setPointRedeemMessage();
    this.setPointRedeemState(true);

    try {
      const response = await fetch(
        "/apps/sbrillet/api/customer/point-discount-codes",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ points }),
        },
      );
      const resJson = await response.json();

      if (!response.ok) {
        this.setPointRedeemMessage(
          "error",
          resJson.error || "Unable to redeem points.",
        );
        return;
      }

      const { discount } = resJson;
      this.appendDiscount(discount);
      const isApplied = await this.applyAndSelectDiscount(
        discount.discountCode,
      );
      this.setPointRedeemMessage(
        isApplied ? "success" : "error",
        isApplied
          ? "Discount code created and applied."
          : "Discount code created, but could not be applied.",
      );
      if (isApplied) this.setPointRedeemOpen(false);
      const pointStats = await window.customerPointStatStore.fetchData({
        force: true,
      });
      this.renderPointChoices(
        Math.max(0, Number(pointStats?.totalPoints) || 0),
      );
    } catch (error) {
      console.error("Failed to redeem points", error);
      this.setPointRedeemMessage("error", "Unable to redeem points.");
    } finally {
      this.setPointRedeemState(false);
    }
  }
}

class TierCartSparkleRewards extends HTMLElement {
  static tierThresholds = [
    { level: "SHINY", pointsRequired: 0 },
    { level: "STARLIGHT", pointsRequired: 100 },
    { level: "GALAXY", pointsRequired: 700 },
    { level: "ULTRA_GALAXY", pointsRequired: 1000 },
  ];

  connectedCallback() {
    if (this.dataset.initialized === "true") return;

    this.dataset.initialized = "true";
    this.scheduleRefreshBound = this.scheduleRefresh.bind(this);
    ["cart:updated", "cart:refresh", "cart:rendered"].forEach((eventName) => {
      document.addEventListener(eventName, this.scheduleRefreshBound);
    });
    this.restoreCachedView();
    this.render();
  }

  disconnectedCallback() {
    ["cart:updated", "cart:refresh", "cart:rendered"].forEach((eventName) => {
      document.removeEventListener(eventName, this.scheduleRefreshBound);
    });
    window.clearTimeout(this.refreshTimeout);
  }

  get elements() {
    return {
      panel: this.querySelector("[data-points-projection]"),
      projectedPoints: this.querySelector("[data-projected-points]"),
      summary: this.querySelector("[data-points-projection-summary]"),
      tierProgress: this.querySelector("[data-tier-progress]"),
      galaxyProgress: this.querySelector("[data-galaxy-progress]"),
      galaxyTrack: this.querySelector("[data-galaxy-track]"),
      galaxyFill: this.querySelector("[data-galaxy-progress-fill]"),
      galaxyMilestones: this.querySelector("[data-galaxy-milestones]"),
    };
  }

  get proxyPath() {
    const proxyPath = this.dataset.proxyPath || "/apps/sbrillet";
    return proxyPath.endsWith("/") ? proxyPath.slice(0, -1) : proxyPath;
  }

  get loyaltyConfig() {
    const configElement = this.querySelector("[data-loyalty-config]");
    if (!configElement) return { currentTier: null, nextTier: null };

    try {
      return JSON.parse(configElement.textContent || "{}");
    } catch (error) {
      console.error("Failed to parse loyalty configuration", error);
      return { currentTier: null, nextTier: null };
    }
  }

  normalizeMetafieldValue(metafield) {
    if (!metafield) return null;

    const value = metafield.value || metafield;
    if (typeof value !== "string") return value;

    try {
      return JSON.parse(value);
    } catch (error) {
      return value;
    }
  }

  getFetchedTierConfig(pointStats) {
    const sources = [
      pointStats,
      pointStats?.customer,
      pointStats?.metafields,
      pointStats?.customer?.metafields,
    ];
    const findConfig = (keys) =>
      this.normalizeMetafieldValue(
        sources
          .map((source) => keys.map((key) => source?.[key]).find(Boolean))
          .find(Boolean),
      );

    return {
      currentTier: findConfig([
        "loyalty_tier_config",
        "loyaltyTierConfig",
        "tierConfig",
        "currentTierConfig",
        "currentTier",
        "tier_config",
      ]),
      nextTier: findConfig([
        "loyalty_next_tier_config",
        "loyaltyNextTierConfig",
        "nextTierConfig",
        "nextTier",
        "next_tier_config",
      ]),
    };
  }

  async getCart() {
    const root = window.Shopify?.routes?.root || "/";
    const response = await fetch(`${root}cart.js`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok)
      throw new Error(response.statusText || "Failed to load cart");
    return response.json();
  }

  async getPointStats() {
    return window.customerPointStatStore.fetchData();
  }

  scheduleRefresh() {
    window.clearTimeout(this.refreshTimeout);
    this.refreshTimeout = window.setTimeout(() => this.render(), 100);
  }

  restoreCachedView() {
    const { panel } = this.elements;
    const cachedMarkup = TierCartSparkleRewards.lastResolvedPanelMarkup;
    if (!panel || !cachedMarkup) return;

    panel.innerHTML = cachedMarkup;
    panel.hidden = false;
  }

  cacheView() {
    const { panel } = this.elements;
    if (!panel) return;

    TierCartSparkleRewards.lastResolvedPanelMarkup = panel.innerHTML;
  }

  getTierIcon(config, level) {
    const iconKey = `${String(level || "").toLowerCase()}_star_level_icon`;
    return config?.[iconKey] || "";
  }

  getTierState(totalPoints) {
    const points = Math.max(0, Number(totalPoints) || 0);
    const tierIndex = TierCartSparkleRewards.tierThresholds.reduce(
      (resolvedIndex, tier, index) =>
        points >= tier.pointsRequired ? index : resolvedIndex,
      0,
    );

    return {
      current: TierCartSparkleRewards.tierThresholds[tierIndex],
      next: TierCartSparkleRewards.tierThresholds[tierIndex + 1] || null,
    };
  }

  renderTierRoute(projectedTotal, config) {
    const { tierProgress } = this.elements;
    if (!tierProgress) return;

    const points = Math.max(0, Number(projectedTotal) || 0);
    const { current: currentTier } = this.getTierState(points);

    tierProgress.innerHTML = TierCartSparkleRewards.tierThresholds
      .map((tier, index, tiers) => {
        const icon = this.getTierIcon(config, tier.level);
        const nextTier = tiers[index + 1];
        const isCurrentTier = tier.level === currentTier.level;
        const isCompletedTier = points >= tier.pointsRequired;
        const step = `<span class="tier-cart-sparkle-rewards__tier-step${
          isCurrentTier ? " is-current" : ""
        }${isCompletedTier ? " is-completed" : ""}"><img src="${icon}" alt=""></span>`;

        if (!nextTier) return step;

        const tierRange = nextTier.pointsRequired - tier.pointsRequired;
        const fillPercentage = Math.min(
          100,
          Math.max(0, ((points - tier.pointsRequired) / tierRange) * 100),
        );
        const segment = `<span class="tier-cart-sparkle-rewards__tier-segment" style="--tier-segment-span: ${tierRange}"><span class="tier-cart-sparkle-rewards__tier-segment-fill" style="width: ${fillPercentage}%"></span></span>`;

        return `${step}${segment}`;
      })
      .join("");
  }

  renderGalaxyMilestones(projectedTotal, config) {
    const { galaxyProgress, galaxyTrack, galaxyFill, galaxyMilestones } =
      this.elements;
    if (!galaxyProgress || !galaxyMilestones || !galaxyFill) return null;

    const milestones = [
      { amount: "$5", points: 100 },
      { amount: "$10", points: 200 },
      { amount: "$15", points: 300 },
      { amount: "$20", points: 400 },
      { amount: "$30", points: 500 },
      { amount: "$50", points: 750 },
    ];
    const highestMilestone = milestones[milestones.length - 1].points;
    const nextMilestone = milestones.find(
      ({ points }) => points > projectedTotal,
    );
    const progressPercentage = Math.min(
      100,
      (projectedTotal / highestMilestone) * 100,
    );

    // if (galaxyTrack && config?.galaxyBarStars) {
    //   galaxyTrack.style.backgroundImage = `url("${config.galaxyBarStars}")`;
    // }
    galaxyFill.style.width = `${progressPercentage}%`;
    galaxyMilestones.innerHTML = milestones
      .map(
        ({ amount, points }) =>
          `<span class="tier-cart-sparkle-rewards__milestone${
            projectedTotal >= points ? " is-reached" : ""
          }">${
            config?.pointStarIcon
              ? `<img class="tier-cart-sparkle-rewards__milestone-icon" src="${config.pointStarIcon}" alt="" aria-hidden="true">`
              : ""
          }<span>${amount}</span></span>`,
      )
      .join("");
    galaxyProgress.hidden = false;
    return nextMilestone;
  }

  async render() {
    const { panel, projectedPoints, summary, tierProgress, galaxyProgress } =
      this.elements;
    if (!panel) return;

    panel.setAttribute("aria-busy", "true");
    try {
      const [cart, pointStats] = await Promise.all([
        this.getCart(),
        this.getPointStats(),
      ]);
      const fallbackConfig = this.getFetchedTierConfig(pointStats);
      const { currentTier: configuredCurrentTier } = this.loyaltyConfig;
      const currentTier = configuredCurrentTier?.level
        ? configuredCurrentTier
        : fallbackConfig.currentTier;
      const earningRate = Number(currentTier?.sparklesPerDollar);

      if (!Number.isFinite(earningRate)) {
        throw new Error("Missing loyalty tier projection data");
      }

      const currentPoints = Number(pointStats?.totalPoints) || 0;
      const earnedPoints = Math.floor(
        (Math.max(0, Number(cart?.total_price) || 0) * earningRate) / 100,
      );
      const projectedTotal = currentPoints + earnedPoints;
      const tierState = this.getTierState(projectedTotal);
      const nextTier = tierState.next;
      const nextTierPoints = nextTier?.pointsRequired;
      const isTerminalTier = !nextTier;

      if (projectedPoints) projectedPoints.textContent = `+${earnedPoints}`;

      if (isTerminalTier) {
        if (tierProgress) tierProgress.hidden = true;
        const nextMilestone = this.renderGalaxyMilestones(
          projectedTotal,
          this.loyaltyConfig,
        );
        if (summary) {
          summary.textContent = nextMilestone
            ? `You will have ${projectedTotal} Sparkles - ${Math.max(0, nextMilestone.points - projectedTotal)} left for ${nextMilestone.amount} OFF`
            : `You will have ${projectedTotal} Sparkles - all cash rewards unlocked`;
        }
      } else {
        if (!nextTier?.level || !Number.isFinite(nextTierPoints)) {
          throw new Error("Missing next tier projection data");
        }

        if (galaxyProgress) galaxyProgress.hidden = true;
        if (tierProgress) tierProgress.hidden = false;
        this.renderTierRoute(projectedTotal, this.loyaltyConfig);
        if (summary) {
          summary.textContent = `You will have ${projectedTotal} Sparkles - ${Math.max(
            0,
            nextTierPoints - projectedTotal,
          )} left to reach ${nextTier.level}`;
        }
      }
      panel.hidden = false;
      this.cacheView();
    } catch (error) {
      console.error("Failed to render Sparkle Point projection", error);
      panel.hidden = false;
    } finally {
      panel.setAttribute("aria-busy", "false");
    }
  }
}

class AppCustomerTotalSparkles extends HTMLElement {
  connectedCallback() {
    this.unsubscribecustomerPointStatStore =
      window.customerPointStatStore.subscribe((state) => {
        this.renderSparklePoints(state);
      });

    this.renderSparklePoints(window.customerPointStatStore.getState());

    window.customerPointStatStore.fetchData();
  }
  disconnectedCallback() {
    this.unsubscribecustomerPointStatStore?.();
  }
  renderSparklePoints(pointState) {
    if (pointState.loading) {
      return;
    }
    if (!pointState.data) {
      return;
    }
    const elPoints = this.querySelector("[data-total-sparkle-points]");
    elPoints.textContent = pointState?.data?.totalPoints || 0;
  }
}
class AppCustomerTotalRedeemedSparkles extends HTMLElement {
  connectedCallback() {
    this.unsubscribecustomerPointStatStore =
      window.customerPointStatStore.subscribe((state) => {
        this.renderSparklePoints(state);
      });

    this.renderSparklePoints(window.customerPointStatStore.getState());

    window.customerPointStatStore.fetchData();
  }
  disconnectedCallback() {
    this.unsubscribecustomerPointStatStore?.();
  }
  renderSparklePoints(pointState) {
    if (pointState.loading) {
      return;
    }
    if (!pointState.data) {
      return;
    }
    const elPoints = this.querySelector("[data-total-sparkles-spent]");
    elPoints.textContent = pointState?.data?.totalRedeemed || 0;
  }
}

window.customerPointStatStore ??= new CustomerPointStatStore();
window.SBrilletCustomerPointHistory ??= new CustomerPointHistoryApi();
window.SBrilletTopVotedProductsStore ??= new SBrilletTopVotedProductsStore();

if (!customElements.get("customer-discount-list")) {
  customElements.define("customer-discount-list", BlockCustomerDiscounts);
}

if (!customElements.get("tier-cart-sparkle-rewards")) {
  customElements.define("tier-cart-sparkle-rewards", TierCartSparkleRewards);
}

if (!customElements.get("app-customer-total-sparkles")) {
  customElements.define(
    "app-customer-total-sparkles",
    AppCustomerTotalSparkles,
  );
}

if (!customElements.get("app-customer-redeemed-sparkles")) {
  customElements.define(
    "app-customer-redeemed-sparkles",
    AppCustomerTotalRedeemedSparkles,
  );
}
