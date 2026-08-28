import "@theme/motion";

class CustomerPointHistoryOverview extends HTMLElement {
  connectedCallback() {
    if (this.dataset.initialized === "true") return;
    this.dataset.initialized = "true";
    this.render();
  }

  get proxyPath() {
    const proxyPath = this.dataset.proxyPath || "/apps/sbrillet";
    return proxyPath.endsWith("/") ? proxyPath.slice(0, -1) : proxyPath;
  }

  get limit() {
    return this.dataset.limit || "5";
  }

  get contentElement() {
    return this.querySelector("[data-point-history-content]");
  }

  createStatus(message, className = "") {
    const status = document.createElement("div");
    status.className =
      `customer-point-history-overview__status ${className}`.trim();
    status.dataset.pointHistoryStatus = "";
    status.setAttribute("role", "status");
    status.textContent = message;
    return status;
  }

  createSkeleton() {
    const items = document.createElement("div");
    items.className =
      "customer-point-history-overview__items customer-point-history-overview__items--skeleton";
    items.setAttribute("aria-hidden", "true");

    for (let index = 0; index < 3; index += 1) {
      const row = document.createElement("div");
      row.className =
        "customer-point-history-overview__item feature-item font-inter customer-point-history-overview__item--skeleton";
      const label = document.createElement("div");
      label.className = "item-label";

      ["icon", "label", "badge"].forEach((part) => {
        const skeleton = document.createElement("span");
        skeleton.className = `customer-point-history-overview__skeleton customer-point-history-overview__skeleton--${part}`;
        label.append(skeleton);
      });

      const points = document.createElement("span");
      points.className =
        "customer-point-history-overview__skeleton customer-point-history-overview__skeleton--points";
      row.append(label, points);
      items.append(row);
    }

    return items;
  }

  createHistoryItem(item) {
    const icon_plus = this.dataset.iconPlus;
    const icon_minus = this.dataset.iconMinus;

    const pointType = String(item?.pointType || "").toUpperCase();
    const category = String(item.category || "").toUpperCase();
    const isRedeem = pointType === "REDEEM";
    const points = Math.abs(Number(item?.points) || 0);
    const sign = isRedeem ? "-" : "+";
    const pointTypeLabel = isRedeem ? "REDEEM" : "EARN";
    const statusText = String(item?.status || "PENDING").toUpperCase();
    const hasOrder = Boolean(String(item?.orderId || "").trim());

    const row = document.createElement("div");
    row.className =
      "customer-point-history-overview__item feature-item font-inter";
    const itemLabel = document.createElement("div");
    itemLabel.className = "item-label";
    const typeMark = document.createElement("span");
    typeMark.className = "customer-point-history-overview__type";
    typeMark.setAttribute("aria-hidden", "true");
    const typeIcon = document.createElement("img");
    typeIcon.src = isRedeem ? icon_minus : icon_plus;
    typeIcon.alt = "";
    typeIcon.width = 12;
    typeIcon.height = 12;
    typeMark.append(typeIcon);
    const pointTypeElement = document.createElement("span");
    pointTypeElement.className =
      "customer-point-history-overview__point-type label";
    pointTypeElement.textContent = pointTypeLabel;

    const categoryElement = document.createElement("span");
    categoryElement.className = `customer-point-history-overview__badge`;
    categoryElement.textContent = category;
    // const status = document.createElement("span");
    // status.className = `customer-point-history-overview__badge customer-point-history-overview__badge--${statusText.toLowerCase()}`;
    // status.textContent = statusText;
    itemLabel.append(typeMark, pointTypeElement, categoryElement);

    // if (hasOrder) {
    //   const order = document.createElement("span");
    //   order.className = "customer-point-history-overview__order-context";
    //   order.textContent = "Used for order";
    //   itemLabel.append(order);
    // }

    const pointAmount = document.createElement("div");
    pointAmount.className = "point-amount text-gradient";
    pointAmount.textContent = `${sign}${points.toLocaleString()}`;
    row.append(itemLabel, pointAmount);
    return row;
  }

