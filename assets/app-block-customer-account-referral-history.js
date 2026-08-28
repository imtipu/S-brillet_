class AppBlockCustomerAccountReferralHistory extends HTMLElement {
  connectedCallback() {
    if (this.dataset.initialized === "true") return;

    this.dataset.initialized = "true";
    this.renderReferralHistory();
  }

  get proxyUrl() {
    const proxyPath = this.dataset.proxyPath || "";
    return `${proxyPath}/api/customer/referral-history`;
  }

  get elements() {
    const table = this.querySelector("[data-list-table]");

    return {
      listContainer: this.querySelector("[data-list-container]"),
      table,
      tbody: this.querySelector("[data-referral-history-body]") || table?.querySelector("tbody"),
    };
  }

  async fetchReferralHistory() {
    const response = await fetch(this.proxyUrl, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.error || "Referral history request failed.");
    }

    const payload = await response.json();

    if (payload?.ok === false || !payload?.history) {
      throw new Error(payload?.error || "Referral history request failed.");
    }

    return payload.history;
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

  formatStatus(status) {
    if (!status) return "-";

    return String(status)
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  renderEmptyState(message) {
    const { listContainer, tbody } = this.elements;

    if (!tbody) return;

    if (listContainer) {
      listContainer.setAttribute("aria-busy", "false");
    }

    tbody.innerHTML = `
      <tr>
        <td class="referral-history-message" colspan="4">${this.escapeHtml(message)}</td>
      </tr>
    `;
  }

  buildReferralRow(referral) {
    const customerEmail = referral?.customer?.email || "No customer email";
    const code = referral?.code || "-";
    const status = this.formatStatus(referral?.status);
    const rewardPoints = referral?.rewardPoints ?? 0;

    return `
      <tr>
        <td>${this.escapeHtml(customerEmail)}</td>
        <td><span class="referral-history-code">${this.escapeHtml(code)}</span></td>
        <td><span class="referral-history-status">${this.escapeHtml(status)}</span></td>
        <td><span class="referral-history-points">${this.escapeHtml(rewardPoints)}</span></td>
      </tr>
    `;
  }

  async renderReferralHistory() {
    const { listContainer, tbody } = this.elements;

    if (!tbody) return;

    if (listContainer) {
      listContainer.setAttribute("aria-busy", "true");
    }

    try {
      const history = await this.fetchReferralHistory();
      const referrals = Array.isArray(history?.referrals) ? history.referrals : [];

      if (!referrals.length) {
        this.renderEmptyState("No referral history found.");
        return;
      }

      tbody.innerHTML = referrals.map((referral) => this.buildReferralRow(referral)).join("");

      if (listContainer) {
        listContainer.setAttribute("aria-busy", "false");
      }
    } catch (error) {
      this.renderEmptyState(error?.message || "Unable to load referral history.");
    }
  }
}

if (!customElements.get("customer-account-referral-history")) {
  customElements.define(
    "customer-account-referral-history",
    AppBlockCustomerAccountReferralHistory,
  );
}
