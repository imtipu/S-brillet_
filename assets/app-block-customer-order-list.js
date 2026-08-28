class AppBlockCustomerOrderList extends HTMLElement {
  connectedCallback() {
    this.querySelectorAll("[data-order-warranty-modal]").forEach((modal) => {
      const orderId = modal.dataset.orderId;
      const orderCard = Array.from(this.querySelectorAll(".order-card")).find(
        (card) => card.dataset.order === orderId,
      );
      const openButton = orderCard?.querySelector("[data-open-warranty-modal]");
      const closeButton = modal.querySelector("[data-close-warranty-modal]");
      const itemsContainer = modal.querySelector("[data-warranty-items]");
      const warrantyJson = this.getOrderDataElement("[data-order-warranty-json]", orderId);
      const lineItems = Array.from(this.querySelectorAll("[data-order-line-item-json]"))
        .filter((element) => element.dataset.orderId === orderId)
        .map((element) => this.parseJson(element.textContent))
        .filter(Boolean);
      const warranties = this.parseWarrantyData(warrantyJson?.textContent);
      const modalCard = modal.querySelector(".order-warranty-modal__card");
      const motion = globalThis.Motion;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let isClosing = false;

      if (!openButton || !itemsContainer || !warranties.length) return;

      this.renderWarrantyItems(itemsContainer, warranties, lineItems);

      const closeModal = async () => {
        if (!modal.open || isClosing) return;
        isClosing = true;

        if (!reduceMotion && motion?.animate && modalCard) {
          const animation = motion.animate(
            modalCard,
            { opacity: [1, 0], y: [0, 14], scale: [1, 0.985] },
            { duration: 0.18, ease: "easeIn" },
          );
          await animation.finished.catch(() => {});
        }

        modal.close();
        isClosing = false;
      };

      openButton.addEventListener("click", () => {
        if (modal.open || isClosing) return;
        modal.showModal();

        if (!reduceMotion && motion?.animate && modalCard) {
          motion.animate(
            modalCard,
            { opacity: [0, 1], y: [18, 0], scale: [0.985, 1] },
            { duration: 0.24, ease: "easeOut" },
          );
          motion.animate(
            Array.from(itemsContainer.children),
            { opacity: [0, 1], y: [8, 0] },
            { duration: 0.2, delay: motion.stagger(0.045, { startDelay: 0.08 }), ease: "easeOut" },
          );
        }
      });
      closeButton?.addEventListener("click", closeModal);
      modal.addEventListener("click", (event) => {
        if (event.target === modal) closeModal();
      });
      modal.addEventListener("cancel", (event) => {
        event.preventDefault();
        closeModal();
      });
    });
  }

  parseWarrantyData(json) {
    const data = this.parseJson(json);
    return Array.isArray(data) ? data : [];
  }

  getOrderDataElement(selector, orderId) {
    return Array.from(this.querySelectorAll(selector)).find(
      (element) => element.dataset.orderId === orderId,
    );
  }

  parseJson(json) {
    try {
      return JSON.parse(json || "null");
    } catch (error) {
      return null;
    }
  }

  renderWarrantyItems(container, warranties, lineItems) {
    const formatDate = (value) => {
      if (!value) return "Not provided";
      const date = new Date(`${value}T00:00:00`);
      return Number.isNaN(date.getTime())
        ? value
        : new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long", day: "numeric" }).format(date);
    };

    warranties.forEach((entry) => {
      const lineItemId = String(entry?.lineItemId || "");
      const lineItemNumericId = lineItemId.split("/").pop();
      const item = lineItems.find(
        (lineItem) => String(lineItem.id) === lineItemId
          || lineItem.gid === lineItemId
          || String(lineItem.id) === lineItemNumericId,
      ) || entry?.lineItem || {};
      const image = item.image || {};
      const card = document.createElement("article");
      card.className = "order-warranty-item";

      // Head: thumbnail + title in one row
      const head = document.createElement("div");
      head.className = "order-warranty-item__head";

      if (image.url) {
        const media = document.createElement("div");
        media.className = "order-warranty-item__media";
        const imageElement = document.createElement("img");
        imageElement.className = "order-warranty-item__image";
        imageElement.src = image.url;
        imageElement.alt = image.altText || item.title || "";
        imageElement.loading = "lazy";
        media.append(imageElement);
        head.append(media);
      } else {
        const placeholder = document.createElement("div");
        placeholder.className = "order-warranty-item__placeholder";
        placeholder.setAttribute("aria-hidden", "true");
        const phText = document.createElement("div");
        phText.textContent = (item.title || "W").trim().charAt(0).toUpperCase();
        placeholder.append(phText);
        head.append(placeholder);
      }

      const headContent = document.createElement("div");
      headContent.className = "order-warranty-item__head-content";

      const title = document.createElement("h3");
      title.className = "order-warranty-item__title";
      const titleText = document.createElement("div");
      titleText.className = "order-warranty-item__title-text";
      titleText.textContent = item.title || "Warranty item";
      title.append(titleText);
      headContent.append(title);

      const headDetails = [
        ["Variant", item.variantTitle],
        ["SKU", item.sku],
        ["Quantity", item.quantity],
      ];
      const headMeta = document.createElement("div");
      headMeta.className = "order-warranty-item__meta";
      const headList = document.createElement("dl");
      headDetails.forEach(([label, value]) => {
        if (value === null || value === undefined || value === "") return;
        const row = document.createElement("div");
        const term = document.createElement("dt");
        const termText = document.createElement("div");
        termText.textContent = label;
        term.append(termText);
        const definition = document.createElement("dd");
        const defText = document.createElement("div");
        defText.textContent = value;
        definition.append(defText);
        row.append(term, definition);
        headList.append(row);
      });
      if (headList.children.length) {
        headMeta.append(headList);
        headContent.append(headMeta);
      }
      head.append(headContent);
      card.append(head);

      // Warranty container: Coverage / Starts / Ends in new div
      const warrantyDetails = [
        ["Coverage", entry?.warranty?.number && entry?.warranty?.type ? `${entry.warranty.number} ${entry.warranty.type}` : null],
        ["Starts", formatDate(entry?.startDate)],
        ["Ends", formatDate(entry?.endDate)],
      ];
      const warrantyBox = document.createElement("div");
      warrantyBox.className = "order-warranty-item__warranty";
      const warrantyList = document.createElement("dl");
      warrantyDetails.forEach(([label, value]) => {
        if (value === null || value === undefined || value === "") return;
        const row = document.createElement("div");
        const term = document.createElement("dt");
        const termText = document.createElement("div");
        termText.textContent = label;
        term.append(termText);
        const definition = document.createElement("dd");
        const defText = document.createElement("div");
        defText.textContent = value;
        definition.append(defText);
        row.append(term, definition);
        warrantyList.append(row);
      });
      if (warrantyList.children.length) {
        warrantyBox.append(warrantyList);
        card.append(warrantyBox);
      }
      container.append(card);
    });
  }
}

if (!customElements.get('block-customer-order-list')) {
  customElements.define('block-customer-order-list', AppBlockCustomerOrderList);
}