  async render() {
    const content = this.contentElement;
    if (!content) return;

    content.replaceChildren(this.createSkeleton());

    try {
      const api = window.SBrilletCustomerPointHistory;
      if (!api?.fetch) throw new Error("Point history API is unavailable");

      const { history } = await api.fetch({
        proxyPath: this.proxyPath,
        limit: this.limit,
      });

      if (!history.length) {
        content.replaceChildren(this.createStatus("No point history yet."));
        return;
      }

      const items = document.createElement("div");
      items.className = "customer-point-history-overview__items";
      items.dataset.pointHistoryItems = "";
      items.append(...history.map((item) => this.createHistoryItem(item)));
      content.replaceChildren(items);
    } catch (error) {
      console.error("Failed to load customer point history", error);
      content.replaceChildren(
        this.createStatus(
          "Point history is unavailable right now.",
          "is-error",
        ),
      );
    }
  }
}

class BlockCustomerTierOverview extends HTMLElement {
  static tierThresholds = [
    { level: "SHINY", pointsRequired: 0 },
    { level: "STARLIGHT", pointsRequired: 100 },
    { level: "GALAXY", pointsRequired: 700 },
    { level: "ULTRA_GALAXY", pointsRequired: 1000 },
  ];
  async connectedCallback() {
    if (this.dataset.initialized === "true") {
      this.setupDesktopHeightSync();
      this.setupDiscountLabelCarousel();
      return;
    }

    this.dataset.initialized = "true";

    this.setupDesktopHeightSync();

    // this.renderPoints();
    // this.renderProgressBar(this.totalPoints);
    // this.setupMotion();
    this.setupDiscountLabelCarousel();
    this.setupAdditionalPointActions();

    this.renderPercentageLabels();
    this.resolvedTierConfig = this.loyaltyConfig.tier_config;
    this.renderTierRewards();
    await this.renderTierOverview();
    await this.getTotalDiscountAmount();
  }

  disconnectedCallback() {
    if (this.rewardsMotionCleanup) {
      this.rewardsMotionCleanup();
      this.rewardsMotionCleanup = null;
    }

    if (this.discountLabelInterval) {
      window.clearInterval(this.discountLabelInterval);
      this.discountLabelInterval = null;
    }

    if (this.desktopHeightObserver) {
      this.desktopHeightObserver.disconnect();
      this.desktopHeightObserver = null;
    }

    if (this.desktopHeightFrame) {
      window.cancelAnimationFrame(this.desktopHeightFrame);
      this.desktopHeightFrame = null;
    }

    if (this.desktopHeightMediaQuery) {
      this.desktopHeightMediaQuery.removeEventListener(
        "change",
        this.handleDesktopHeightBreakpointChange,
      );
      this.desktopHeightMediaQuery = null;
    }
  }

  get proxyPath() {
    const proxyPath = this.dataset.proxyPath || "/apps/sbrillet";
    return proxyPath.endsWith("/") ? proxyPath.slice(0, -1) : proxyPath;
  }

  setupAdditionalPointActions() {
    this.querySelectorAll("[data-instagram-link]").forEach((instagramLink) => {
      instagramLink.addEventListener("click", () =>
        this.handleInstagramShare(instagramLink),
      );
    });
  }

