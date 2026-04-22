const express = require("express");
const session = require("express-session");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { OAuth2Client } = require("google-auth-library");

const app = express();
const PORT = process.env.PORT || 3000;
const GOOGLE_CLIENT_ID =
  "255316714107-s2olg9d0u20iv54j0g4o10hmniaqvt7r.apps.googleusercontent.com";
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const UPLOADS_DIR = path.join(ROOT_DIR, "uploads");
const UPLOADS_IMAGES_DIR = path.join(UPLOADS_DIR, "images");
const UPLOADS_FILES_DIR = path.join(UPLOADS_DIR, "files");
const VIEWS_DIR = path.join(ROOT_DIR, "views");
const ADMINS_FILE = path.join(DATA_DIR, "admins.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");
const WISHES_FILE = path.join(DATA_DIR, "wishes.json");
const NOTIFICATIONS_FILE = path.join(DATA_DIR, "notifications.json");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");
const SESSION_SECRET =
  process.env.SESSION_SECRET || "change-this-secret-before-production";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = String(process.env.SMTP_SECURE || "false") === "true";
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER || "no-reply@example.com";

const SERVICES = {
  all: {
    key: "all",
    name: "Все сервисы",
    tagline: "Общий каталог расширений, приложений и готовых ZIP-пакетов."
  },
  litnet: {
    key: "litnet",
    name: "Litnet",
    tagline: "Утилиты и расширения для работы с Litnet.",
    logo: "/assets/brands/litnet.svg",
    accent: "#7a184a"
  },
  litmarket: {
    key: "litmarket",
    name: "Litmarket",
    tagline: "Мини-приложения и вспомогательные инструменты для Litmarket.",
    logo: "/assets/brands/litmarket.svg",
    accent: "#1973db"
  },
  litgorod: {
    key: "litgorod",
    name: "Litgorod",
    tagline: "Каталог решений и промо-инструментов для Litgorod.",
    logo: "/assets/brands/litgorod.svg",
    accent: "#0d8e7d"
  },
  vip: {
    key: "vip",
    name: "VIP-программы",
    tagline: "Отдельная категория для VIP-программ и премиальных решений.",
    accent: "#c69214"
  }
};

const CATALOG_SORTS = {
  newest: {
    key: "newest",
    label: "Сначала новые"
  },
  oldest: {
    key: "oldest",
    label: "Сначала старые"
  }
};

const WISH_STATUSES = {
  pending: {
    key: "pending",
    label: "На рассмотрении"
  },
  accepted: {
    key: "accepted",
    label: "Принято в работу"
  },
  completed: {
    key: "completed",
    label: "Выполнено"
  },
  rejected: {
    key: "rejected",
    label: "Отклонено"
  }
};

const REQUEST_TYPES = {
  wish: {
    key: "wish",
    label: "Пожелание",
    actionLabel: "пожелание",
    emptyTitle: "Пока нет пожеланий",
    emptyDescription:
      "Как только пользователь отправит пожелание, оно появится здесь.",
    userEmptyTitle: "Вы ещё не отправляли запросы",
    userEmptyDescription:
      "Оставьте пожелание или сообщите об ошибке, и статус появится в личном кабинете."
  },
  bug: {
    key: "bug",
    label: "Ошибка",
    actionLabel: "сообщение об ошибке",
    emptyTitle: "Пока нет сообщений об ошибках",
    emptyDescription:
      "Когда пользователь сообщит об ошибке в программе, запрос появится здесь.",
    userEmptyTitle: "Вы ещё не отправляли сообщения об ошибках",
    userEmptyDescription:
      "Сообщите, что работает не так, и мы покажем статус исправления в кабинете."
  }
};

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function ensureJsonFile(filePath, fallbackValue) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallbackValue, null, 2), "utf-8");
  }
}

function readJson(filePath, fallbackValue) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (error) {
    return fallbackValue;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf-8");
}

function nowIso() {
  return new Date().toISOString();
}

function getFutureSessionIso() {
  return new Date(Date.now() + SESSION_TTL_MS).toISOString();
}

class JsonSessionStore extends session.Store {
  constructor(filePath) {
    super();
    this.filePath = filePath;
  }

  readStore() {
    const payload = readJson(this.filePath, {});
    return payload && typeof payload === "object" ? payload : {};
  }

  writeStore(store) {
    writeJson(this.filePath, store);
  }

  pruneExpired() {
    const store = this.readStore();
    const now = Date.now();
    let hasChanges = false;

    Object.entries(store).forEach(([sid, record]) => {
      const expiresAt = Number(record?.expiresAt || 0);
      if (!expiresAt || expiresAt <= now) {
        delete store[sid];
        hasChanges = true;
      }
    });

    if (hasChanges) {
      this.writeStore(store);
    }
  }

  get(sid, callback) {
    try {
      this.pruneExpired();
      const store = this.readStore();
      const record = store[sid];

      if (!record) {
        callback?.(null, null);
        return;
      }

      callback?.(null, record.session || null);
    } catch (error) {
      callback?.(error);
    }
  }

