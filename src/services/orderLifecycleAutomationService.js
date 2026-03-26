import orderService from "./orderService.js";

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

const AUTO_ORDER_JOB_INTERVAL_MS = toPositiveNumber(
  process.env.AUTO_ORDER_JOB_INTERVAL_MS,
  5 * 60 * 1000,
);
const AUTO_ORDER_JOB_ENABLED = toBoolean(process.env.AUTO_ORDER_JOB_ENABLED, true);

export class OrderLifecycleAutomationService {
  constructor() {
    this.timer = null;
    this.isRunning = false;
  }

  async runOnce(trigger = "manual") {
    if (this.isRunning) {
      return { skipped: true, trigger, reason: "already_running" };
    }

    this.isRunning = true;
    const startedAt = new Date();
    const result = {
      trigger,
      startedAt: startedAt.toISOString(),
      finishedAt: "",
      cancelled: null,
      completed: null,
    };

    try {
      try {
        result.cancelled = await orderService.autoCancelExpiredPendingPaymentOrders();
      } catch (error) {
        result.cancelled = {
          error: error?.message || "Unknown error",
        };
        console.error("[order-auto] auto-cancel run failed", error?.message || error);
      }

      try {
        result.completed = await orderService.autoCompleteDeliveredOrders();
      } catch (error) {
        result.completed = {
          error: error?.message || "Unknown error",
        };
        console.error("[order-auto] auto-complete run failed", error?.message || error);
      }

      result.finishedAt = new Date().toISOString();

      console.log("[order-auto] run completed", result);
      return result;
    } finally {
      this.isRunning = false;
    }
  }

  start() {
    if (this.timer) {
      return;
    }

    if (!AUTO_ORDER_JOB_ENABLED) {
      console.log("[order-auto] scheduler disabled by AUTO_ORDER_JOB_ENABLED");
      return;
    }

    this.timer = setInterval(() => {
      void this.runOnce("interval").catch((error) => {
        console.error("[order-auto] interval run failed", error?.message || error);
      });
    }, AUTO_ORDER_JOB_INTERVAL_MS);

    if (typeof this.timer?.unref === "function") {
      this.timer.unref();
    }

    console.log(
      `[order-auto] scheduler started (interval_ms=${AUTO_ORDER_JOB_INTERVAL_MS})`,
    );

    void this.runOnce("startup").catch((error) => {
      console.error("[order-auto] startup run failed", error?.message || error);
    });
  }

  stop() {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
    console.log("[order-auto] scheduler stopped");
  }
}

export default new OrderLifecycleAutomationService();