  async handleInstagramShare(instagramLink) {
    if (
      instagramLink.dataset.instagramSharePending === "true" ||
      instagramLink.dataset.instagramShareRedeemed === "true"
    ) {
      return;
    }

    const instagramUrl = instagramLink.dataset.link?.trim();
    if (!instagramUrl) return;

    const instagramWindow = window.open("about:blank", "_blank");
    if (instagramWindow) instagramWindow.opener = null;

    instagramLink.dataset.instagramSharePending = "true";
    instagramLink.setAttribute("aria-busy", "true");

    try {
      const response = await fetch(
        `${this.proxyPath}/api/customer/instagram-share`,
        {
          method: "POST",
          headers: { Accept: "application/json" },
        },
      );

      if (!response.ok) {
        throw new Error(`Instagram share request failed: ${response.status}`);
      }

      if (instagramWindow && !instagramWindow.closed) {
        instagramWindow.location.href = instagramUrl;
      }
      instagramLink.dataset.instagramShareRedeemed = "true";
      instagramLink.setAttribute("aria-disabled", "true");
    } catch (error) {
      if (instagramWindow && !instagramWindow.closed) instagramWindow.close();
      console.error("Failed to record Instagram share", error);
    } finally {
      delete instagramLink.dataset.instagramSharePending;
      instagramLink.removeAttribute("aria-busy");
    }
  }

  get customerAppMetafields() {
    const scriptEl = this.querySelector("[data-sbrillet-metafields-json]");
    if (scriptEl) {
      try {
        return JSON.parse(scriptEl.textContent || "{}");
      } catch (error) {
        console.error("Failed to parse customer app metafields JSON", error);
      }
    }
    return {
      loyalty_tier_config: null,
      loyalty_next_tier_config: null,
    };
  }

  get jsonScriptData() {
    const scriptTierLogos = this.querySelector("[data-tier-logos-json]");
    let tier_logos = null;
    if (scriptTierLogos) {
      tier_logos = JSON.parse(scriptTierLogos.textContent);
    }
    return {
      // customerAppMetafields: this.customerAppMetafields
      tier_logos,
    };
  }

  get elements() {
    return {
      el_tier_logo: this.querySelector("[data-tier-logo]"),
      el_logo_box_skeleton: this.querySelector(".logo-box-skeleton"),
      el_tier_level_title: this.querySelector("[data-tier-level-title]"),
      el_tier_total_points: this.querySelector("[data-total-points]"),
      el_tier_earning_rate: this.querySelector("[data-earning-point-rate]"),
      el_referral_earning_rate: this.querySelector(
        "[data-referral-earning-rate]",
      ),
      el_total_discount_amount: this.querySelector(
        "[data-total-discount-amount]",
      ),
    };
  }

  get loyaltyConfig() {
    const metafields = this.customerAppMetafields;
    const tier_config = this.normalizeMetafieldValue(
      metafields?.loyalty_tier_config,
    );
    const next_tier_config = this.normalizeMetafieldValue(
      metafields?.loyalty_next_tier_config,
    );

    return {
      tier_config,
      next_tier_config,
    };
  }

  get tierBlock() {
    return this.querySelector("[data-tier-block]");
  }

  get tierRewardsJson() {
    return this.querySelector("[data-tier-rewards-json]");
  }

  get tierRewardItemsElement() {
    return this.querySelector("[data-tier-reward-items]");
  }

  get progressBarImagesElement() {
    return this.querySelector("[data-tier-progress-bar-images]");
  }

  get progressBarElement() {
    return this.querySelector("[data-tier-progress-bar]");
  }

  get discountLabelItemsElement() {
    return this.querySelector(".percentage-label-items");
  }

  get desktopHeightSyncTargets() {
    return {
      status: this.querySelector(".tier-status-content"),
      discounts: this.querySelector(".cart-items-discounts"),
      rewards: this.querySelector("[data-tier-reward-content]"),
      progress: this.querySelector("[data-tier-progress-bar]"),
    };
  }

  setupDesktopHeightSync() {
    if (this.desktopHeightObserver || !window.ResizeObserver) return;

    this.desktopHeightMediaQuery = window.matchMedia("(min-width: 1024px)");
    this.handleDesktopHeightBreakpointChange = () =>
      this.scheduleDesktopHeightSync();
    this.desktopHeightMediaQuery.addEventListener(
      "change",
      this.handleDesktopHeightBreakpointChange,
    );

    const { status, discounts } = this.desktopHeightSyncTargets;
    this.desktopHeightObserver = new ResizeObserver(() => {
      this.scheduleDesktopHeightSync();
    });

    [status, discounts].filter(Boolean).forEach((element) => {
      this.desktopHeightObserver.observe(element);
    });

    this.scheduleDesktopHeightSync();
  }