  set(sid, sessionValue, callback) {
    try {
      const store = this.readStore();
      const expiresAt = sessionValue?.cookie?.expires
        ? new Date(sessionValue.cookie.expires).getTime()
        : Date.now() + Number(sessionValue?.cookie?.maxAge || SESSION_TTL_MS);

      store[sid] = {
        session: sessionValue,
        expiresAt
      };

      this.writeStore(store);
      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }

  destroy(sid, callback) {
    try {
      const store = this.readStore();
      delete store[sid];
      this.writeStore(store);
      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }

  touch(sid, sessionValue, callback) {
    this.set(sid, sessionValue, callback);
  }
}

function getServicesList() {
  return Object.values(SERVICES).filter(
    (service) => service.key !== "all" && service.key !== "vip"
  );
}

function removeFileIfExists(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function seedStorage() {
  ensureDir(DATA_DIR);
  ensureDir(PUBLIC_DIR);
  ensureDir(VIEWS_DIR);
  ensureDir(UPLOADS_IMAGES_DIR);
  ensureDir(UPLOADS_FILES_DIR);
  ensureJsonFile(ADMINS_FILE, []);
  ensureJsonFile(USERS_FILE, []);
  ensureJsonFile(WISHES_FILE, []);
  ensureJsonFile(NOTIFICATIONS_FILE, []);
  ensureJsonFile(SESSIONS_FILE, {});
  ensureJsonFile(PRODUCTS_FILE, [
    {
      id: "seed-litnet-dashboard",
      service: "litnet",
      title: "Litnet Dashboard Helper",
      description:
        "Утилита ускоряет навигацию по кабинету автора, собирает частые действия в одном окне и помогает быстрее переключаться между разделами, черновиками и статистикой. Внутри пакета можно настроить горячие сценарии для ежедневной работы.",
      imagePath: "/assets/products/sample-litnet-dashboard.svg",
      imagePaths: [
        "/assets/products/sample-litnet-dashboard.svg",
        "/assets/products/sample-litnet-dashboard-detail.svg"
      ],
      archivePath: "/files/sample-litnet-dashboard.zip",
      originalFileName: "litnet-dashboard-helper.zip",
      createdAt: "2026-04-22T00:00:00.000Z"
    },
    {
      id: "seed-litmarket-tags",
      service: "litmarket",
      title: "Litmarket Tags Booster",
      description:
        "Пакет для ускоренного заполнения карточек, заметок и внутренних релизных меток. Подходит для процессов, где важно быстро оформлять материалы, переключаться между задачами и держать структуру каталога под контролем.",
      imagePath: "/assets/products/sample-litmarket-tags.svg",
      imagePaths: [
        "/assets/products/sample-litmarket-tags.svg",
        "/assets/products/sample-litmarket-tags-detail.svg"
      ],
      archivePath: "/files/sample-litmarket-tags.zip",
      originalFileName: "litmarket-tags-booster.zip",
      createdAt: "2026-04-21T12:00:00.000Z"
    },
    {
      id: "seed-litgorod-kit",
      service: "litgorod",
      title: "Litgorod Promo Kit",
      description:
        "Готовый набор экранов и заготовок для оформления промо-страниц, баннеров и карточек продукта. Его можно использовать как стартовый комплект для публикаций, внутренних презентаций и визуального оформления витрины.",
      imagePath: "/assets/products/sample-litgorod-kit.svg",
      imagePaths: [
        "/assets/products/sample-litgorod-kit.svg",
        "/assets/products/sample-litgorod-kit-detail.svg"
      ],
      archivePath: "/files/sample-litgorod-kit.zip",
      originalFileName: "litgorod-promo-kit.zip",
      createdAt: "2026-04-20T16:30:00.000Z"
    }
  ]);
}

function readAdmins() {
  return readJson(ADMINS_FILE, []);
}

function writeAdmins(admins) {
  writeJson(ADMINS_FILE, admins);
}

function readUsers() {
  return readJson(USERS_FILE, []);
}

function writeUsers(users) {
  writeJson(USERS_FILE, users);
}

function updateAccountInStore(role, accountId, updater) {
  const readCollection = role === "admin" ? readAdmins : readUsers;
  const writeCollection = role === "admin" ? writeAdmins : writeUsers;
  const collection = readCollection();
  const index = collection.findIndex((item) => item.id === accountId);

  if (index === -1) {
    return null;
  }

  const nextValue =
    typeof updater === "function" ? updater(collection[index]) : collection[index];

  collection[index] = nextValue;
  writeCollection(collection);
  return nextValue;
}

function touchAccountLogin(role, accountId) {
  return updateAccountInStore(role, accountId, (account) => ({
    ...account,
    lastLoginAt: nowIso(),
    lastSeenAt: nowIso(),
    lastSessionExpiresAt: getFutureSessionIso(),
    loginCount: Number(account.loginCount || 0) + 1
  }));
}

function touchAccountActivity(role, accountId) {
  return updateAccountInStore(role, accountId, (account) => ({
    ...account,
    lastSeenAt: nowIso(),
    lastSessionExpiresAt: getFutureSessionIso()
  }));
}

function clearAccountSession(role, accountId) {
  return updateAccountInStore(role, accountId, (account) => ({
    ...account,
    lastSessionExpiresAt: null
  }));
}

function getAccountRoleLabel(role) {
  return role === "admin" ? "Администратор" : "Пользователь";
}

function getProviderLabel(provider, hasPassword) {
  if (provider === "google") {
    return "Google";
  }

  if (provider === "yandex") {
    return "Яндекс";
  }

  return hasPassword ? "Email" : "Не указан";
}

function getAdminAccountsView() {
  const now = Date.now();
  const admins = readAdmins().map((account) => ({
    ...account,
    role: "admin"
  }));
  const users = readUsers().map((account) => ({
    ...account,
    role: "user"
  }));

  return [...admins, ...users]
    .map((account) => {
      const hasPassword = Boolean(account.passwordHash);
      const sessionExpiresAt = account.lastSessionExpiresAt || null;
      const sessionIsActive = Boolean(
        sessionExpiresAt && new Date(sessionExpiresAt).getTime() > now
      );

      return {
        id: account.id,
        email: account.email,
        name: account.name || getDisplayNameFromEmail(account.email),
        role: account.role,
        roleLabel: getAccountRoleLabel(account.role),
        provider: account.provider || (hasPassword ? "email" : "unknown"),
        providerLabel: getProviderLabel(account.provider, hasPassword),
        createdAt: account.createdAt || null,
        lastLoginAt: account.lastLoginAt || null,
        lastSeenAt: account.lastSeenAt || null,
        lastSessionExpiresAt: sessionExpiresAt,
        sessionIsActive,
        loginCount: Number(account.loginCount || 0),
        hasPassword
      };
    })
    .sort((left, right) => {
      const leftDate = new Date(left.lastLoginAt || left.createdAt || 0).getTime();
      const rightDate = new Date(right.lastLoginAt || right.createdAt || 0).getTime();
      return rightDate - leftDate;
    });
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

function getDisplayNameFromEmail(email) {
  return normalizeEmail(email).split("@")[0] || "Пользователь";
}

function hashVerificationCode(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

function generateVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

let smtpTransporter = null;

function getMailTransporter() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null;
  }

  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });
  }

  return smtpTransporter;
}

