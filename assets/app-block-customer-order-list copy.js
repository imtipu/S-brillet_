class BlockCustomerOrderList extends HTMLElement {
  connectedCallback() {
    if (this.dataset.initialized === 'true') {
      return;
    }

    this.dataset.initialized = 'true';
    this.setupCollapsibles();
    this.observeMutations();
  }

  disconnectedCallback() {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }

    this.dataset.initialized = 'false';
  }

  observeMutations() {
    this.mutationObserver = new MutationObserver(() => {
      this.setupCollapsibles();
    });

    this.mutationObserver.observe(this, {
      childList: true,
      subtree: true
    });
  }

  setupCollapsibles() {
    const sections = this.querySelectorAll('[data-collapsible]');

    sections.forEach((section) => {
      const toggle = section.querySelector('.order-card__details-toggle');
      const content = section.querySelector('.order-card__details-content');

      if (!toggle || !content) {
        return;
      }

      if (toggle.dataset.bound !== 'true') {
        toggle.addEventListener('click', () => {
          const isOpen = section.classList.contains('is-open');

          if (isOpen) {
            this.closeSection(section, toggle, content);
            return;
          }

          this.openSection(section, toggle, content);
        });

        toggle.dataset.bound = 'true';
      }

      const isOpen = section.classList.contains('is-open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      content.hidden = !isOpen;

      if (isOpen) {
        content.style.height = 'auto';
      } else {
        content.style.height = '0px';
      }
    });
  }

  async openSection(section, toggle, content) {
    const openSections = this.querySelectorAll('[data-collapsible].is-open');

    for (const openSection of openSections) {
      if (openSection === section) {
        continue;
      }

      const openToggle = openSection.querySelector('.order-card__details-toggle');
      const openContent = openSection.querySelector('.order-card__details-content');

      if (!openToggle || !openContent) {
        continue;
      }

      await this.closeSection(openSection, openToggle, openContent);
    }

    section.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    content.hidden = false;
    content.style.height = '0px';

    const nextHeight = content.scrollHeight;

    requestAnimationFrame(() => {
      content.style.height = `${nextHeight}px`;
    });

    await this.waitForHeightTransition(content);

    if (section.classList.contains('is-open')) {
      content.style.height = 'auto';
    }
  }

  closeSection(section, toggle, content) {
    return new Promise((resolve) => {
      if (!section.classList.contains('is-open')) {
        toggle.setAttribute('aria-expanded', 'false');
        content.hidden = true;
        content.style.height = '0px';
        resolve();
        return;
      }

      content.style.height = `${content.scrollHeight}px`;
      section.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');

      requestAnimationFrame(() => {
        content.style.height = '0px';
      });

      this.waitForHeightTransition(content).then(() => {
        if (!section.classList.contains('is-open')) {
          content.hidden = true;
          content.style.height = '0px';
        }

        resolve();
      });
    });
  }

  waitForHeightTransition(content) {
    return new Promise((resolve) => {
      const handleTransitionEnd = (event) => {
        if (event.propertyName !== 'height') {
          return;
        }

        content.removeEventListener('transitionend', handleTransitionEnd);
        resolve();
      };

      content.addEventListener('transitionend', handleTransitionEnd);

      window.setTimeout(() => {
        content.removeEventListener('transitionend', handleTransitionEnd);
        resolve();
      }, 420);
    });
  }
}

if (!customElements.get('block-customer-order-list')) {
  customElements.define('block-customer-order-list', BlockCustomerOrderList);
}