  scheduleDesktopHeightSync() {
    if (this.desktopHeightFrame) return;

    this.desktopHeightFrame = window.requestAnimationFrame(() => {
      this.desktopHeightFrame = null;
      this.syncDesktopHeights();
    });
  }

  syncDesktopHeights() {
    const { status, discounts, rewards, progress } =
      this.desktopHeightSyncTargets;

    if (!this.desktopHeightMediaQuery?.matches) {
      [rewards, progress].filter(Boolean).forEach((element) => {
        if (element.style.height) element.style.height = "";
      });
      return;
    }

    if (status && rewards) {
      const statusHeight = `${status.getBoundingClientRect().height}px`;
      if (rewards.style.height !== statusHeight) {
        rewards.style.height = statusHeight;
      }
    }

    if (discounts && progress) {
      const discountsHeight = `${discounts.getBoundingClientRect().height}px`;
      if (progress.style.height !== discountsHeight) {
        progress.style.height = discountsHeight;
      }
    }
  }

  get totalPoints() {
    const parsedValue = Number.parseInt(this.dataset.totalPoints || "0", 10);
    return Number.isNaN(parsedValue) ? 0 : parsedValue;
  }

  get elementAmount() {
    return this.querySelector("[data-element-amount]");
  }

  get motionTargets() {
    return {
      card: this.querySelector("[data-tier-card]"),
      logo: this.querySelector("[data-tier-logo]"),
      points: this.querySelector("[data-tier-points]"),
      content: this.querySelector("[data-tier-content]"),
      rows: Array.from(
        this.querySelectorAll("[data-tier-row], [data-tier-feature]"),
      ),
      divider: this.querySelector("[data-tier-divider]"),
    };
  }

  renderPoints() {
    if (!this.elementAmount) return;

    this.elementAmount.textContent = this.totalPoints.toString();
  }

  renderTierRewards() {
    const rewardsElement = this.tierRewardItemsElement;
    if (!this.tierRewardsJson || !rewardsElement) return;

    if (this.rewardsMotionCleanup) {
      this.rewardsMotionCleanup();
      this.rewardsMotionCleanup = null;
    }

    let rewards = [];

    try {
      const data = JSON.parse(this.tierRewardsJson.textContent || "{}");
      rewards = Array.isArray(data.tier_rewards) ? data.tier_rewards : [];
    } catch (error) {
      console.error("Failed to parse tier rewards JSON", error);
      return;
    }
    const tierConfig = this.resolvedTierConfig;
    rewards = this.applyTierConfigToRewards(rewards, tierConfig);

    rewardsElement.dataset.rewardsLoading = "false";
    rewardsElement.innerHTML = "";

    const shapeFillOctagon =
      this.dataset.shapeFillOctagonUrl || this.dataset.shapeWhiteOctagonUrl;
    const shapeWhiteOctagon = this.dataset.shapeWhiteOctagonUrl;
    const fallbackLockIcon = this.dataset.lockIconUrl;

    rewards.forEach((reward) => {
      const { label, iconLock, enabled, logo } = reward;
      const rewardIcon = enabled && logo ? logo : fallbackLockIcon;
      const rewardShape = enabled ? shapeFillOctagon : shapeWhiteOctagon;

      const itemClass = enabled ? "enabled" : "disabled";
      const htmlContent = `
                <div class="reward-item ${itemClass}">
                    <div class="reward-icon">
                        <img src="${rewardShape}"
                             width="150" height="150" alt=""
                             class="icon-bg-shape">
                        <img src="${rewardIcon}"
                             width="100" height="100" alt="${enabled && logo ? label : "Locked"}"
                             class="icon">
                    </div>
                    <div class="reward-label">
                        ${label}
                    </div>
                </div>
            `;
      rewardsElement.insertAdjacentHTML("beforeend", htmlContent);
    });

    this.setupRewardsMotion();
  }

