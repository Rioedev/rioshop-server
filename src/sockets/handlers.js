import { setSocketServer } from "./socketGateway.js";

const initializeSocketHandlers = (io) => {
  io.on("connection", (socket) => {
    console.log(`✅ User connected: ${socket.id}`);

    // Order tracking
    socket.on("join-order", (orderId) => {
      socket.join(`order:${orderId}`);
      console.log(`User joined order room: order:${orderId}`);
    });

    socket.on("leave-order", (orderId) => {
      socket.leave(`order:${orderId}`);
    });

    // Notifications
    socket.on("join-user", (userId) => {
      socket.join(`user:${userId}`);
      console.log(`User joined notification room: user:${userId}`);
    });

    socket.on("leave-user", (userId) => {
      socket.leave(`user:${userId}`);
    });

    // Real-time inventory updates
    socket.on("watch-inventory", (productId) => {
      socket.join(`product:${productId}`);
    });

    socket.on("unwatch-inventory", (productId) => {
      socket.leave(`product:${productId}`);
    });

    // Flash sale notifications
    socket.on("join-flash-sale", (saleId) => {
      socket.join(`flash-sale:${saleId}`);
    });

    socket.on("leave-flash-sale", (saleId) => {
      socket.leave(`flash-sale:${saleId}`);
    });

    // Disconnect
    socket.on("disconnect", () => {
      console.log(`❌ User disconnected: ${socket.id}`);
    });

    socket.on("error", (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
    });
  });

  // Broadcast helpers
  io.emitOrderUpdate = (orderId, data) => {
    io.to(`order:${orderId}`).emit("order-updated", data);
  };

  io.emitNotification = (userId, data) => {
    io.to(`user:${userId}`).emit("notification", data);
  };

  io.emitInventoryUpdate = (productId, inventory) => {
    io.to(`product:${productId}`).emit("inventory-updated", inventory);
  };

  io.emitFlashSaleUpdate = (saleId, data) => {
    io.to(`flash-sale:${saleId}`).emit("flash-sale-updated", data);
  };

  setSocketServer(io);

  return io;
};

export default initializeSocketHandlers;
