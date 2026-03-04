import express from "express";
import cors from "cors";
import morgan from "morgan";

import authRoute from "./routes/auth.routes.js";
import productRoute from "./routes/product.routes.js";
import categoryRoute from "./routes/category.routes.js";

const app = express();

/**
 * MIDDLEWARES
 */

// parse application/json
app.use(express.json());
// parse application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

app.use(cors());

app.use(morgan("dev"));

/**
 * ===============================
 * ROUTES
 * ===============================
 */

app.use("/api/auth", authRoute);
app.use("/api/products", productRoute);
app.use("/api/categories", categoryRoute);

/**
 * ===============================
 * 404 HANDLER
 * ===============================
 */

app.use((req, res) => {
  res.status(404).json({
    message: "API không tồn tại",
  });
});

/**
 * ===============================
 * GLOBAL ERROR HANDLER
 * ===============================
 */

app.use((err, req, res, next) => {
  console.error("🔥 ERROR:", err);

  res.status(err.status || 500).json({
    message: err.message || "Lỗi hệ thống",
  });
});

export default app;