  renderProgressBar(pointStats) {
    const progressElementImgBox = this.querySelector(
      ".tier-progress-image-box",
    );
    const progressElementText = this.querySelector(".progress-level-text");
    const progressBarImages = this.progressBarImagesElement;

    if (!progressElementImgBox || !progressElementText || !progressBarImages)
      return;

    let progressImages = [];

    try {
      progressImages = JSON.parse(progressBarImages.textContent || "[]");
    } catch (error) {
      console.error("Failed to parse progress bar JSON", error);
      return;
    }

    if (!progressImages.length) return;

    if (this.progressBarElement) {
      this.progressBarElement.dataset.progressLoading = "false";
    }

    const totalPoints = Math.max(0, Number(pointStats?.totalPoints || 0));
    let progressImageIndex = 7;

    if (totalPoints === 0) {
      progressImageIndex = 0;
    } else if (totalPoints < 50) {
      progressImageIndex = 1;
    } else if (totalPoints < 100) {
      progressImageIndex = 2;
    } else if (totalPoints === 100) {
      progressImageIndex = 3;
    } else if (totalPoints < 700) {
      progressImageIndex = 4;
    } else if (totalPoints === 700) {
      progressImageIndex = 5;
    } else if (totalPoints <= 850) {
      progressImageIndex = 6;
    }

    const progressImg =
      progressImages[progressImageIndex] ||
      progressImages[progressImages.length - 1];
    const nextTierPointRequired = this.dataset.nextTierPointRequired;
    const nextTierPoints = nextTierPointRequired
      ? Number(nextTierPointRequired)
      : Number.NaN;
    const nextTierName = this.dataset.nextTierLevel;
    const pointsLeft = Number.isFinite(nextTierPoints)
      ? Math.max(0, nextTierPoints - totalPoints)
      : 0;

    progressElementImgBox.innerHTML = `
            <img src="${progressImg}" alt="" width="1000" height="auto">
        `;

    progressElementText.innerHTML = Number.isFinite(nextTierPoints)
      ? `<p>You past ${totalPoints} sparkles - ${pointsLeft} left to reach ${nextTierName}</p>`
      : "<p>You reached the highest tier.</p>";
  }

  animatePoints() {
    if (!this.elementAmount) return;

    animate(0, this.totalPoints, {
      duration: 1.2,
      ease: "easeIn",
      onUpdate: (latest) => {
        this.elementAmount.textContent = Math.round(latest).toString();
      },
    });
  }

  setupRewardsMotion() {
    const motion = globalThis.Motion;
    const rewardsElement = this.tierRewardItemsElement;
    const rewardItems = Array.from(
      this.querySelectorAll(".reward-item:not(.reward-item--skeleton)"),
    );

    if (!motion || !rewardsElement || !rewardItems.length) return;

    const { animate, inView, stagger } = motion;
    const rewardIcons = rewardItems
      .map((item) => item.querySelector(".reward-icon"))
      .filter(Boolean);
    const rewardLabels = rewardItems
      .map((item) => item.querySelector(".reward-label"))
      .filter(Boolean);

    // Observe the list once. Observing every item causes the callback to
    // run once per item as each one enters the viewport on small screens.
    this.rewardsMotionCleanup = inView(
      rewardsElement,
      () => {
        animate(
          rewardItems,
          {
            opacity: [0, 1],
            y: [28, 0],
            filter: ["blur(12px)", "blur(0px)"],
          },
          {
            delay: stagger(0.08),
            duration: 0.6,
            ease: "easeOut",
          },
        );

        if (rewardIcons.length) {
          animate(
            rewardIcons,
            {
              scale: [0.3, 1],
            },
            {
              delay: stagger(0.08, { startDelay: 0.14 }),
              duration: 0.45,
              ease: "easeOut",
            },
          );
        }

        if (rewardLabels.length) {
          animate(
            rewardLabels,
            {
              opacity: [0, 1],
              y: [10, 0],
              scale: [0.6, 1],
            },
            {
              delay: stagger(0.08, { startDelay: 0.22 }),
              duration: 0.42,
              ease: "easeOut",
            },
          );
        }
      },
      { amount: 0.2 },
    );
  }