async function sendVerificationEmail(email, code) {
  const transporter = getMailTransporter();

  if (!transporter) {
    console.log(`[auth] Verification code for ${email}: ${code}`);
    return {
      delivery: "console"
    };
  }

  await transporter.sendMail({
    from: SMTP_FROM,
    to: email,
    subject: "Код подтверждения регистрации",
    text: `Ваш код подтверждения: ${code}. Код действует 10 минут.`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 24px; color: #111827;">
        <h2 style="margin: 0 0 12px;">Подтверждение регистрации</h2>
        <p style="margin: 0 0 16px;">Введите этот код на сайте, чтобы завершить регистрацию.</p>
        <div style="font-size: 32px; font-weight: 700; letter-spacing: 8px;">${code}</div>
        <p style="margin: 16px 0 0; color: #6b7280;">Код действует 10 минут.</p>
      </div>
    `
  });

  return {
    delivery: "email"
  };
}

function resolveCurrentUser(req) {
  const admins = readAdmins();
  const users = readUsers();

  if (!req.session.userId) {
    return null;
  }

  const role = req.session.userRole || "admin";

  if (role === "admin") {
    const admin = admins.find((item) => item.id === req.session.userId);

    if (!admin) {
      return null;
    }

    return {
      id: admin.id,
      email: admin.email,
      name: admin.name || getDisplayNameFromEmail(admin.email),
      picture: admin.picture || null,
      provider: admin.provider || "email",
      isAdmin: true
    };
  }

  const user = users.find((item) => item.id === req.session.userId);

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name || getDisplayNameFromEmail(user.email),
    picture: user.picture || null,
    provider: user.provider || "email",
    isAdmin: false
  };
}

function findAccountByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  const admin = readAdmins().find((item) => item.email === normalizedEmail);

  if (admin) {
    return {
      role: "admin",
      account: admin
    };
  }

  const user = readUsers().find((item) => item.email === normalizedEmail);

  if (user) {
    return {
      role: "user",
      account: user
    };
  }

  return null;
}

function signInUser(req, account) {
  req.session.userId = account.id;
  req.session.userRole = account.role;
  req.session.cookie.maxAge = SESSION_TTL_MS;
  req.session.lastAccountTouchAt = Date.now();
  delete req.session.socialUser;
  delete req.session.pendingEmailAuth;
  touchAccountLogin(account.role, account.id);
}

function upsertSocialUser(profile) {
  const email = normalizeEmail(profile.email);
  const admins = readAdmins();
  const admin = admins.find((item) => item.email === email);

  if (admin) {
    return {
      id: admin.id,
      role: "admin"
    };
  }

  if (admins.length === 0) {
    const newAdmin = {
      id: crypto.randomUUID(),
      email,
      name: profile.name || getDisplayNameFromEmail(email),
      picture: profile.picture || null,
      provider: profile.provider,
      createdAt: nowIso()
    };

    admins.push(newAdmin);
    writeAdmins(admins);

    return {
      id: newAdmin.id,
      role: "admin"
    };
  }

  const users = readUsers();
  const userIndex = users.findIndex((item) => item.email === email);

  if (userIndex === -1) {
    users.push({
      id: crypto.randomUUID(),
      email,
      name: profile.name || getDisplayNameFromEmail(email),
      picture: profile.picture || null,
      provider: profile.provider,
      createdAt: nowIso()
    });
  } else {
    users[userIndex] = {
      ...users[userIndex],
      name: profile.name || users[userIndex].name,
      picture: profile.picture || users[userIndex].picture || null,
      provider: profile.provider || users[userIndex].provider
    };
  }

  writeUsers(users);

  const user = users.find((item) => item.email === email);
  return {
    id: user.id,
    role: "user"
  };
}

function getProductImagePaths(product) {
  const rawPaths = Array.isArray(product.imagePaths)
    ? product.imagePaths
    : product.imagePath
      ? [product.imagePath]
      : [];

  return [...new Set(rawPaths.filter(Boolean))];
}

function getProductFileExtension(product) {
  return path.extname(product.originalFileName || product.archivePath || "").toLowerCase();
}

function inferProductType(product) {
  if (String(product.productType || "").trim()) {
    return String(product.productType).trim();
  }

  return getProductFileExtension(product) === ".exe" ? "EXE" : "Расширение";
}

function getDownloadLabel(product) {
  const extension = getProductFileExtension(product);

  if (extension === ".exe") {
    return "EXE";
  }

  if (extension === ".zip") {
    return "ZIP";
  }

  return "Файл";
}

function normalizeProduct(product) {
  const imagePaths = getProductImagePaths(product);

  return {
    ...product,
    isVip: Boolean(product.isVip),
    isNew: Boolean(product.isNew),
    productType: inferProductType(product),
    downloadLabel: getDownloadLabel(product),
    imagePaths,
    imagePath: imagePaths[0] || product.imagePath || "",
    originalFileName:
      product.originalFileName ||
      path.basename(product.archivePath || "download.zip")
  };
}

function readProducts() {
  return readJson(PRODUCTS_FILE, []).map(normalizeProduct);
}

function writeProducts(products) {
  writeJson(
    PRODUCTS_FILE,
    products.map((product) => {
      const normalized = normalizeProduct(product);

      return {
        id: normalized.id,
        service: normalized.service,
        isVip: normalized.isVip,
        isNew: normalized.isNew,
        productType: normalized.productType,
        title: normalized.title,
        description: normalized.description,
        imagePath: normalized.imagePath,
        imagePaths: normalized.imagePaths,
        archivePath: normalized.archivePath,
        originalFileName: normalized.originalFileName,
        createdAt: normalized.createdAt || nowIso()
      };
    })
  );
}

function isUploadedImagePath(filePath) {
  return typeof filePath === "string" && filePath.startsWith("/images/");
}

function isUploadedArchivePath(filePath) {
  return typeof filePath === "string" && filePath.startsWith("/files/");
}

function removeProductImages(product) {
  normalizeProduct(product).imagePaths.forEach((imagePath) => {
    if (!isUploadedImagePath(imagePath)) {
      return;
    }

    removeFileIfExists(path.join(UPLOADS_IMAGES_DIR, path.basename(imagePath)));
  });
}

function removeProductArchive(product) {
  if (!isUploadedArchivePath(product.archivePath)) {
    return;
  }

  removeFileIfExists(
    path.join(UPLOADS_FILES_DIR, path.basename(product.archivePath))
  );
}

function getUploadedFiles(req) {
  return Object.values(req.files || {}).flat();
}

function cleanupUploadedFiles(req) {
  getUploadedFiles(req).forEach((file) => removeFileIfExists(file.path));
}

function readWishes() {
  return readJson(WISHES_FILE, []).map((wish) => {
    const status = WISH_STATUSES[wish.status] ? wish.status : "pending";
    const requestType = REQUEST_TYPES[wish.requestType] ? wish.requestType : "wish";

    return {
      ...wish,
      status,
      requestType,
      requestTypeLabel: REQUEST_TYPES[requestType].label,
      statusLabel: WISH_STATUSES[status].label
    };
  });
}

function writeWishes(wishes) {
  writeJson(
    WISHES_FILE,
    wishes.map((wish) => ({
      id: wish.id,
      userId: wish.userId,
      userEmail: wish.userEmail,
      userName: wish.userName,
      requestType: wish.requestType || "wish",
      service: wish.service,
      productId: wish.productId || null,
      productTitle: wish.productTitle || null,
      description: wish.description,
      status: wish.status,
      createdAt: wish.createdAt,
      updatedAt: wish.updatedAt || wish.createdAt,
      acceptedAt: wish.acceptedAt || null,
      completedAt: wish.completedAt || null,
      rejectedAt: wish.rejectedAt || null,
      handledByAdminId: wish.handledByAdminId || null
    }))
  );
}

function readNotifications() {
  return readJson(NOTIFICATIONS_FILE, []).map((notification) => ({
    ...notification,
    href: notification.href || "/account",
    readAt: notification.readAt || null
  }));
}

function writeNotifications(notifications) {
  writeJson(
    NOTIFICATIONS_FILE,
    notifications.map((notification) => ({
      id: notification.id,
      recipientId: notification.recipientId,
      title: notification.title,
      message: notification.message,
      href: notification.href || "/account",
      createdAt: notification.createdAt || nowIso(),
      readAt: notification.readAt || null
    }))
  );
}

function pushNotifications(nextNotifications) {
  if (!Array.isArray(nextNotifications) || !nextNotifications.length) {
    return;
  }

  const notifications = readNotifications();
  writeNotifications([...nextNotifications, ...notifications]);
}

function notifyUser(recipientId, title, message, href = "/account") {
  pushNotifications([
    {
      id: crypto.randomUUID(),
      recipientId,
      title,
      message,
      href,
      createdAt: nowIso(),
      readAt: null
    }
  ]);
}

function notifyAdmins(title, message, href = "/account") {
  const adminNotifications = readAdmins().map((admin) => ({
    id: crypto.randomUUID(),
    recipientId: admin.id,
    title,
    message,
    href,
    createdAt: nowIso(),
    readAt: null
  }));

  pushNotifications(adminNotifications);
}

function getNotificationsForUser(user) {
  if (!user) {
    return [];
  }

  return readNotifications()
    .filter((notification) => notification.recipientId === user.id)
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
}

function markNotificationsAsRead(userId) {
  let hasChanges = false;
  const notifications = readNotifications().map((notification) => {
    if (notification.recipientId !== userId || notification.readAt) {
      return notification;
    }

    hasChanges = true;
    return {
      ...notification,
      readAt: nowIso()
    };
  });

  if (hasChanges) {
    writeNotifications(notifications);
  }
}

function buildWishSteps(status) {
  const rankMap = {
    pending: 1,
    accepted: 2,
    completed: 3,
    rejected: 1
  };
  const currentRank = rankMap[status] || 1;

  return [
    {
      key: "pending",
      label: "На рассмотрении",
      completed: currentRank > 1,
      current: currentRank === 1
    },
    {
      key: "accepted",
      label: "Принято в работу",
      completed: currentRank > 2,
      current: currentRank === 2
    },
    {
      key: "completed",
      label: "Выполнено",
      completed: currentRank > 3,
      current: currentRank === 3
    }
  ];
}

function buildRequestTitle(request) {
  const serviceName = SERVICES[request.service]?.name || request.service;
  return request.requestType === "bug"
    ? `Ошибка в ${request.productTitle || serviceName}`
    : `Пожелание для ${serviceName}`;
}

function getWishPreview(description) {
  const normalized = String(description || "").replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "Новый запрос";
  }

  return normalized.length > 72 ? `${normalized.slice(0, 69)}...` : normalized;
}

function validateServiceKey(service) {
  return SERVICES[service] && service !== "all" && service !== "vip";
}

function getRequestNotificationCopy(request, serviceName) {
  if (request.requestType === "bug") {
    return {
      createdAdminTitle: "Новое сообщение об ошибке",
      createdAdminMessage: `${request.userName} сообщил(а) об ошибке в программе ${request.productTitle || serviceName}.`,
      acceptedUserTitle: "Ошибка принята в работу",
      acceptedUserMessage: `Мы приняли сообщение об ошибке по программе ${request.productTitle || serviceName} и уже проверяем её.`,
      completedUserTitle: "Ошибка исправлена",
      completedUserMessage: `Сообщение об ошибке по программе ${request.productTitle || serviceName} отмечено как выполненное.`,
      rejectedUserTitle: "Сообщение об ошибке отклонено",
      rejectedUserMessage: `Сообщение об ошибке по программе ${request.productTitle || serviceName} было отклонено администратором.`
    };
  }

  return {
    createdAdminTitle: "Новое пожелание",
    createdAdminMessage: `${request.userName} оставил(а) пожелание для ${serviceName}.`,
    acceptedUserTitle: "Пожелание взято в работу",
    acceptedUserMessage: `Ваш запрос для ${serviceName} принят и уже в работе.`,
    completedUserTitle: "Пожелание выполнено",
    completedUserMessage:
      "Ваше пожелание выполнено. Проверьте каталог товаров и новые продукты.",
    rejectedUserTitle: "Пожелание отклонено",
    rejectedUserMessage: `Запрос для ${serviceName} был отклонён администратором.`
  };
}

function sortProducts(products, selectedSort) {
  const items = [...products];

  if (selectedSort === "oldest") {
    return items.sort(
      (left, right) => new Date(left.createdAt) - new Date(right.createdAt)
    );
  }

  return items.sort((left, right) => {
    if (Boolean(left.isNew) !== Boolean(right.isNew)) {
      return Number(Boolean(right.isNew)) - Number(Boolean(left.isNew));
    }

    return new Date(right.createdAt) - new Date(left.createdAt);
  });
}

seedStorage();

app.set("view engine", "ejs");
app.set("views", VIEWS_DIR);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    store: new JsonSessionStore(SESSIONS_FILE),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: SESSION_TTL_MS
    }
  })
);

app.use(express.static(PUBLIC_DIR));
app.use("/images", express.static(UPLOADS_IMAGES_DIR));

app.use((req, res, next) => {
  const admins = readAdmins();
  const currentUser = resolveCurrentUser(req);
  const notifications = getNotificationsForUser(currentUser);

  const flash = req.session.flash || null;
  delete req.session.flash;

  res.locals.currentUser = currentUser;
  res.locals.flash = flash;
  res.locals.services = getServicesList();
  res.locals.hasAdmins = admins.length > 0;
  res.locals.allowOpenRegistration = true;
  res.locals.currentYear = new Date().getFullYear();
  res.locals.isSignedIn = Boolean(currentUser);
  res.locals.notifications = notifications.slice(0, 6);
  res.locals.unreadNotificationsCount = notifications.filter(
    (notification) => !notification.readAt
  ).length;

  if (currentUser) {
    const lastTouchAt = Number(req.session.lastAccountTouchAt || 0);
    if (!lastTouchAt || Date.now() - lastTouchAt > 1000 * 60 * 30) {
      touchAccountActivity(currentUser.isAdmin ? "admin" : "user", currentUser.id);
      req.session.lastAccountTouchAt = Date.now();
    }
  }

  next();
});

const storage = multer.diskStorage({
  destination(req, file, cb) {
    if (file.fieldname === "image" || file.fieldname === "images") {
      cb(null, UPLOADS_IMAGES_DIR);
      return;
    }

    cb(null, UPLOADS_FILES_DIR);
  },
  filename(req, file, cb) {
    const extension = path.extname(file.originalname).toLowerCase();
    const safeBase = path
      .basename(file.originalname, extension)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 50);

    cb(null, `${Date.now()}-${safeBase || "file"}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024
  },
  fileFilter(req, file, cb) {
    const extension = path.extname(file.originalname).toLowerCase();

    if (file.fieldname === "image" || file.fieldname === "images") {
      const allowedImageExtensions = new Set([
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
        ".svg"
      ]);

      if (!allowedImageExtensions.has(extension)) {
        cb(
          new Error("Изображение должно быть в формате PNG, JPG, WEBP или SVG.")
        );
        return;
      }
    }

    if (file.fieldname === "archive" && !new Set([".zip", ".exe"]).has(extension)) {
      cb(new Error("Файл продукта должен быть в формате ZIP или EXE."));
      return;
    }

    cb(null, true);
  }
});

