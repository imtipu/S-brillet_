class CustomerReferralInvite extends HTMLElement {
    connectedCallback() {
        if (this.dataset.initialized === "true") return;

        this.dataset.initialized = "true";
        this.acceptInvite().then(r => r);
    }

    get panel() {
        return this.querySelector("[data-referral-invite-panel]");
    }

    get setting() {
        return {
            proxyPath: this.dataset.proxyPath || "/apps/sbrillet/api/customer/referral-accept",
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
            this.renderMessage(this.setting.errorLabel, true);
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
                body: JSON.stringify({ code }),
            });
            const payload = await response.json();

            if (response.status === 401) {
                this.renderMessage(payload?.message || this.setting.loginLabel);
                return;
            }

            if (!response.ok || payload?.ok === false) {
                throw new Error(payload?.message || this.setting.errorLabel);
            }

            this.renderMessage(payload?.message || this.setting.successLabel);
        } catch (error) {
            console.error(error);
            this.renderMessage(error.message || this.setting.errorLabel, true);
        }
    }

    renderLoading() {
        if (!this.panel) return;

        const state = document.createElement("div");
        state.className = "customer-referral-invite__state";

        const spinner = document.createElement("span");
        spinner.className = "customer-referral-invite__spinner";
        spinner.setAttribute("aria-hidden", "true");

        const text = document.createElement("span");
        text.textContent = this.setting.loadingLabel;

        state.append(spinner, text);
        this.panel.replaceChildren(state);
    }

    renderMessage(message, isError = false) {
        if (!this.panel) return;

        const content = document.createElement("div");
        content.className = "customer-referral-invite__content";

        const title = document.createElement("h2");
        title.className = "customer-referral-invite__title";
        title.textContent = this.setting.title;

        const text = document.createElement("p");
        text.className = "customer-referral-invite__message";
        if (isError) {
            text.classList.add("customer-referral-invite__message--error");
        }
        text.textContent = message;

        content.append(title, text);
        const button = this.createButton();
        if (button) {
            content.appendChild(button);
        }
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

if (!customElements.get("customer-referral-invite")) {
    customElements.define("customer-referral-invite", CustomerReferralInvite);
}