  setupDiscountLabelCarousel() {
    if (this.discountLabelInterval) {
      window.clearInterval(this.discountLabelInterval);
      this.discountLabelInterval = null;
    }

    const labelItemsElement = this.discountLabelItemsElement;
    const labelItems = Array.from(
      this.querySelectorAll(".percentage-label-items .label-item"),
    );
    const motion = globalThis.Motion;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (!labelItemsElement || labelItems.length <= 1 || prefersReducedMotion) {
      return;
    }

    if (!motion) return;

    const { animate } = motion;
    let activeIndex = 0;
    labelItemsElement.dataset.labelCarousel = "motion";

    labelItems.forEach((item, index) => {
      item.style.opacity = index === activeIndex ? "1" : "0";
      item.style.transform =
        index === activeIndex
          ? "translate(-50%, -50%)"
          : "translate(-50%, 70%)";
    });

    this.discountLabelInterval = window.setInterval(() => {
      const previousItem = labelItems[activeIndex];
      activeIndex = (activeIndex + 1) % labelItems.length;
      const nextItem = labelItems[activeIndex];

      animate(
        previousItem,
        {
          opacity: [1, 0],
          transform: ["translate(-50%, -50%)", "translate(-50%, -170%)"],
        },
        {
          duration: 0.45,
          ease: "easeInOut",
        },
      );

      animate(
        nextItem,
        {
          opacity: [0, 1],
          transform: ["translate(-50%, 70%)", "translate(-50%, -50%)"],
        },
        {
          duration: 0.5,
          ease: "easeOut",
        },
      );
    }, 2600);
  }

  setupMotion() {
    const motion = globalThis.Motion;
    const { card, logo, points, content, rows, divider } = this.motionTargets;

    if (!motion || !card) return;

    const { animate, inView, stagger } = motion;
    const revealTargets = [logo, points, divider, ...rows].filter(Boolean);

    inView(
      card,
      () => {
        animate(
          card,
          {
            opacity: [0, 1],
            y: [28, 0],
            filter: ["blur(12px)", "blur(0px)"],
          },
          {
            duration: 0.6,
            ease: "easeOut",
          },
        );

        if (revealTargets.length) {
          animate(
            revealTargets,
            {
              opacity: [0, 1],
              y: [18, 0],
            },
            {
              delay: stagger(0.08, { startDelay: 0.12 }),
              duration: 0.45,
              ease: "easeOut",
            },
          );
        }

        if (logo) {
          animate(
            logo,
            {
              scale: [0.1, 1],
            },
            {
              duration: 0.7,
              ease: "easeOut",
            },
          );
        }

        if (divider) {
          animate(
            divider,
            {
              scaleX: [0, 1],
              opacity: [0.2, 1],
            },
            {
              duration: 0.55,
              ease: "easeOut",
            },
          );
        }

        if (content) {
          animate(
            content,
            {
              opacity: [0.4, 1],
            },
            {
              duration: 0.45,
              ease: "linear",
            },
          );
        }

        this.animatePoints();

        return () => {};
      },
      { amount: 0.35 },
    );
  }

  normalizeMetafieldValue(metafield) {
    if (!metafield) return null;

    const value = metafield.value || metafield;
    if (typeof value !== "string") return value;

    try {
      return JSON.parse(value);
    } catch (error) {
      return value;
    }
  }

  hasTierConfig(tierConfig) {
    return Boolean(tierConfig?.level);
  }

