class CustomerOrderReturnList extends HTMLElement {
  connectedCallback() {
    if (this.dataset.initialized === "true") return;

    this.dataset.initialized = "true";
    if (this.dataset.designMode === "true") {
      this.renderReturns(this.previewReturns());
      return;
    }

    this.loadReturns().then(() => {});
  }

  get setting() {
    return {
      proxyPath: this.dataset.proxyPath || "/apps/sbrillet/api/customer/return-orders",
      loadingLabel: this.dataset.loadingLabel || "Loading return orders",
      loginMessage: this.dataset.loginMessage || "Sign in to view your returns.",
      errorMessage: this.dataset.errorMessage || "Return orders could not be loaded.",
      emptyMessage: this.dataset.emptyMessage || "No returns yet.",
    };
  }

  get state() {
    return this.querySelector("[data-return-state]");
  }

  get count() {
    return this.querySelector("[data-return-count]");
  }

  get items() {
    return this.querySelector("[data-return-items]");
  }

  proxyUrl() {
    return new URL(this.setting.proxyPath, window.location.origin).toString();
  }

  async loadReturns() {
    this.renderSkeleton();

    try {
      const response = await fetch(this.proxyUrl(), {
        headers: { Accept: "application/json" },
      });

      if (response.status === 401) {
        this.renderMessage(this.setting.loginMessage, "error");
        return;
      }

      const payload = await response.json();
      if (!response.ok || payload?.ok === false || !Array.isArray(payload?.returns)) {
        throw new Error(payload?.error || "Return orders request failed.");
      }

      this.renderReturns(payload.returns);
    } catch (error) {
      console.error(error);
      this.renderMessage(this.setting.errorMessage, "error");
    }
  }

  renderSkeleton() {
    this.setState(this.setting.loadingLabel, "loading");
    if (!this.items) return;

    this.items.replaceChildren(
			this.createSkeletonCard(),
			// this.createSkeletonCard(),
			// this.createSkeletonCard(),
		);
  }

  renderReturns(returns) {
    if (!returns.length) {
      this.setCount(0);
      this.renderMessage(this.setting.emptyMessage);
      return;
    }

    this.setState("");
    this.setCount(returns.length);
    this.items?.replaceChildren(this.createReturnList(returns));
  }

  renderMessage(message, type = "") {
    this.setState(message, type);
    this.items?.replaceChildren();
  }

  createReturnList(returns) {
    const list = document.createElement("div");
    list.className = "customer-return-list";
    list.setAttribute("role", "list");

    returns.forEach((returnOrder) => {
      list.append(this.createReturnCard(returnOrder));
    });

    return list;
  }

  createReturnCard(returnOrder) {
    const article = document.createElement("article");
    article.className = "return-card";
    article.setAttribute("role", "listitem");

    const header = document.createElement("div");
    header.className = "return-card__header";

    const identity = document.createElement("div");
    identity.className = "return-card__identity";

    const label = document.createElement("p");
    label.className = "return-card__label";
    label.textContent = "Return";

    const titleRow = document.createElement("div");
    titleRow.className = "return-card__title-row";

    const title = document.createElement("h3");
    title.className = "return-card__title";
    title.textContent = returnOrder.name || "Return";

    const orderName = document.createElement("span");
    orderName.className = "return-card__order-name";
    orderName.textContent = returnOrder.orderName || "Order";

    titleRow.append(title, orderName);

    const meta = document.createElement("p");
    meta.className = "return-card__date";
    meta.textContent = `Submitted ${this.formatDate(returnOrder.createdAt)}`;

    identity.append(label, titleRow, meta);

    const statuses = document.createElement("div");
    statuses.className = "return-card__statuses";
    statuses.setAttribute("aria-label", "Return status");
    statuses.append(this.createStatusBadge(returnOrder.statusLabel || "Pending"));

    header.append(identity, statuses);

    const details = document.createElement("dl");
    details.className = "return-card__details";
    details.append(
      this.createDetail("Order", returnOrder.orderName || "Pending"),
      this.createDetail("Items", this.itemCountLabel(returnOrder.totalQuantity)),
      this.createDetail("Date", this.formatDate(returnOrder.createdAt)),
      this.createDetail("Reason", returnOrder.lineItems?.[0]?.reason || "Return requested"),
    );

    article.append(header, details);

    if (returnOrder.orderStatusPageUrl) {
      const action = document.createElement("div");
      action.className = "return-card__action";
      action.append(this.createAction(returnOrder.orderStatusPageUrl, "View return"));
      article.append(action);
    }

    return article;
  }

  createStatusBadge(label) {
    const badge = document.createElement("span");
    badge.className = "return-card__badge";
    badge.textContent = label;
    return badge;
  }

  createDetail(label, value) {
    const wrap = document.createElement("div");
    wrap.className = "return-card__detail";

    const dt = document.createElement("dt");
    dt.textContent = label;

    const dd = document.createElement("dd");
    dd.textContent = value;

    wrap.append(dt, dd);
    return wrap;
  }

  createAction(url, label) {
    if (!url) {
      const unavailable = document.createElement("span");
      unavailable.className = "return-card__unavailable";
      unavailable.textContent = "Unavailable";
      return unavailable;
    }

    const link = document.createElement("a");
    link.className = "return-card__button";
    link.href = url;
    link.textContent = label;
    return link;
  }

  createSkeletonCard() {
    const list = document.createElement("div");
    list.className = "customer-return-list customer-return-list--skeleton";
    list.setAttribute("aria-hidden", "true");

    for (let index = 0; index < 3; index += 1) {
      const article = document.createElement("article");
      article.className = "return-card return-card--skeleton";
      article.innerHTML = `
        <div class="return-card__header">
          <div class="return-card__identity">
            <span class="skeleton-block skeleton-label"></span>
            <span class="skeleton-block skeleton-title"></span>
            <span class="skeleton-block skeleton-date"></span>
          </div>
          <span class="skeleton-block skeleton-badge"></span>
        </div>
        <div class="return-card__details">
          <span class="skeleton-block skeleton-detail"></span>
          <span class="skeleton-block skeleton-detail"></span>
          <span class="skeleton-block skeleton-detail"></span>
          <span class="skeleton-block skeleton-detail"></span>
        </div>
      `;
      list.append(article);
    }

    return list;
  }

  itemCountLabel(count = 0) {
    return `${count} ${count === 1 ? "item" : "items"}`;
  }

  previewReturns() {
    return [30, 0, 30, 0, 30].map((days, index) => ({
      id: `preview-return-${index}`,
      name: `Return #R100${index + 1}`,
      orderName: "#SB-10482",
      orderStatusPageUrl: days > 0 ? "#" : "",
      statusLabel: "Delivered",
      createdAt: "2025-02-10T00:00:00Z",
      totalQuantity: index + 1,
      lineItems: [
        {
          title: "Sbrillet pendant",
          reason: `${days} Days Return Window`,
          image: null,
        },
      ],
    }));
  }

  formatDate(value) {
    if (!value) return "Date pending";

    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  }

  setState(message = "", type = "") {
    if (!this.state) return;

    this.state.textContent = message;
    this.state.hidden = !message;
    this.state.dataset.state = type;
  }

  setCount(count = 0) {
    if (!this.count) return;

    const label = `${count} ${count === 1 ? "return" : "returns"}`;
    this.count.textContent = label;
    this.count.hidden = false;
  }
}

if (!customElements.get("block-customer-order-return-list")) {
  customElements.define("block-customer-order-return-list", CustomerOrderReturnList);
}
