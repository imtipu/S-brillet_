import "@theme/motion";

class AppBlockCustomerAccountProfile extends HTMLElement {
  connectedCallback() {
    if (this.dataset.initialized === "true") {
      return;
    }

    this.dataset.initialized = "true";

    const addressCard = this.querySelector(".address-card");

    if (addressCard) {
      this.dataset.hasAddress = "true";
    } else {
      this.dataset.hasAddress = "false";
    }

    this.setupCollapsibles();
    this.setupProfileEditor();
    // this.renderProfileStats();

    // this.unsubscribecustomerPointStatStore =
    //   window.customerPointStatStore.subscribe((state) => {
    //     this.renderSparklePoints(state);
    //   });

    // this.renderSparklePoints(window.customerPointStatStore.getState());

    // window.customerPointStatStore.fetchData();
  }

  disconnectedCallback() {
    // this.unsubscribecustomerPointStatStore?.();
  }

  get proxyPath() {
    const proxyPath = this.dataset.proxyPath || "/apps/sbrillet";
    return proxyPath.endsWith("/") ? proxyPath.slice(0, -1) : proxyPath;
  }

  get currencyCode() {
    return this.dataset.currencyCode || "USD";
  }

  get customerAppMetafields() {
    const scriptEl = this.querySelector("[data-sbrillet-metafields-json]");
    if (scriptEl) {
      return JSON.parse(scriptEl.textContent);
    }

    return {
      loyalty_tier_config: null,
      loyalty_next_tier_config: null,
    };
  }

  setupCollapsibles() {
    const motion = globalThis.Motion;
    const sections = this.querySelectorAll("[data-collapsible]");

    if (!motion) return;

    const { animate } = motion;

    sections.forEach((section) => {
      const toggle = section.querySelector(".address-card__details-toggle");
      const content = section.querySelector(".address-card__details-content");

      if (!toggle || !content) {
        return;
      }

      toggle.addEventListener("click", async () => {
        const isOpen = section.classList.contains("is-open");

        if (isOpen) {
          section.classList.remove("is-open");
          toggle.setAttribute("aria-expanded", "false");
          content.style.overflow = "hidden";

          const animation = animate(
            content,
            {
              opacity: [1, 0],
              height: ["auto", 0],
            },
            {
              duration: 0.3,
              ease: "easeInOut",
            },
          );

          try {
            await animation.finished;
          } finally {
            content.hidden = true;
            content.style.overflow = "";
          }
        } else {
          content.hidden = false;
          toggle.setAttribute("aria-expanded", "true");
          section.classList.add("is-open");
          content.style.overflow = "hidden";

          const animation = animate(
            content,
            {
              opacity: [0, 1],
              y: [-30, 0],
              height: ["0", "auto"],
            },
            {
              duration: 0.3,
              ease: "easeInOut",
            },
          );

          try {
            await animation.finished;
          } finally {
            content.style.overflow = "";
          }
        }
      });
    });
  }

  setupProfileEditor() {
    const modal = this.querySelector("[data-profile-modal]");
    const openButton = this.querySelector("[data-open-profile-modal]");
    const form = this.querySelector("[data-profile-form]");
    const closeButtons = this.querySelectorAll("[data-close-profile-modal]");
    const message = this.querySelector("[data-profile-form-message]");
    const submitButton = this.querySelector("[data-profile-submit]");
    const modalCard = modal?.querySelector(
      ".customer-account-profile__modal-card",
    );
    const motion = globalThis.Motion;
    let isClosing = false;

    if (!modal || !openButton || !form) return;

    const closeModal = async () => {
      if (!modal.open || isClosing) return;
      isClosing = true;

      if (motion?.animate && modalCard) {
        const animation = motion.animate(
          modalCard,
          { opacity: [1, 0], y: [0, 12], scale: [1, 0.98] },
          { duration: 0.18, ease: "easeIn" },
        );
        await animation.finished.catch(() => {});
      }

      modal.close();
      isClosing = false;
      if (message) {
        message.textContent = "";
        message.className = "customer-account-profile__form-message";
      }
    };

    openButton.addEventListener("click", () => {
      modal.showModal();
      if (motion?.animate && modalCard) {
        motion.animate(
          modalCard,
          { opacity: [0, 1], y: [16, 0], scale: [0.98, 1] },
          { duration: 0.24, ease: "easeOut" },
        );
      }
    });
    closeButtons.forEach((button) =>
      button.addEventListener("click", () => closeModal()),
    );
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal();
    });
    modal.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeModal();
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;

      const formData = new FormData(form);
      const body = {
        firstName: formData.get("firstName")?.trim(),
        lastName: formData.get("lastName")?.trim(),
        email: formData.get("email")?.trim(),
        phone: formData.get("phone")?.trim(),
        dateOfBirth: formData.get("dateOfBirth") || null,
      };

      if (submitButton) submitButton.disabled = true;
      if (message) message.textContent = "Saving changes...";

      try {
        const response = await fetch(
          `${this.proxyPath}/api/customer/account-profile`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(body),
          },
        );
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.ok) {
          throw new Error(
            result.error ||
              (Array.isArray(result.errors) ? result.errors[0] : null) ||
              "Unable to update your profile.",
          );
        }

        const profile = { ...body, ...(result.profile || {}) };
        const name =
          profile.displayName ||
          [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
          profile.email;
        const nameElement = this.querySelector("[data-profile-name]");
        const emailElement = this.querySelector("[data-profile-email]");
        const phoneElement = this.querySelector("[data-profile-phone]");
        const avatarElement = this.querySelector("[data-profile-avatar]");
        const dateOfBirthInput = form.elements.dateOfBirth;
        const dateOfBirthLine = this.querySelector(
          "[data-profile-date-of-birth]",
        );
        const dateOfBirthValue = this.querySelector(
          "[data-profile-date-of-birth-value]",
        );
        if (nameElement) nameElement.textContent = name;
        if (emailElement)
          emailElement.textContent = profile.email || "Not provided";
        if (phoneElement)
          phoneElement.textContent = profile.phone || "No phone saved";
        if (avatarElement && name) {
          avatarElement.textContent = name.charAt(0).toUpperCase();
        }
        const dateOfBirth = profile.dateOfBirth?.slice(0, 10) || "";
        if (dateOfBirthInput) dateOfBirthInput.value = dateOfBirth;
        if (dateOfBirthLine && dateOfBirthValue) {
          if (dateOfBirth) {
            dateOfBirthValue.dateTime = dateOfBirth;
            dateOfBirthValue.textContent = new Intl.DateTimeFormat(undefined, {
              day: "numeric",
              month: "long",
              year: "numeric",
            }).format(new Date(`${dateOfBirth}T00:00:00`));
            dateOfBirthLine.hidden = false;
          } else {
            dateOfBirthLine.hidden = true;
          }
        }

        if (message) {
          message.textContent = "Profile updated successfully.";
          message.className =
            "customer-account-profile__form-message is-success";
        }
        window.setTimeout(closeModal, 700);
      } catch (error) {
        if (message) {
          message.textContent =
            error instanceof Error
              ? error.message
              : "Unable to update your profile.";
          message.className = "customer-account-profile__form-message is-error";
        }
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  }

  animateValue(element, end, formatter = (value) => value.toString()) {
    const duration = 900;
    const start = 0;
    const startTime = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * eased;
      element.textContent = formatter(current);

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  }
}

if (!customElements.get("block-customer-account-profile")) {
  customElements.define(
    "block-customer-account-profile",
    AppBlockCustomerAccountProfile,
  );
}
