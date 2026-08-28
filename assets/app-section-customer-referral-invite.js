class CustomerReferralInvite extends HTMLElement {
  connectedCallback() {
    if (this.dataset.initialized === "true") return;

    this.dataset.initialized = "true";

    if (this.isDesignMode) {
      this.renderPreview();
      return;
    }

    this.acceptInvite();
  }

  get panel() {
    return this.querySelector("[data-referral-invite-panel]");
  }

  get isDesignMode() {
    return this.dataset.designMode === "true";
  }

  get setting() {
    return {
      proxyPath: this.dataset.proxyPath || "/apps/sbrillet/api/customer/referral-accept",
      eyebrow: this.dataset.eyebrow || "SBrillet rewards",
      description: this.dataset.description || "Your referral invitation is ready to be confirmed.",
      title: this.dataset.title || "Referral Invite",
      loadingLabel: this.dataset.loadingLabel || "Checking referral invite",
      successLabel: this.dataset.successLabel || "Invitation accepted successfully.",
      loginLabel: this.dataset.loginLabel || "Sign in to accept this referral invite.",
      errorLabel: this.dataset.errorLabel || "Referral invite could not be accepted.",
      buttonLabel: this.dataset.buttonLabel || "",
      buttonUrl: this.dataset.buttonUrl || "",
    };
  }

  proxyUrl(code) {
    const url = new URL(this.setting.proxyPath, window.location.origin);
    url.searchParams.set("code", code);
    return url.toString();
  }

  async acceptInvite() {
    const code = new URL(window.location.href).searchParams.get("code") || "";

    if (!code) {
      this.renderMessage(this.setting.errorLabel, "error");
      return;
    }

    this.renderLoading();

    try {
      const response = await fetch(this.proxyUrl(code), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({code}),
      });
      const payload = await response.json();

      if (response.status === 401) {
        this.redirectToLogin();
        return;
      }

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.message || this.setting.errorLabel);
      }

      this.renderMessage(payload?.message || this.setting.successLabel, "success");
    } catch (error) {
      console.error(error);
      this.renderMessage(error.message || this.setting.errorLabel, "error");
    }
  }

  redirectToLogin() {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    const loginUrl = new URL("/customer_authentication/login", window.location.origin);
    loginUrl.searchParams.set("return_to", returnTo);
    window.location.assign(loginUrl.toString());
  }

  renderPreview() {
    switch (this.dataset.previewState) {
      case "loading":
        this.renderLoading();
        break;
      case "login":
        this.renderMessage(this.setting.loginLabel, "login");
        break;
      case "error":
        this.renderMessage(this.setting.errorLabel, "error");
        break;
      default:
        this.renderMessage(this.setting.successLabel, "success");
    }
  }

  renderLoading() {
    if (!this.panel) return;

    const state = document.createElement("div");
    state.className = "customer-referral-invite__state";
    state.setAttribute("role", "status");
    state.setAttribute("aria-live", "polite");

    const spinner = document.createElement("span");
    spinner.className = "customer-referral-invite__spinner";
    spinner.setAttribute("aria-hidden", "true");

    const text = document.createElement("span");
    text.textContent = this.setting.loadingLabel;

    state.append(spinner, text);
    this.panel.replaceChildren(state);
  }

  renderMessage(message, state) {
    if (!this.panel) return;

    const content = document.createElement("div");
    content.className = "customer-referral-invite__content";

    const icon = document.createElement("span");
    icon.className = "customer-referral-invite__icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = state === "success" ? "✓" : state === "login" ? "↗" : "!";
    if (state === "error") icon.classList.add("customer-referral-invite__icon--error");

    const eyebrow = document.createElement("p");
    eyebrow.className = "customer-referral-invite__eyebrow";
    eyebrow.textContent = this.setting.eyebrow;

    const title = document.createElement("h2");
    title.className = "customer-referral-invite__title";
    title.textContent = this.setting.title;

    const description = document.createElement("p");
    description.className = "customer-referral-invite__description";
    description.textContent = this.setting.description;

    const text = document.createElement("p");
    text.className = "customer-referral-invite__message";
    if (state === "error") text.classList.add("customer-referral-invite__message--error");
    text.textContent = message;

    content.append(icon, eyebrow, title, description, text);
    const button = this.createButton();
    if (button) content.append(button);
    this.panel.replaceChildren(content);
  }

  createButton() {
    if (!this.setting.buttonLabel || !this.setting.buttonUrl) return null;

    const button = document.createElement("a");
    button.className = "customer-referral-invite__button";
    button.href = new URL(this.setting.buttonUrl, window.location.origin).toString();
    button.textContent = this.setting.buttonLabel;
    return button;
  }
}

function preserveLoginReturnPath() {
  document.querySelectorAll("[data-referral-login-gate] [data-login-return-link]").forEach((link) => {
    const loginUrl = new URL(link.getAttribute("href"), window.location.origin);
    loginUrl.searchParams.set(
      "return_to",
      `${window.location.pathname}${window.location.search}`,
    );
    link.href = loginUrl.toString();
  });
}

preserveLoginReturnPath();

if (!customElements.get("customer-referral-invite")) {
  customElements.define("customer-referral-invite", CustomerReferralInvite);
}
