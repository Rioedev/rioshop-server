import dotenv from "dotenv";
import http from "http";
import app from "./app.js";
import connectDB from "./config/database.js";
import { initSocket } from "./config/socket.js";

dotenv.config();
connectDB();

const server = http.createServer(app);

initSocket(server);

server.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});