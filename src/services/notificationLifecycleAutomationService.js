import notificationService from "./notificationService.js";

const toPositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toBoolean = (value, fallback) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
};

const AUTO_NOTIFICATION_CLEANUP_ENABLED = toBoolean(
  process.env.AUTO_NOTIFICATION_CLEANUP_ENABLED,
  true,
);
const AUTO_NOTIFICATION_CLEANUP_INTERVAL_MS = toPositiveNumber(
  process.env.AUTO_NOTIFICATION_CLEANUP_INTERVAL_MS,
  60 * 60 * 1000,
);
const NOTIFICATION_UNREAD_RETENTION_DAYS = toPositiveNumber(
  process.env.NOTIFICATION_UNREAD_RETENTION_DAYS,
  15,
);

export class NotificationLifecycleAutomationService {
  constructor() {
    this.timer = null;
    this.isRunning = false;
  }

  async runOnce(trigger = "manual") {
    if (this.isRunning) {
      return { skipped: true, trigger, reason: "already_running" };
    }

    this.isRunning = true;
    try {
      const cleanup = await notificationService.cleanupExpiredNotifications({
        unreadRetentionDays: NOTIFICATION_UNREAD_RETENTION_DAYS,
      });

      const result = {
        trigger,
        ...cleanup,
      };
      console.log("[notification-auto-cleanup] run completed", result);
      return result;
    } catch (error) {
      console.error("[notification-auto-cleanup] run failed", error?.message || error);
      return {
        trigger,
        error: error?.message || "Unknown cleanup error",
        finishedAt: new Date().toISOString(),
      };
    } finally {
      this.isRunning = false;
    }
  }

  start() {
    if (this.timer) {
      return;
    }

    if (!AUTO_NOTIFICATION_CLEANUP_ENABLED) {
      console.log(
        "[notification-auto-cleanup] scheduler disabled by AUTO_NOTIFICATION_CLEANUP_ENABLED",
      );
      return;
    }

    this.timer = setInterval(() => {
      void this.runOnce("interval");
    }, AUTO_NOTIFICATION_CLEANUP_INTERVAL_MS);

    if (typeof this.timer?.unref === "function") {
      this.timer.unref();
    }

    console.log(
      `[notification-auto-cleanup] scheduler started (interval_ms=${AUTO_NOTIFICATION_CLEANUP_INTERVAL_MS}, unread_retention_days=${NOTIFICATION_UNREAD_RETENTION_DAYS})`,
    );

    void this.runOnce("startup");
  }

  stop() {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
    console.log("[notification-auto-cleanup] scheduler stopped");
  }
}

export default new NotificationLifecycleAutomationService();