  getTierState(totalPoints) {
    const points = Math.max(0, Number(totalPoints) || 0);
    const tierIndex = BlockCustomerTierOverview.tierThresholds.reduce(
      (resolvedIndex, tier, index) =>
        points >= tier.pointsRequired ? index : resolvedIndex,
      0,
    );

    return {
      current: BlockCustomerTierOverview.tierThresholds[tierIndex],
      next: BlockCustomerTierOverview.tierThresholds[tierIndex + 1] || null,
    };
  }

  getFetchedTierConfig(pointStats) {
    const sources = [
      pointStats,
      pointStats?.customer,
      pointStats?.metafields,
      pointStats?.customer?.metafields,
    ];

    const tier_config = this.normalizeMetafieldValue(
      sources
        .map(
          (source) =>
            source?.loyalty_tier_config ||
            source?.loyaltyTierConfig ||
            source?.tierConfig ||
            source?.currentTierConfig ||
            source?.currentTier ||
            source?.tier_config,
        )
        .find(Boolean),
    );

    const next_tier_config = this.normalizeMetafieldValue(
      sources
        .map(
          (source) =>
            source?.loyalty_next_tier_config ||
            source?.loyaltyNextTierConfig ||
            source?.nextTierConfig ||
            source?.nextTier ||
            source?.next_tier_config,
        )
        .find(Boolean),
    );

    return {
      tier_config,
      next_tier_config,
    };
  }

  async resolveLoyaltyConfig(pointStats) {
    const metafieldConfig = this.loyaltyConfig;

    if (this.hasTierConfig(metafieldConfig.tier_config)) {
      return {
        ...metafieldConfig,
        pointStats,
      };
    }

    const fetchedConfig = this.getFetchedTierConfig(pointStats);

    return {
      tier_config: fetchedConfig.tier_config || metafieldConfig.tier_config,
      next_tier_config:
        fetchedConfig.next_tier_config || metafieldConfig.next_tier_config,
      pointStats,
    };
  }

  updateNextTierDataset(nextTierConfig) {
    if (!nextTierConfig) {
      delete this.dataset.nextTierLevel;
      delete this.dataset.nextTierPointRequired;
      return;
    }

    if (nextTierConfig.level) {
      this.dataset.nextTierLevel = nextTierConfig.level;
    }

    if (nextTierConfig?.pointsRequired !== undefined) {
      this.dataset.nextTierPointRequired = nextTierConfig.pointsRequired;
    }
  }

  updateTierDataset(tierConfig) {
    if (tierConfig?.level) {
      this.dataset.tierLevel = tierConfig.level;
    }
  }

  applyTierConfigToRewards(rewards, tierConfig) {
    if (!tierConfig) return rewards;

    const enabledByIndex = [
      Number(tierConfig.welcomeGiftPercentage || 0) > 0,
      Boolean(tierConfig.freeShipping) ||
        Number(tierConfig.freeShippingOnOrder || 0) > 0,
      Boolean(tierConfig.hasFreeThemeMessageCard),
      Number(tierConfig.birthdayGiftAmount || 0) > 0,
      Number(tierConfig.memberSavingPercentage || 0) > 0,
      Number(tierConfig.jewelryWararnty || tierConfig.jewelryWarranty || 0) > 0,
      Boolean(tierConfig.viewNewCollection),
      // Boolean(tierConfig.contactLiveSupport),
      // Boolean(
      //     tierConfig.hasFreeJewelryGiveway || tierConfig.hasFreeJewelryGiveaway,
      // ),
      Boolean(tierConfig.voteNewCollection),
    ];

    return rewards.map((reward, index) => ({
      ...reward,
      enabled: enabledByIndex[index] ?? reward.enabled,
    }));
  }