function setFlash(req, type, message) {
  req.session.flash = { type, message };
}

function requireAdmin(req, res, next) {
  if (!res.locals.currentUser || !res.locals.currentUser.isAdmin) {
    setFlash(req, "error", "Доступ к этой части сайта открыт только администраторам.");
    res.redirect("/login");
    return;
  }

  next();
}

function requireSignedIn(req, res, next) {
  if (!res.locals.currentUser) {
    setFlash(req, "error", "Сначала войдите в аккаунт.");
    res.redirect("/login");
    return;
  }

  next();
}

app.post("/api/auth/google", async (req, res) => {
  const { credential } = req.body;

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();

    const account = upsertSocialUser({
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      provider: "google"
    });

    signInUser(req, account);
    res.json({
      success: true,
      redirectTo: account.role === "admin" ? "/account" : "/"
    });
  } catch (error) {
    console.error("Google Auth Error:", error);
    res.status(401).json({ error: "Invalid token" });
  }
});

app.post("/api/auth/yandex", async (req, res) => {
  const { access_token: accessToken } = req.body;

  try {
    const response = await fetch("https://login.yandex.ru/info?format=json", {
      headers: { Authorization: `OAuth ${accessToken}` }
    });

    if (!response.ok) {
      throw new Error("Yandex API error");
    }

    const data = await response.json();

    const account = upsertSocialUser({
      email: data.default_email,
      name: data.real_name || data.display_name,
      picture: data.is_avatar_empty
        ? null
        : `https://avatars.yandex.net/get-yapic/${data.default_avatar_id}/islands-200`,
      provider: "yandex"
    });

    signInUser(req, account);
    res.json({
      success: true,
      redirectTo: account.role === "admin" ? "/account" : "/"
    });
  } catch (error) {
    console.error("Yandex Auth Error:", error);
    res.status(401).json({ error: "Invalid token" });
  }
});

