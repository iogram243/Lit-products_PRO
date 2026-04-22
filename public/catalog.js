document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("catalog-container");
  const chips = Array.from(document.querySelectorAll(".filter-chip"));
  const selectedServiceLabel = document.querySelector("[data-selected-service-name]");
  const sortSelect = document.querySelector("[data-sort-select]");
  const modal = document.querySelector("[data-product-modal]");
  const lightbox = document.querySelector("[data-image-lightbox]");

  if (!container || !modal || !lightbox || !sortSelect) {
    return;
  }

  const modalElements = {
    dialog: modal.querySelector(".product-modal__dialog"),
    closeButtons: modal.querySelectorAll("[data-close-modal]"),
    title: modal.querySelector("[data-modal-title]"),
    description: modal.querySelector("[data-modal-description]"),
    serviceLogo: modal.querySelector("[data-modal-service-logo]"),
    serviceName: modal.querySelector("[data-modal-service-name]"),
    productType: modal.querySelector("[data-modal-product-type]"),
    newBadge: modal.querySelector("[data-modal-new-badge]"),
    vipBadge: modal.querySelector("[data-modal-vip-badge]"),
    date: modal.querySelector("[data-modal-date]"),
    mainImage: modal.querySelector("[data-modal-main-image]"),
    imageCounter: modal.querySelector("[data-modal-image-counter]"),
    fileName: modal.querySelector("[data-modal-file-name]"),
    thumbs: modal.querySelector("[data-modal-thumbs]"),
    prevButton: modal.querySelector("[data-gallery-prev]"),
    nextButton: modal.querySelector("[data-gallery-next]"),
    openLightboxButton: modal.querySelector("[data-open-lightbox]"),
    downloadButton: modal.querySelector("[data-modal-download]"),
    downloadNote: modal.querySelector("[data-modal-download-note]")
  };

  const lightboxElements = {
    closeButtons: lightbox.querySelectorAll("[data-close-lightbox]"),
    image: lightbox.querySelector("[data-lightbox-image]")
  };

  const state = {
    product: null,
    images: [],
    currentIndex: 0
  };

  function buildCatalogUrl(serviceKey, sortKey) {
    const params = new URLSearchParams();

    if (serviceKey && serviceKey !== "all") {
      params.set("service", serviceKey);
    }

    if (sortKey && sortKey !== "newest") {
      params.set("sort", sortKey);
    }

    const query = params.toString();
    return query ? `/?${query}` : "/";
  }

  function setActiveChip(serviceKey) {
    chips.forEach((chip) => {
      const isActive = chip.dataset.service === serviceKey;
      chip.classList.toggle("filter-chip--active", isActive);
      if (isActive && selectedServiceLabel) {
        selectedServiceLabel.textContent = chip.textContent.trim();
      }
    });
  }

  async function loadCatalog(url, serviceKey, shouldPushState) {
    closeModal();

    try {
      const response = await fetch(url, {
        headers: {
          "X-Requested-With": "XMLHttpRequest"
        }
      });

      if (!response.ok) {
        throw new Error("Catalog request failed");
      }

      const html = await response.text();
      container.innerHTML = html;
      setActiveChip(serviceKey);

      if (shouldPushState) {
        window.history.pushState({ service: serviceKey }, "", url);
      }
    } catch (error) {
      window.location.href = url;
    }
  }

  function getProductData(card) {
    const payload = card?.querySelector(".product-card__payload");
    if (!payload) {
      return null;
    }

    try {
      return JSON.parse(payload.textContent);
    } catch (error) {
      console.error("Cannot parse product payload", error);
      return null;
    }
  }

  function syncModalImage() {
    const currentImage = state.images[state.currentIndex];
    if (!currentImage) {
      return;
    }

    modalElements.mainImage.src = currentImage;
    modalElements.mainImage.alt = `${state.product.title} — изображение ${state.currentIndex + 1}`;
    modalElements.imageCounter.textContent = `${state.currentIndex + 1} / ${state.images.length}`;

    modalElements.prevButton.disabled = state.currentIndex === 0;
    modalElements.nextButton.disabled = state.currentIndex === state.images.length - 1;

    modalElements.thumbs.innerHTML = state.images
      .map(
        (imagePath, index) => `
          <button
            class="product-modal__thumb ${index === state.currentIndex ? "is-active" : ""}"
            type="button"
            data-thumb-index="${index}"
            aria-label="Открыть фото ${index + 1}"
          >
            <img src="${imagePath}" alt="">
          </button>
        `
      )
      .join("");
  }

  function openModal(product) {
    if (!product) {
      return;
    }

    state.product = product;
    state.images = Array.isArray(product.imagePaths) && product.imagePaths.length
      ? product.imagePaths
      : [];
    state.currentIndex = 0;

    modalElements.title.textContent = product.title;
    modalElements.description.textContent = product.description;
    modalElements.serviceLogo.src = product.serviceLogo;
    modalElements.serviceLogo.alt = product.serviceName;
    modalElements.serviceName.textContent = `Сервис: ${product.serviceName}`;
    modalElements.productType.textContent = `Тип: ${product.productType || "Программа"}`;
    modalElements.newBadge.hidden = !product.isNew;
    modalElements.vipBadge.hidden = !product.isVip;
    modalElements.date.textContent = product.dateLabel;
    modalElements.fileName.textContent = product.originalFileName;
    modalElements.dialog.classList.toggle("product-modal__dialog--vip", Boolean(product.isVip));

    if (product.canDownload) {
      modalElements.downloadButton.href = product.archivePath;
      modalElements.downloadButton.setAttribute("download", "");
      modalElements.downloadButton.classList.remove("button--ghost");
      modalElements.downloadButton.classList.add("button--primary");
      modalElements.downloadButton.textContent = `Скачать ${product.downloadLabel || "файл"}`;
      modalElements.downloadNote.textContent = `Файл для скачивания: ${product.originalFileName}`;
    } else {
      modalElements.downloadButton.href = "/login";
      modalElements.downloadButton.removeAttribute("download");
      modalElements.downloadButton.textContent = "Войти, чтобы скачать";
      modalElements.downloadButton.classList.remove("button--primary");
      modalElements.downloadButton.classList.add("button--ghost");
      modalElements.downloadNote.textContent =
        "Скачивание файла открывается только после входа в аккаунт.";
    }

    syncModalImage();
    modal.hidden = false;
    document.body.classList.add("is-modal-open");
  }

  function closeLightbox() {
    lightbox.hidden = true;
    lightboxElements.image.src = "";
    lightboxElements.image.alt = "";
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove("is-modal-open");
    closeLightbox();
  }

  function openLightbox() {
    const currentImage = state.images[state.currentIndex];
    if (!currentImage) {
      return;
    }

    lightboxElements.image.src = currentImage;
    lightboxElements.image.alt = `${state.product.title} — полноразмерный просмотр`;
    lightbox.hidden = false;
  }

  chips.forEach((chip) => {
    chip.addEventListener("click", (event) => {
      event.preventDefault();
      const nextUrl = buildCatalogUrl(chip.dataset.service, sortSelect.value);
      loadCatalog(nextUrl, chip.dataset.service, true);
    });
  });

  sortSelect.addEventListener("change", () => {
    const activeService =
      document.querySelector(".filter-chip--active")?.dataset.service || "all";
    const nextUrl = buildCatalogUrl(activeService, sortSelect.value);
    loadCatalog(nextUrl, activeService, true);
  });

  window.history.replaceState(
    {
      service: document.querySelector(".filter-chip--active")?.dataset.service || "all",
      sort: sortSelect.value
    },
    "",
    window.location.pathname + window.location.search
  );

  window.addEventListener("popstate", () => {
    const params = new URLSearchParams(window.location.search);
    const service = params.get("service") || "all";
    const sort = params.get("sort") || "newest";
    sortSelect.value = sort;
    loadCatalog(window.location.pathname + window.location.search, service, false);
  });

  container.addEventListener("click", (event) => {
    if (event.target.closest("[data-action='download'], [data-action='login-for-download']")) {
      return;
    }

    const card = event.target.closest(".product-card");
    if (!card) {
      return;
    }

    openModal(getProductData(card));
  });

  container.addEventListener("keydown", (event) => {
    const card = event.target.closest(".product-card");
    if (!card) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openModal(getProductData(card));
    }
  });

  modalElements.closeButtons.forEach((button) => {
    button.addEventListener("click", closeModal);
  });

  modalElements.prevButton.addEventListener("click", () => {
    if (state.currentIndex === 0) {
      return;
    }

    state.currentIndex -= 1;
    syncModalImage();
  });

  modalElements.nextButton.addEventListener("click", () => {
    if (state.currentIndex >= state.images.length - 1) {
      return;
    }

    state.currentIndex += 1;
    syncModalImage();
  });

  modalElements.thumbs.addEventListener("click", (event) => {
    const thumb = event.target.closest("[data-thumb-index]");
    if (!thumb) {
      return;
    }

    state.currentIndex = Number(thumb.dataset.thumbIndex);
    syncModalImage();
  });

  modalElements.mainImage.addEventListener("click", openLightbox);
  modalElements.openLightboxButton.addEventListener("click", openLightbox);

  lightboxElements.closeButtons.forEach((button) => {
    button.addEventListener("click", closeLightbox);
  });

  document.addEventListener("keydown", (event) => {
    if (!lightbox.hidden) {
      if (event.key === "Escape") {
        closeLightbox();
      }
      return;
    }

    if (modal.hidden) {
      return;
    }

    if (event.key === "Escape") {
      closeModal();
      return;
    }

    if (event.key === "ArrowLeft" && state.currentIndex > 0) {
      state.currentIndex -= 1;
      syncModalImage();
    }

    if (event.key === "ArrowRight" && state.currentIndex < state.images.length - 1) {
      state.currentIndex += 1;
      syncModalImage();
    }
  });
});