  async renderTierOverview() {
    const designMode = this.dataset.designMode === "true";
    if (!designMode) {
      let pointStats = null;
      try {
        pointStats = await window.customerPointStatStore.fetchData();
      } catch (error) {
        console.error("Failed to load customer point stats", error);
      }
      const {
        tier_config,
        next_tier_config,
        pointStats: resolvedPointStats,
      } = await this.resolveLoyaltyConfig(pointStats);
      const { tier_logos } = this.jsonScriptData;
      const { el_tier_logo, el_logo_box_skeleton } = this.elements;
      const shouldRefreshTierRewards = !this.hasTierConfig(
        this.resolvedTierConfig,
      );
      const hasResolvedTierConfig = this.hasTierConfig(tier_config);
      const tierState = this.getTierState(resolvedPointStats?.totalPoints);
      const displayTierConfig = hasResolvedTierConfig
        ? tier_config
        : tierState.current;
      const displayNextTierConfig = hasResolvedTierConfig
        ? next_tier_config
        : tierState.next;

      this.resolvedTierConfig = displayTierConfig;
      this.updateTierDataset(displayTierConfig);
      this.updateNextTierDataset(displayNextTierConfig);

      if (!this.hasTierConfig(tier_config)) {
        console.error("No customer loyalty tier config found");
        this.renderPointStats(displayTierConfig, resolvedPointStats);
        return;
      }

      const tierLogo = tier_logos?.[displayTierConfig.level]?.logo;

      if (tierLogo && el_tier_logo) {
        el_tier_logo.src = tierLogo;
        if (el_logo_box_skeleton) {
          el_logo_box_skeleton.style.display = "none";
          el_logo_box_skeleton.style.opacity = "0";
        }
        el_tier_logo.style.opacity = 1;
      }
      this.renderPointStats(displayTierConfig, resolvedPointStats);
      if (shouldRefreshTierRewards) this.renderTierRewards();
    }
  }

  renderPointStats(tier_config, pointStats) {
    const {
      el_tier_level_title,
      el_tier_total_points,
      el_tier_earning_rate,
      el_referral_earning_rate,
    } = this.elements;

    if (el_tier_level_title) {
      el_tier_level_title.textContent = tier_config.level.replaceAll("_", " ");
    }

    if (el_tier_earning_rate) {
      el_tier_earning_rate.textContent = `+${tier_config.sparklesPerDollar || 0}`;
    }

    if (el_referral_earning_rate) {
      el_referral_earning_rate.textContent = `+${
        tier_config.referralRewardSparkles || 0
      }`;
    }

    if (el_tier_total_points) {
      el_tier_total_points.textContent =
        pointStats?.totalPoints?.toString() || "0";
    }

    this.renderProgressBar(pointStats);
  }

  async getTotalDiscountAmount() {
    const url = `${this.proxyPath}/api/customer/orders-total-saved`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(res.statusText);
    }

    const resJson = await res.json();
    console.log(resJson);
    const data = resJson.data;
    const totalDiscountAmount = parseFloat(data.totalDiscounts);

    const usdFormatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    });

    const toAmount = usdFormatter.format(totalDiscountAmount);
    // return resJson;
    const { el_total_discount_amount } = this.elements;
    el_total_discount_amount.textContent = toAmount.toString();
  }

  getOrdinal(number) {
    const suffixes = {
      one: "st",
      two: "nd",
      few: "rd",
      other: "th",
    };

    const pluralRules = new Intl.PluralRules("en-US", {
      type: "ordinal",
    });

    const rule = pluralRules.select(number);

    return `${number}${suffixes[rule]}`;
  }

  renderPercentageLabels() {
    const items = this.querySelectorAll("[data-percentage-label-item]");

    items.forEach((item, itemIndex) => {
      const index =
        Number.parseInt(item.dataset.percentageIndex, 10) || itemIndex + 1;
      const percentageValue = item.dataset.percentageValue;
      const ordinal = this.getOrdinal(index);
      console.log(ordinal);
      const textContent = `Buy ${ordinal} | Save ${percentageValue}%`;
      item.textContent = textContent;
    });
  }
}

if (!customElements.get("customer-point-history-overview")) {
  customElements.define(
    "customer-point-history-overview",
    CustomerPointHistoryOverview,
  );
}

if (!customElements.get("customer-tier-overview")) {
  customElements.define("customer-tier-overview", BlockCustomerTierOverview);
}