app.post("/api/auth/email/request", async (req, res) => {
  const mode = req.body.mode === "login" ? "login" : "register";
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");
  const confirmPassword = String(req.body.confirmPassword || "");

  if (mode !== "register") {
    res.status(400).json({ error: "Код подтверждения нужен только для регистрации." });
    return;
  }

  if (!isValidEmail(email)) {
    res.status(400).json({ error: "Укажите корректный email." });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: "Пароль должен содержать минимум 6 символов." });
    return;
  }

  if (password !== confirmPassword) {
    res.status(400).json({ error: "Подтверждение пароля не совпадает." });
    return;
  }

  if (findAccountByEmail(email)) {
    res.status(409).json({ error: "Этот email уже зарегистрирован." });
    return;
  }

  const code = generateVerificationCode();
  const passwordHash = await bcrypt.hash(password, 10);
  const deliveryResult = await sendVerificationEmail(email, code);

  req.session.pendingEmailAuth = {
    mode,
    email,
    passwordHash,
    codeHash: hashVerificationCode(code),
    expiresAt: Date.now() + 10 * 60 * 1000
  };

  res.json({
    success: true,
    delivery: deliveryResult.delivery,
    debugCode:
      deliveryResult.delivery === "console" && process.env.NODE_ENV !== "production"
        ? code
        : undefined
  });
});

