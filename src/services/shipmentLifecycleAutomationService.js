import shipmentService from "./shipmentService.js";

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

const AUTO_GHN_SYNC_JOB_ENABLED = toBoolean(process.env.AUTO_GHN_SYNC_JOB_ENABLED, false);
const AUTO_GHN_SYNC_INTERVAL_MS = toPositiveNumber(
  process.env.AUTO_GHN_SYNC_INTERVAL_MS,
  60 * 1000,
);
const AUTO_GHN_SYNC_BATCH_LIMIT = toPositiveNumber(
  process.env.AUTO_GHN_SYNC_BATCH_LIMIT,
  20,
);

export class ShipmentLifecycleAutomationService {
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
      const synced = await shipmentService.syncActiveGhnShipments({
        limit: AUTO_GHN_SYNC_BATCH_LIMIT,
      });

      const result = {
        trigger,
        synced,
        finishedAt: new Date().toISOString(),
      };
      console.log("[shipment-auto-sync] run completed", result);
      return result;
    } catch (error) {
      console.error("[shipment-auto-sync] run failed", error?.message || error);
      return {
        trigger,
        error: error?.message || "Unknown sync error",
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

    if (!AUTO_GHN_SYNC_JOB_ENABLED) {
      console.log("[shipment-auto-sync] scheduler disabled by AUTO_GHN_SYNC_JOB_ENABLED");
      return;
    }

    this.timer = setInterval(() => {
      void this.runOnce("interval");
    }, AUTO_GHN_SYNC_INTERVAL_MS);

    if (typeof this.timer?.unref === "function") {
      this.timer.unref();
    }

    console.log(
      `[shipment-auto-sync] scheduler started (interval_ms=${AUTO_GHN_SYNC_INTERVAL_MS}, batch_limit=${AUTO_GHN_SYNC_BATCH_LIMIT})`,
    );

    void this.runOnce("startup");
  }

  stop() {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
    console.log("[shipment-auto-sync] scheduler stopped");
  }
}

export default new ShipmentLifecycleAutomationService();
