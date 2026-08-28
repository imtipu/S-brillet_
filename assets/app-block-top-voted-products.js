class AppBlockTopVotedProducts extends HTMLElement {
    constructor() {
        super();
        this.products = [];
    }

    connectedCallback() {
        if (this.dataset.initialized === "true") return;

        this.dataset.initialized = "true";
        this.addEventListener("click", (event) => {
            const button = event.target.closest("[data-vote-button]");
            if (button) this.vote(button).then(r => r);
        });
        this.loadProducts().then(r => r);
    }

    get proxyUrl() {
        const path = this.dataset.proxyPath || "";
        return `${path}/api/top-voted-products`;
    }

    get voteUrl() {
        const path = this.dataset.proxyPath || "";
        return `${path}/api/customer/vote-product`;
    }

    get productListContent() {
        return this.querySelector("[data-product-list-content]");
    }

    get emptyState() {
        return this.querySelector("[data-empty-state]");
    }

    get tierIcons() {
        return Array.from(this.querySelectorAll("template[data-tier-icon]")).reduce((icons, template) => {
            icons[template.dataset.tierIcon] = template.innerHTML.trim();
            return icons;
        }, {});
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

    setLoadingState(isLoading) {
        const content = this.productListContent;

        if (content) {
            content.setAttribute("aria-busy", String(isLoading));
        }
    }

    showEmptyState(message) {
        const content = this.productListContent;
        const emptyState = this.emptyState;

        if (content) {
            content.innerHTML = "";
            content.hidden = true;
        }

        if (emptyState) {
            emptyState.textContent = message;
            emptyState.hidden = false;
        }
    }

    getNoImagePlaceholder() {
        return `
      <svg viewBox="0 0 80 80" fill="none" aria-hidden="true">
        <path d="M18 58L32 42L43 53L50 45L62 58H18Z" fill="currentColor" opacity="0.22"></path>
        <rect x="16" y="18" width="48" height="44" rx="8" stroke="currentColor" stroke-width="3"></rect>
        <circle cx="49" cy="31" r="5" fill="currentColor" opacity="0.32"></circle>
      </svg>
    `;
    }

    getProducts(payload) {
        if (Array.isArray(payload?.products)) return payload.products;
        if (Array.isArray(payload?.data?.products)) return payload.data.products;
        if (Array.isArray(payload?.topVotedProducts)) return payload.topVotedProducts;
        if (Array.isArray(payload)) return payload;

        return [];
    }

    findProductIndex(productId) {
        return this.products.findIndex(
            (item) => String(item.id || item.gid || "") === String(productId),
        );
    }

    updateProduct(product) {
        const productId = String(product?.id || product?.gid || "");
        const index = this.findProductIndex(productId);

        if (!productId || index === -1) return;

        this.products[index] = {...this.products[index], ...product};
        const card = Array.from(this.querySelectorAll("[data-product-card]")).find(
            (item) => item.dataset.productId === productId,
        );

        if (card) {
            card.outerHTML = this.listItem(this.products[index]);
        }
    }

    tierCountMarkup(tierCounts = {}) {
        const icons = this.tierIcons;
        const tierOrder = ["SHINY", "STARLIGHT", "GALAXY", "ULTRA_GALAXY"];

        return tierOrder
            .filter((tier) => Number(tierCounts[tier] || 0) > 0)
            .map((tier) => {
                const icon = icons[tier] || "";
                const count = Number(tierCounts[tier] || 0);

                return `
          <span class="top-product-card__tier-count" aria-label="${this.escapeHtml(count)} votes">
            ${icon}
            <span>${this.escapeHtml(count)} ${count === 1 ? "Like" : "Likes"}</span>
          </span>
        `;
            })
            .join("");
    }

    likeButtonMarkup(product) {
        const iconUrl = this.dataset.iconThumbsUp;
        const isVoted = Boolean(product?.votedByCustomer);

        return `
      <button
        class="top-product-card__like-button${isVoted ? " is-voted" : ""}"
        type="button"
        data-vote-button
        data-product-id="${this.escapeHtml(product?.id || product?.gid || "")}"
        aria-pressed="${isVoted ? "true" : "false"}"
      >
<img src="${iconUrl}" alt="Thumbs up" width="20" height="20" />
        <span>${isVoted ? "Liked" : "Like"}</span>
      </button>
    `;
    }

    listItem(product) {
        const title = product?.title || "";
        const imageUrl = product?.imageUrl || product?.featuredImage?.url || "";
        const imageAlt = product?.imageAlt || title;
        const handle = product?.handle || "";
        const productUrl = product?.productUrl || (handle ? `/products/${handle}` : "#");
        const voteCount = Number(product?.voteCount || 0);
        const tierCounts = this.tierCountMarkup(product?.tierCounts || {});
        const likeButton = this.likeButtonMarkup(product);
        const iconUrl = this.dataset.iconThumbsUp || "";
        const imageMarkup = imageUrl
            ? `
        <img
          src="${this.escapeHtml(imageUrl)}"
          alt="${this.escapeHtml(imageAlt)}"
          loading="lazy"
        >
      `
            : `
        <span class="top-product-placeholder" aria-hidden="true">
          ${this.getNoImagePlaceholder()}
        </span>
      `;

        return `
      <article class="top-product-card" data-product-card data-product-id="${this.escapeHtml(product?.id || product?.gid || "")}">
        <a class="top-product-card__image" href="${this.escapeHtml(productUrl)}" aria-label="${this.escapeHtml(title)}">
          ${imageMarkup}
        </a>
        <div class="top-product-card__body">
          <a class="top-product-card__title-link" href="${this.escapeHtml(productUrl)}">
            <h3 class="top-product-card__title">${this.escapeHtml(title)}</h3>
          </a>
          <div class="top-product-card__stats">
            <span class="top-product-card__total" aria-label="${this.escapeHtml(voteCount)} ${voteCount === 1 ? "like" : "likes"}">
              <img class="top-product-card__like-total-icon" src="${this.escapeHtml(iconUrl)}" alt="" width="14" height="14">
              <span>${this.escapeHtml(voteCount)} ${voteCount === 1 ? "Like" : "Likes"}</span>
            </span>
            <span class="top-product-card__tier-counts">${tierCounts}</span>
          </div>
          ${likeButton}
        </div>
      </article>
    `;
    }

    renderData(payload) {
        const products = this.getProducts(payload);
        const content = this.productListContent;
        const emptyState = this.emptyState;

        if (!content) return;

        this.products = products;

        if (!products.length) {
            this.showEmptyState("No top voted products found yet.");
            return;
        }

        if (emptyState) {
            emptyState.hidden = true;
        }

        content.innerHTML = products.map((product) => this.listItem(product)).join("");
        content.hidden = false;
    }

    async vote(button) {
        const productId = button.dataset.productId;
        const product = this.products[this.findProductIndex(productId)];

        if (!product) return;

        const formData = new FormData();
        formData.append("productId", productId);

        button.disabled = true;
        button.classList.add("is-loading");
        button.querySelector("span").textContent = "Saving";

        try {
            const response = await fetch(this.voteUrl, {
                method: "POST",
                body: formData,
                headers: {Accept: "application/json"},
                credentials: "same-origin",
            });
            const data = await response.json().catch(() => null);

            if (!response.ok || !data?.status || !data?.product) {
                throw new Error(data?.error || "Vote could not be saved.");
            }

            this.updateProduct(data.product);
        } catch (error) {
            button.disabled = false;
            button.classList.remove("is-loading");
            button.querySelector("span").textContent = button.getAttribute("aria-pressed") === "true" ? "Liked" : "Like";
            button.setAttribute("aria-label", error?.message || "Vote could not be saved.");
        }
    }

    async loadProducts() {
        this.setLoadingState(true);

        try {
            const response = await fetch(this.proxyUrl, {
                headers: {Accept: "application/json"},
                credentials: "same-origin",
            });

            if (!response.ok) {
                this.showEmptyState("Unable to load top voted products right now.");
                return;
            }

            const payload = await response.json().catch(() => null);
            this.renderData(payload);
        } catch (error) {
            this.showEmptyState("Unable to load top voted products right now.");
        } finally {
            this.setLoadingState(false);
        }
    }
}

if (!customElements.get("block-top-voted-products")) {
    customElements.define("block-top-voted-products", AppBlockTopVotedProducts);
}