app.post("/api/auth/email/verify", (req, res) => {
  const code = String(req.body.code || "").trim();
  const pending = req.session.pendingEmailAuth;

  if (!pending) {
    res.status(400).json({ error: "Сначала запросите код подтверждения." });
    return;
  }

  if (Date.now() > Number(pending.expiresAt || 0)) {
    delete req.session.pendingEmailAuth;
    res.status(410).json({ error: "Срок действия кода истёк. Запросите новый код." });
    return;
  }

  if (!/^\d{6}$/.test(code)) {
    res.status(400).json({ error: "Введите 6 цифр кода." });
    return;
  }

  if (hashVerificationCode(code) !== pending.codeHash) {
    res.status(401).json({ error: "Неверный код подтверждения." });
    return;
  }

  if (findAccountByEmail(pending.email)) {
    delete req.session.pendingEmailAuth;
    res.status(409).json({ error: "Этот email уже зарегистрирован." });
    return;
  }

  const admins = readAdmins();
  const shouldCreateAdmin = admins.length === 0;
  const account = {
    id: crypto.randomUUID(),
    email: pending.email,
    passwordHash: pending.passwordHash,
    name: getDisplayNameFromEmail(pending.email),
    provider: "email",
    createdAt: nowIso()
  };

  if (shouldCreateAdmin) {
    admins.push(account);
    writeAdmins(admins);
    signInUser(req, { id: account.id, role: "admin" });
  } else {
    const users = readUsers();
    users.push(account);
    writeUsers(users);
    signInUser(req, { id: account.id, role: "user" });
  }

  res.json({
    success: true,
    redirectTo: shouldCreateAdmin ? "/account" : "/"
  });
});

app.get("/", (req, res) => {
  const selectedService = SERVICES[req.query.service] ? req.query.service : "all";
  const selectedSort = CATALOG_SORTS[req.query.sort] ? req.query.sort : "newest";
  const allProducts = sortProducts(readProducts(), "newest");
  const filteredProducts = allProducts.filter((product) => {
    if (selectedService === "all") {
      return true;
    }

    if (selectedService === "vip") {
      return product.isVip;
    }

    return product.service === selectedService;
  });
  const products = sortProducts(filteredProducts, selectedSort);

  const templateData = {
    pageTitle: "Каталог расширений и приложений",
    selectedService,
    selectedSort,
    sortOptions: CATALOG_SORTS,
    stats: {
      totalProducts: allProducts.length,
      totalServices: getServicesList().length
    },
    products,
    serviceMap: SERVICES,
    selectableProducts: allProducts
  };

  if (req.headers["x-requested-with"] === "XMLHttpRequest") {
    res.render("partials/product-grid", templateData);
    return;
  }

  res.render("index", templateData);
});

app.get("/login", (req, res) => {
  if (res.locals.currentUser) {
    res.redirect(res.locals.currentUser.isAdmin ? "/account" : "/");
    return;
  }

  res.render("auth", {
    pageTitle: "Вход",
    mode: "login"
  });
});

app.post("/login", async (req, res) => {
  setFlash(req, "error", "Вход по почте отключён. Используйте Google или Яндекс ID.");
  res.redirect("/login");
});

app.get("/register", (req, res) => {
  if (res.locals.currentUser) {
    res.redirect(res.locals.currentUser.isAdmin ? "/account" : "/");
    return;
  }

  res.render("auth", {
    pageTitle: "Регистрация",
    mode: "register"
  });
});

app.post("/register", async (req, res) => {
  setFlash(req, "error", "Для регистрации по почте сначала запросите код подтверждения.");
  res.redirect("/register");
});

app.post("/api/notifications/read", requireSignedIn, (req, res) => {
  markNotificationsAsRead(res.locals.currentUser.id);
  res.json({ success: true });
});

app.post("/wishes", requireSignedIn, (req, res) => {
  if (res.locals.currentUser.isAdmin) {
    setFlash(req, "error", "Администратор не может отправить пользовательское пожелание.");
    res.redirect("/account");
    return;
  }

  const service = String(req.body.service || "");
  const description = String(req.body.description || "").trim();

  if (!validateServiceKey(service)) {
    setFlash(req, "error", "Выберите Litnet, Litmarket или Litgorod.");
    res.redirect("/account");
    return;
  }

  if (description.length < 10) {
    setFlash(req, "error", "Опишите пожелание подробнее, хотя бы в 10 символов.");
    res.redirect("/account");
    return;
  }

  const wishes = readWishes();
  const currentUser = res.locals.currentUser;
  const newWish = {
    id: crypto.randomUUID(),
    userId: currentUser.id,
    userEmail: currentUser.email,
    userName: currentUser.name,
    service,
    description,
    status: "pending",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    acceptedAt: null,
    completedAt: null,
    rejectedAt: null,
    handledByAdminId: null
  };

  wishes.unshift(newWish);
  writeWishes(wishes);

  notifyAdmins(
    "Новое пожелание",
    `${currentUser.name} оставил запрос для ${SERVICES[service].name}.`
  );

  setFlash(req, "success", "Пожелание отправлено. Его статус появится в личном кабинете.");
  res.redirect("/account");
});

app.post("/issues", requireSignedIn, (req, res) => {
  if (res.locals.currentUser.isAdmin) {
    setFlash(req, "error", "Администратор не может отправить сообщение об ошибке как пользователь.");
    res.redirect("/account");
    return;
  }

  const productId = String(req.body.productId || "").trim();
  const description = String(req.body.description || "").trim();
  const product = readProducts().find((item) => item.id === productId);

  if (!product) {
    setFlash(req, "error", "Выберите программу из списка.");
    res.redirect("/account");
    return;
  }

  if (description.length < 10) {
    setFlash(req, "error", "Опишите ошибку подробнее, хотя бы в 10 символов.");
    res.redirect("/account");
    return;
  }

  const currentUser = res.locals.currentUser;
  const wishes = readWishes();
  const newIssue = {
    id: crypto.randomUUID(),
    userId: currentUser.id,
    userEmail: currentUser.email,
    userName: currentUser.name,
    requestType: "bug",
    service: product.service,
    productId: product.id,
    productTitle: product.title,
    description,
    status: "pending",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    acceptedAt: null,
    completedAt: null,
    rejectedAt: null,
    handledByAdminId: null
  };

  wishes.unshift(newIssue);
  writeWishes(wishes);

  notifyAdmins(
    "Найдена ошибка",
    `${currentUser.name} сообщил(а) об ошибке в программе ${product.title}.`
  );

  setFlash(req, "success", "Сообщение об ошибке отправлено. Статус появится в личном кабинете.");
  res.redirect("/account");
});

