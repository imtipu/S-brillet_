class AppBlockCustomerAccountReferral extends HTMLElement {
  constructor() {
    super();
    this.handleCopyClick = this.handleCopyClick.bind(this);
    this.handleShareClick = this.handleShareClick.bind(this);
    this.copyResetTimeout = null;
  }
  connectedCallback() {
    this.bindEvents();
    this.loadProfile();
  }

  disconnectedCallback() {
    this.unbindEvents();

    if (this.copyResetTimeout) {
      window.clearTimeout(this.copyResetTimeout);
      this.copyResetTimeout = null;
    }
  }

  get proxyUrl() {
    const proxyPath = this.dataset.proxyPath;
    return `${proxyPath}/api/customer/referral-profile`;
  }

  get elements() {
    return {
      elReferralLink: this.querySelector("[data-referral-link]"),
      elReferralCount: this.querySelector("[data-referral-count]"),
      elRewardPointsEarned: this.querySelector("[data-reward-points-earned]"),
      elCopyButton: this.querySelector("[data-copy-referral-link]"),
      elShareButtons: this.querySelectorAll("[data-share-platform]"),
      elShareStatus: this.querySelector("[data-share-status]"),
    };
  }

  bindEvents() {
    const { elCopyButton, elShareButtons } = this.elements;

    if (elCopyButton) {
      elCopyButton.addEventListener("click", this.handleCopyClick);
    }

    elShareButtons.forEach((button) => {
      button.addEventListener("click", this.handleShareClick);
    });
  }

  unbindEvents() {
    const { elCopyButton, elShareButtons } = this.elements;

    if (elCopyButton) {
      elCopyButton.removeEventListener("click", this.handleCopyClick);
    }

    elShareButtons.forEach((button) => {
      button.removeEventListener("click", this.handleShareClick);
    });
  }

  async loadProfile() {
    try {
      const response = await fetch(this.proxyUrl, {
        headers: {
          Accept: "application/json",
        },
      });

      if (response.status === 401) {
        // this.renderMessage(this.setting.loginMessage);
        return;
      }

      const payload = await response.json();

      if (!response.ok || payload?.ok === false || !payload?.profile) {
        throw new Error(payload?.error || "Referral profile request failed.");
      }

      this.renderProfile(payload.profile);
    } catch (error) {
      console.error(error);
      //   this.renderMessage(this.setting.errorMessage, true);
    }
  }

  renderProfile(data) {
    const { elReferralLink, elReferralCount, elRewardPointsEarned } =
      this.elements;
    const referralCount = Number(data?.referralCount) || 0;
    const rewardPointsEarned = Number(data?.rewardPointsEarned) || 0;
    const referralLink = data?.referralLink || "";

    elReferralLink.textContent = referralLink;
    elReferralCount.textContent = referralCount;
    elRewardPointsEarned.textContent = rewardPointsEarned;
  }

  async handleCopyClick() {
    const { elReferralLink, elCopyButton } = this.elements;
    const referralLink = elReferralLink?.textContent?.trim();

    if (!elCopyButton || !referralLink) {
      return;
    }

    const originalLabel = elCopyButton.dataset.defaultLabel || elCopyButton.textContent;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(referralLink);
      } else {
        this.fallbackCopy(referralLink);
      }

      elCopyButton.textContent = "Copied";
      elCopyButton.classList.add("is-copied");

      if (this.copyResetTimeout) {
        window.clearTimeout(this.copyResetTimeout);
      }

      this.copyResetTimeout = window.setTimeout(() => {
        elCopyButton.textContent = originalLabel;
        elCopyButton.classList.remove("is-copied");
      }, 1800);
    } catch (error) {
      console.error(error);
    }
  }

  setShareStatus(message = "") {
    const { elShareStatus } = this.elements;
    if (elShareStatus) elShareStatus.textContent = message;
  }

  async copyReferralLink(referralLink) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(referralLink);
      return;
    }

    this.fallbackCopy(referralLink);
  }

  async handleShareClick(event) {
    event.preventDefault();

    const button = event.currentTarget;
    const platform = button?.dataset?.sharePlatform;
    const referralLink = this.elements.elReferralLink?.textContent?.trim();

    if (!platform || !referralLink) {
      return;
    }

    const encodedLink = encodeURIComponent(referralLink);
    let shareUrl;

    switch (platform) {
      case "facebook":
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedLink}`;
        break;
      case "whatsapp":
        shareUrl = `https://wa.me/?text=${encodedLink}`;
        break;
      case "instagram":
      case "tiktok":
        if (navigator.share) {
          try {
            await navigator.share({
              title: "Join me on SBrillet",
              text: "Join me and earn Sparkle Points!",
              url: referralLink,
            });
            this.setShareStatus("");
            return;
          } catch (error) {
            if (error?.name === "AbortError") return;
          }
        }

        try {
          await this.copyReferralLink(referralLink);
          this.setShareStatus("Referral link copied. Paste it into your post.");
        } catch (error) {
          console.error(error);
          this.setShareStatus("Unable to copy the referral link.");
        }

        shareUrl =
          platform === "instagram"
            ? "https://www.instagram.com/"
            : "https://www.tiktok.com/";
        break;
      default:
        return;
    }

    window.open(shareUrl, "_blank", "noopener,noreferrer");
  }

  fallbackCopy(value) {
    const input = document.createElement("textarea");
    input.value = value;
    input.setAttribute("readonly", "");
    input.style.position = "absolute";
    input.style.left = "-9999px";
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    document.body.removeChild(input);
  }
}

if (!customElements.get("block-customer-account-referral")) {
  customElements.define(
    "block-customer-account-referral",
    AppBlockCustomerAccountReferral,
  );
}
