class AppBlockVoteCollectionProducts extends HTMLElement {
  constructor() {
    super();
    this.products = new Map();
  }

  connectedCallback() {
    if (this.dataset.initialized === "true") return;

    this.dataset.initialized = "true";
    this.addEventListener("click", (event) => {
      const button = event.target.closest("[data-vote-button]");
      if (button) this.vote(button);
    });
    this.loadVoteData();
  }

  get productIds() {
    return Array.from(this.querySelectorAll("[data-product-card]"))
      .map((card) => card.dataset.productId)
      .filter(Boolean);
  }

  get metadataUrl() {
    const path = this.dataset.proxyPath || "";
    return `${path}/api/customer/vote-collection-products`;
  }

  get voteUrl() {
    const path = this.dataset.proxyPath || "";
    return `${path}/api/customer/vote-product`;
  }

  get tierIcons() {
    return Array.from(this.querySelectorAll("template[data-tier-icon]")).reduce(
      (icons, template) => {
        icons[template.dataset.tierIcon] = template.innerHTML.trim();
        return icons;
      },
      {},
    );
  }

  escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };

      return entities[character] || character;
    });
  }

  findCard(productId) {
    return Array.from(this.querySelectorAll("[data-product-card]")).find(
      (card) => card.dataset.productId === String(productId),
    );
  }

  tierCountMarkup(product) {
    const tierLikes = product?.tierLikes || product?.tierCounts || {};
    const icons = this.tierIcons;
    const tierOrder = [
      "SHINY",
      "STARLIGHT",
      "GALAXY",
      "ULTRA_GALAXY",
    ];

    return tierOrder
      .filter((tier) => Number(tierLikes[tier] || 0) > 0)
      .map((tier) => {
        const count = Number(tierLikes[tier] || 0);

        return `
          <span class="vote-collection-card__tier-count" aria-label="${this.escapeHtml(count)} ${count === 1 ? "tier like" : "tier likes"}">
            ${icons[tier] || ""}
            <span>${this.escapeHtml(count)}</span>
          </span>
        `;
      })
      .join("");
  }

  voteMarkup(product) {
    const totalLikes = Number(product?.totalLikes ?? product?.voteCount ?? 0);
    const isVoted = Boolean(product?.votedByCustomer);
    const likeIconUrl = this.dataset.iconThumbsUp || "";
    const unlikeIconUrl = this.dataset.iconThumbsDown || likeIconUrl;
    const buttonIconUrl = isVoted ? unlikeIconUrl : likeIconUrl;
    const tierCounts = this.tierCountMarkup(product);

    return `
      <div class="vote-collection-card__counts">
        <span class="vote-collection-card__total" aria-label="${this.escapeHtml(totalLikes)} ${totalLikes === 1 ? "like" : "likes"}">
          <img class="vote-collection-card__like-icon" src="${this.escapeHtml(likeIconUrl)}" alt="" width="14" height="14">
          <span>${this.escapeHtml(totalLikes)}</span>
        </span>
        ${tierCounts}
      </div>
      <button
        class="vote-collection-card__button${isVoted ? " is-voted" : ""}"
        type="button"
        data-vote-button
        data-product-id="${this.escapeHtml(product?.id || "")}"
        aria-pressed="${isVoted ? "true" : "false"}"
      >
        <img src="${this.escapeHtml(buttonIconUrl)}" alt="" width="16" height="16">
        <span>${isVoted ? "Liked" : "Like"}</span>
      </button>
    `;
  }

  renderProduct(product) {
    const productId = String(product?.id || "");
    const card = this.findCard(productId);
    const voteContent = card?.querySelector("[data-vote-content]");

    if (!voteContent) return;

    this.products.set(productId, product);
    voteContent.innerHTML = this.voteMarkup(product);
  }

  refreshTopVotedProducts() {
    const store = window.SBrilletTopVotedProductsStore;
    if (!store) return;

    store
      .fetchData({
        proxyPath: this.dataset.proxyPath || "/apps/sbrillet",
        force: true,
      })
      .catch(() => {});
  }

  async loadVoteData() {
    const productIds = this.productIds;

    if (!productIds.length) return;

    const formData = new FormData();
    formData.append("productIds", productIds.join(","));

    try {
      const response = await fetch(this.metadataUrl, {
        method: "POST",
        body: formData,
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok || !Array.isArray(data.products)) {
        throw new Error(data?.error || "Votes could not be loaded.");
      }

      data.products.forEach((product) => this.renderProduct(product));
    } catch (error) {
      this.querySelectorAll("[data-vote-content]").forEach((content) => {
        content.innerHTML = `<span class="vote-collection-card__loading">${this.escapeHtml(error?.message || "Votes unavailable")}</span>`;
      });
    }
  }

  async vote(button) {
    const productId = button.dataset.productId;

    if (!productId) return;

    const label = button.querySelector("span");
    const previousLabel = label?.textContent || "Like";
    const formData = new FormData();
    formData.append("productId", productId);

    button.disabled = true;
    if (label) label.textContent = "Saving";

    try {
      const response = await fetch(this.voteUrl, {
        method: "POST",
        body: formData,
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.status || !data?.product) {
        throw new Error(data?.error || "Vote could not be saved.");
      }

      this.renderProduct({
        ...data.product,
        totalLikes: data.totalLikes,
        tierLikes: data.tierLikes,
      });
      this.refreshTopVotedProducts();
    } catch (error) {
      button.disabled = false;
      if (label) label.textContent = responseStatusLabel(error, previousLabel);
      button.setAttribute(
        "aria-label",
        error?.message || "Vote could not be saved.",
      );
    }
  }
}

function responseStatusLabel(error, fallback) {
  if (
    String(error?.message || "")
      .toLowerCase()
      .includes("login")
  )
    return "Sign in";
  return fallback;
}

if (!customElements.get("block-vote-collection-products")) {
  customElements.define(
    "block-vote-collection-products",
    AppBlockVoteCollectionProducts,
  );
}