app.get("/account", requireSignedIn, (req, res) => {
  const currentUser = res.locals.currentUser;
  const wishes = readWishes().sort(
    (left, right) => new Date(right.createdAt) - new Date(left.createdAt)
  );
  const allProducts = sortProducts(readProducts(), "newest");
  const products = allProducts;
  const usersById = new Map(readUsers().map((user) => [user.id, user]));
  const adminsById = new Map(readAdmins().map((admin) => [admin.id, admin]));

  const decorateWish = (wish) => ({
    ...wish,
    preview: getWishPreview(wish.description),
    steps: buildWishSteps(wish.status),
    serviceName: SERVICES[wish.service]?.name || wish.service,
    title: buildRequestTitle(wish),
    requesterName:
      wish.userName ||
      usersById.get(wish.userId)?.name ||
      getDisplayNameFromEmail(wish.userEmail),
    requesterEmail: wish.userEmail || usersById.get(wish.userId)?.email || "",
    assignedAdminName: wish.handledByAdminId
      ? adminsById.get(wish.handledByAdminId)?.name ||
        adminsById.get(wish.handledByAdminId)?.email
      : null
  });

  if (currentUser.isAdmin) {
    const adminWishes = wishes.map(decorateWish);
    const adminAccounts = getAdminAccountsView();

    res.render("account", {
      pageTitle: "Личный кабинет",
      accountMode: "admin",
      myWishes: [],
      adminWishes,
      adminAccounts,
      products,
      stats: {
        totalProducts: products.length,
        pendingWishes: adminWishes.filter((wish) => wish.status === "pending").length,
        acceptedWishes: adminWishes.filter((wish) => wish.status === "accepted").length,
        completedWishes: adminWishes.filter((wish) => wish.status === "completed").length,
        totalAccounts: adminAccounts.length,
        activeAccounts: adminAccounts.filter((account) => account.sessionIsActive).length
      },
      serviceMap: SERVICES,
      requestTypes: REQUEST_TYPES,
      selectableProducts: allProducts
    });
    return;
  }

  const myWishes = wishes
    .filter((wish) => wish.userId === currentUser.id)
    .map(decorateWish);

  res.render("account", {
    pageTitle: "Личный кабинет",
    accountMode: "user",
    myWishes,
    adminWishes: [],
    adminAccounts: [],
    products: products.slice(0, 3),
    stats: {
      totalWishes: myWishes.length,
      activeWishes: myWishes.filter((wish) => wish.status === "accepted").length,
      completedWishes: myWishes.filter((wish) => wish.status === "completed").length,
      unreadNotifications: res.locals.unreadNotificationsCount
    },
    serviceMap: SERVICES,
    requestTypes: REQUEST_TYPES,
    selectableProducts: allProducts
  });
});

app.post("/account/wishes/:id/status", requireAdmin, (req, res) => {
  const wishes = readWishes();
  const wishIndex = wishes.findIndex((wish) => wish.id === req.params.id);

  if (wishIndex === -1) {
    setFlash(req, "error", "Пожелание не найдено.");
    res.redirect("/account");
    return;
  }

  const action = String(req.body.action || "");
  const wish = wishes[wishIndex];
  const currentUser = res.locals.currentUser;
  const serviceName = SERVICES[wish.service]?.name || wish.service;
  const updatedAt = nowIso();
  const notificationCopy = getRequestNotificationCopy(wish, serviceName);

  if (action === "accept") {
    if (wish.status === "completed") {
      setFlash(req, "error", "Выполненное пожелание нельзя снова взять в работу.");
      res.redirect("/account");
      return;
    }

    wishes[wishIndex] = {
      ...wish,
      status: "accepted",
      acceptedAt: wish.acceptedAt || updatedAt,
      rejectedAt: null,
      updatedAt,
      handledByAdminId: currentUser.id
    };
    writeWishes(wishes);
    notifyUser(
      wish.userId,
      notificationCopy.acceptedUserTitle,
      notificationCopy.acceptedUserMessage
    );
    setFlash(
      req,
      "success",
      wish.requestType === "bug"
        ? "Сообщение об ошибке переведено в работу."
        : "Пожелание переведено в работу."
    );
    res.redirect("/account");
    return;
  }

  if (action === "complete") {
    if (wish.status !== "accepted") {
      setFlash(req, "error", "Сначала возьмите пожелание в работу.");
      res.redirect("/account");
      return;
    }

    wishes[wishIndex] = {
      ...wish,
      status: "completed",
      acceptedAt: wish.acceptedAt || updatedAt,
      completedAt: updatedAt,
      rejectedAt: null,
      updatedAt,
      handledByAdminId: currentUser.id
    };
    writeWishes(wishes);
    notifyUser(
      wish.userId,
      notificationCopy.completedUserTitle,
      notificationCopy.completedUserMessage
    );
    setFlash(
      req,
      "success",
      wish.requestType === "bug"
        ? "Сообщение об ошибке отмечено как выполненное."
        : "Пожелание отмечено как выполненное."
    );
    res.redirect("/account");
    return;
  }

  if (action === "reject") {
    if (wish.status === "completed") {
      setFlash(req, "error", "Выполненное пожелание нельзя отклонить.");
      res.redirect("/account");
      return;
    }

    wishes[wishIndex] = {
      ...wish,
      status: "rejected",
      rejectedAt: updatedAt,
      updatedAt,
      handledByAdminId: currentUser.id
    };
    writeWishes(wishes);
    notifyUser(
      wish.userId,
      notificationCopy.rejectedUserTitle,
      notificationCopy.rejectedUserMessage
    );
    setFlash(
      req,
      "success",
      wish.requestType === "bug"
        ? "Сообщение об ошибке отклонено."
        : "Пожелание отклонено."
    );
    res.redirect("/account");
    return;
  }

  setFlash(req, "error", "Неизвестное действие.");
  res.redirect("/account");
});

