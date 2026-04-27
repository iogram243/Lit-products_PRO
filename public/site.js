document.addEventListener("DOMContentLoaded", () => {
  const pageKey = document.body.dataset.pageKey || "default";
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
  const wishForm = wishModal?.querySelector(".wish-form") || null;
  const wishServiceField = wishForm?.querySelector("select[name='service']") || null;
  const wishDescriptionField = wishForm?.querySelector("textarea[name='description']") || null;
  const wishAiButtons = Array.from(
    wishForm?.querySelectorAll("[data-wish-ai-action]") || []
  );
  const wishAiStatus = wishForm?.querySelector("[data-wish-ai-status]") || null;
  const wishAiStatusText = wishForm?.querySelector("[data-wish-ai-status-text]") || null;
  const wishAiSpinner = wishForm?.querySelector("[data-wish-ai-spinner]") || null;
  const wishAiRevertButton = wishForm?.querySelector("[data-wish-ai-revert]") || null;

  let notificationsWereRead = false;
  let wishAiPreviousValue = "";

  function getWindowLoadPromise() {
    if (document.readyState === "complete") {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      window.addEventListener("load", resolve, { once: true });
    });
  }

  function startPageLoader() {
    if (pageKey !== "home") {
      document.body.classList.remove("is-loading-site");
      document.body.classList.remove("is-site-loaded");
      if (pageLoader) {
        pageLoader.hidden = true;
      }
      return;
    }

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
    wishAiPreviousValue = "";
    updateWishAiRevertVisibility();
    clearWishAiStatus();
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

  // Deletion logic
  async function apiPost(url, data = {}) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Network error");
    }

    return response.json();
  }

  function setWishAiStatus(message, type = "info") {
    if (!wishAiStatus) {
      return;
    }

    wishAiStatus.hidden = false;
    if (wishAiStatusText) {
      wishAiStatusText.textContent = message;
    } else {
      wishAiStatus.textContent = message;
    }
    if (wishAiSpinner) {
      wishAiSpinner.hidden = type !== "loading";
    }
    wishAiStatus.dataset.state = type;
  }

  function clearWishAiStatus() {
    if (!wishAiStatus) {
      return;
    }

    wishAiStatus.hidden = true;
    if (wishAiStatusText) {
      wishAiStatusText.textContent = "";
    } else {
      wishAiStatus.textContent = "";
    }
    if (wishAiSpinner) {
      wishAiSpinner.hidden = true;
    }
    delete wishAiStatus.dataset.state;
  }

  function updateWishAiRevertVisibility() {
    if (!wishAiRevertButton) {
      return;
    }

    wishAiRevertButton.hidden = !wishAiPreviousValue;
  }

  async function runWishAi(mode) {
    if (!wishServiceField || !wishDescriptionField) {
      return;
    }

    const service = wishServiceField.value.trim();
    const description = wishDescriptionField.value.trim();

    if (!service) {
      setWishAiStatus("Сначала выберите сервис.", "error");
      wishServiceField.focus();
      return;
    }

    if (description.length < 10) {
      setWishAiStatus("Сначала напишите хотя бы 10 символов пожелания.", "error");
      wishDescriptionField.focus();
      return;
    }

    wishAiPreviousValue = description;
    updateWishAiRevertVisibility();

    wishAiButtons.forEach((button) => {
      button.disabled = true;
      button.dataset.loading = button.dataset.wishAiAction === mode ? "true" : "false";
    });

    setWishAiStatus("AI собирает понятное ТЗ по вашему запросу...", "loading");

    try {
      const payload = await apiPost("/api/wishes/assist", {
        mode,
        service,
        description
      });

      wishDescriptionField.value = payload.content || description;
      setWishAiStatus("Готово: AI собрал ТЗ и подставил его в поле.", "success");
      wishDescriptionField.focus();
    } catch (error) {
      setWishAiStatus(`Ошибка AI: ${error.message}`, "error");
    } finally {
      wishAiButtons.forEach((button) => {
        button.disabled = false;
        delete button.dataset.loading;
      });
    }
  }

  wishAiButtons.forEach((button) => {
    button.addEventListener("click", () => {
      runWishAi("spec");
    });
  });

  wishAiRevertButton?.addEventListener("click", () => {
    if (!wishDescriptionField || !wishAiPreviousValue) {
      return;
    }

    wishDescriptionField.value = wishAiPreviousValue;
    wishAiPreviousValue = "";
    updateWishAiRevertVisibility();
    clearWishAiStatus();
    wishDescriptionField.focus();
  });

  wishDescriptionField?.addEventListener("input", () => {
    clearWishAiStatus();
  });

  document.addEventListener("click", async (event) => {
    // Delete wish/issue
    const wishDeleteBtn = event.target.closest("[data-wish-delete]");
    if (wishDeleteBtn) {
      if (!confirm("Вы действительно хотите удалить этот запрос?")) {
        return;
      }

      const id = wishDeleteBtn.dataset.wishDelete;
      try {
        await apiPost("/api/wishes/delete", { id });
        window.location.reload();
      } catch (error) {
        alert(`Ошибка при удалении: ${error.message}`);
      }
      return;
    }

    // Clear all wishes (admin)
    const wishClearBtn = event.target.closest("[data-wish-clear]");
    if (wishClearBtn) {
      if (!confirm("Удалить ВСЕ запросы пользователей? Это действие необратимо.")) {
        return;
      }

      try {
        await apiPost("/api/admin/wishes/clear");
        window.location.reload();
      } catch (error) {
        alert(`Ошибка при очистке: ${error.message}`);
      }
      return;
    }

    // Delete notification
    const notificationDeleteBtn = event.target.closest("[data-notification-delete]");
    if (notificationDeleteBtn) {
      const id = notificationDeleteBtn.dataset.notificationDelete;
      const wrap = notificationDeleteBtn.closest(".notification-item-wrap");
      
      try {
        await apiPost("/api/notifications/delete", { id });
        if (wrap) {
          wrap.style.opacity = "0";
          wrap.style.transform = "translateX(20px)";
          setTimeout(() => wrap.remove(), 300);
        } else {
          window.location.reload();
        }
      } catch (error) {
        alert(`Ошибка при удалении: ${error.message}`);
      }
      return;
    }

    // Clear all notifications
    const notificationClearBtn = event.target.closest("[data-notification-clear]");
    if (notificationClearBtn) {
      try {
        await apiPost("/api/notifications/clear");
        window.location.reload();
      } catch (error) {
        alert(`Ошибка при очистке: ${error.message}`);
      }
      return;
    }
  });
});
