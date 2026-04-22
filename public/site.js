document.addEventListener("DOMContentLoaded", () => {
  const pageLoader = document.querySelector("[data-site-loader]");
  const loaderProgressBar = document.querySelector("[data-loader-progress]");
  const loaderPercentLabel = document.querySelector("[data-loader-percent]");
  const notificationRoot = document.querySelector("[data-notification-root]");
  const notificationButton = document.querySelector("[data-notification-toggle]");
  const notificationPanel = document.querySelector("[data-notification-panel]");
  const notificationBadge = document.querySelector("[data-notification-badge]");
  const wishModal = document.querySelector("[data-wish-modal]");
  const issueModal = document.querySelector("[data-issue-modal]");
  const wishOpenButtons = Array.from(document.querySelectorAll("[data-open-wish-modal]"));
  const issueOpenButtons = Array.from(document.querySelectorAll("[data-open-issue-modal]"));
  const wishCloseButtons = Array.from(
    document.querySelectorAll("[data-close-wish-modal]")
  );
  const issueCloseButtons = Array.from(
    document.querySelectorAll("[data-close-issue-modal]")
  );
  const adminTabButtons = Array.from(document.querySelectorAll("[data-admin-tab-button]"));
  const adminTabPanels = Array.from(document.querySelectorAll("[data-admin-tab-panel]"));

  let notificationsWereRead = false;

  function getWindowLoadPromise() {
    if (document.readyState === "complete") {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      window.addEventListener("load", resolve, { once: true });
    });
  }

  function startPageLoader() {
    if (!pageLoader || !loaderProgressBar || !loaderPercentLabel) {
      document.body.classList.remove("is-loading-site");
      document.body.classList.add("is-site-loaded");
      return;
    }

    const duration = 4000;
    const startTime = performance.now();

    function updateProgress(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const percent = Math.round(easedProgress * 100);

      loaderProgressBar.style.width = `${percent}%`;
      loaderPercentLabel.textContent = `${percent}%`;

      if (progress < 1) {
        window.requestAnimationFrame(updateProgress);
      }
    }

    window.requestAnimationFrame(updateProgress);

    Promise.all([
      getWindowLoadPromise(),
      new Promise((resolve) => window.setTimeout(resolve, duration))
    ]).then(() => {
      document.body.classList.remove("is-loading-site");
      document.body.classList.add("is-site-loaded");
      window.setTimeout(() => {
        pageLoader.hidden = true;
      }, 750);
    });
  }

  startPageLoader();

  async function markNotificationsRead() {
    if (notificationsWereRead || !notificationBadge) {
      return;
    }

    try {
      const response = await fetch("/api/notifications/read", {
        method: "POST",
        headers: {
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        return;
      }

      notificationsWereRead = true;
      notificationBadge.remove();
      document
        .querySelectorAll(".notification-item--unread")
        .forEach((item) => item.classList.remove("notification-item--unread"));
    } catch (error) {
      console.error("Cannot mark notifications as read", error);
    }
  }

  function closeNotifications() {
    if (!notificationButton || !notificationPanel) {
      return;
    }

    notificationButton.setAttribute("aria-expanded", "false");
    notificationPanel.hidden = true;
  }

  function openNotifications() {
    if (!notificationButton || !notificationPanel) {
      return;
    }

    notificationButton.setAttribute("aria-expanded", "true");
    notificationPanel.hidden = false;
    markNotificationsRead();
  }

  if (notificationRoot && notificationButton && notificationPanel) {
    notificationButton.addEventListener("click", (event) => {
      event.preventDefault();

      if (notificationPanel.hidden) {
        openNotifications();
        return;
      }

      closeNotifications();
    });

    document.addEventListener("click", (event) => {
      if (!notificationRoot.contains(event.target)) {
        closeNotifications();
      }
    });
  }

  function closeModal(modal) {
    if (!modal) {
      return;
    }

    modal.hidden = true;
    if (wishModal?.hidden !== false && issueModal?.hidden !== false) {
      document.body.classList.remove("is-modal-open");
    }
  }

  function openModal(modal) {
    if (!modal) {
      return;
    }

    modal.hidden = false;
    document.body.classList.remove("is-modal-open");
    document.body.classList.add("is-modal-open");
    modal.querySelector("select, textarea")?.focus();
  }

  function closeWishModal() {
    closeModal(wishModal);
  }

  function openWishModal() {
    openModal(wishModal);
  }

  function closeIssueModal() {
    closeModal(issueModal);
  }

  function openIssueModal() {
    openModal(issueModal);
  }

  wishOpenButtons.forEach((button) => {
    button.addEventListener("click", openWishModal);
  });

  issueOpenButtons.forEach((button) => {
    button.addEventListener("click", openIssueModal);
  });

  wishCloseButtons.forEach((button) => {
    button.addEventListener("click", closeWishModal);
  });

  issueCloseButtons.forEach((button) => {
    button.addEventListener("click", closeIssueModal);
  });

  function activateAdminTab(tabName) {
    if (!adminTabButtons.length || !adminTabPanels.length) {
      return;
    }

    adminTabButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.adminTabButton === tabName);
    });

    adminTabPanels.forEach((panel) => {
      panel.hidden = panel.dataset.adminTabPanel !== tabName;
    });
  }

  adminTabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activateAdminTab(button.dataset.adminTabButton);
    });
  });

  if (adminTabButtons.length && adminTabPanels.length) {
    activateAdminTab(adminTabButtons[0].dataset.adminTabButton);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeNotifications();
      closeWishModal();
      closeIssueModal();
    }
  });
});