app.get("/admin", requireAdmin, (req, res) => {
  const products = readProducts().sort(
    (left, right) => new Date(right.createdAt) - new Date(left.createdAt)
  );

  res.render("admin", {
    pageTitle: "Админ-панель",
    products,
    productToEdit: null,
    serviceMap: SERVICES
  });
});

app.post(
  "/admin/products",
  requireAdmin,
  upload.fields([
    { name: "images", maxCount: 8 },
    { name: "archive", maxCount: 1 }
  ]),
  (req, res) => {
    const imageFiles = req.files?.images || [];
    const archiveFile = req.files?.archive?.[0];
    const service = String(req.body.service || "");
    const isVip = String(req.body.programType || "regular") === "vip";
    const isNew = String(req.body.isNew || "") === "on";
    const productType = String(req.body.productType || "").trim();
    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim();

    if (!SERVICES[service] || service === "all" || service === "vip") {
      cleanupUploadedFiles(req);
      setFlash(req, "error", "Выберите один из сервисов.");
      res.redirect("/admin");
      return;
    }

    if (!title || !description || !imageFiles.length || !archiveFile) {
      cleanupUploadedFiles(req);
      setFlash(
        req,
        "error",
        "Заполните название, описание, добавьте хотя бы одно изображение и файл ZIP или EXE."
      );
      res.redirect("/admin");
      return;
    }

    const imagePaths = imageFiles.map((file) => `/images/${file.filename}`);
    const products = readProducts();

    products.push({
      id: crypto.randomUUID(),
      service,
      isVip,
      isNew,
      productType,
      title,
      description,
      imagePath: imagePaths[0],
      imagePaths,
      archivePath: `/files/${archiveFile.filename}`,
      originalFileName: archiveFile.originalname,
      createdAt: nowIso()
    });

    writeProducts(products);
    setFlash(req, "success", "Продукт опубликован.");
    res.redirect("/admin");
  }
);

app.get("/admin/products/:id/edit", requireAdmin, (req, res) => {
  const products = readProducts().sort(
    (left, right) => new Date(right.createdAt) - new Date(left.createdAt)
  );
  const productToEdit = products.find((product) => product.id === req.params.id);

  if (!productToEdit) {
    setFlash(req, "error", "Продукт не найден.");
    res.redirect("/admin");
    return;
  }

  res.render("admin", {
    pageTitle: "Редактировать продукт",
    products,
    productToEdit,
    serviceMap: SERVICES
  });
});

app.post(
  "/admin/products/:id/edit",
  requireAdmin,
  upload.fields([
    { name: "images", maxCount: 8 },
    { name: "archive", maxCount: 1 }
  ]),
  (req, res) => {
    const products = readProducts();
    const productIndex = products.findIndex((product) => product.id === req.params.id);

    if (productIndex === -1) {
      cleanupUploadedFiles(req);
      setFlash(req, "error", "Продукт не найден.");
      res.redirect("/admin");
      return;
    }

    const currentProduct = normalizeProduct(products[productIndex]);
    const imageFiles = req.files?.images || [];
    const archiveFile = req.files?.archive?.[0];
    const service = String(req.body.service || "");
    const isVip = String(req.body.programType || "regular") === "vip";
    const isNew = String(req.body.isNew || "") === "on";
    const productType = String(req.body.productType || "").trim();
    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim();

    if (
      !SERVICES[service] ||
      service === "all" ||
      service === "vip" ||
      !title ||
      !description
    ) {
      cleanupUploadedFiles(req);
      setFlash(req, "error", "Заполните сервис, название и описание продукта.");
      res.redirect(`/admin/products/${req.params.id}/edit`);
      return;
    }

    const nextImagePaths = imageFiles.length
      ? imageFiles.map((file) => `/images/${file.filename}`)
      : currentProduct.imagePaths;

    if (!nextImagePaths.length) {
      cleanupUploadedFiles(req);
      setFlash(req, "error", "У продукта должно остаться хотя бы одно изображение.");
      res.redirect(`/admin/products/${req.params.id}/edit`);
      return;
    }

    if (imageFiles.length) {
      removeProductImages(currentProduct);
    }

    if (archiveFile) {
      removeProductArchive(currentProduct);
    }

    products[productIndex] = {
      ...currentProduct,
      service,
      isVip,
      isNew,
      productType,
      title,
      description,
      imagePath: nextImagePaths[0],
      imagePaths: nextImagePaths,
      archivePath: archiveFile
        ? `/files/${archiveFile.filename}`
        : currentProduct.archivePath,
      originalFileName: archiveFile
        ? archiveFile.originalname
        : currentProduct.originalFileName
    };

    writeProducts(products);
    setFlash(req, "success", "Продукт обновлён.");
    res.redirect("/admin");
  }
);

app.post("/admin/products/:id/delete", requireAdmin, (req, res) => {
  const products = readProducts();
  const productToDelete = products.find((product) => product.id === req.params.id);

  if (!productToDelete) {
    setFlash(req, "error", "Продукт не найден.");
    res.redirect("/admin");
    return;
  }

  removeProductImages(productToDelete);
  removeProductArchive(productToDelete);

  writeProducts(products.filter((product) => product.id !== req.params.id));
  setFlash(req, "success", "Продукт удалён.");
  res.redirect("/admin");
});

app.get("/files/:filename", requireSignedIn, (req, res) => {
  const fileName = path.basename(req.params.filename);
  const filePath = path.join(UPLOADS_FILES_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    res.status(404).send("Файл не найден.");
    return;
  }

  const product = readProducts().find(
    (item) => path.basename(item.archivePath || "") === fileName
  );

  res.download(filePath, product?.originalFileName || fileName);
});

app.get("/logout", requireSignedIn, (req, res) => {
  const role = req.session.userRole || (res.locals.currentUser?.isAdmin ? "admin" : "user");
  const accountId = req.session.userId || res.locals.currentUser?.id;

  if (accountId) {
    clearAccountSession(role, accountId);
  }

  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.use((error, req, res, next) => {
  if (!error) {
    next();
    return;
  }

  cleanupUploadedFiles(req);
  setFlash(req, "error", error.message || "Не удалось обработать загрузку.");
  res.redirect(req.path.startsWith("/admin") ? "/admin" : "/");
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
