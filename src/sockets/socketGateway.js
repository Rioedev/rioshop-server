let ioInstance = null;

export const setSocketServer = (io) => {
  ioInstance = io || null;
};

export const getSocketServer = () => ioInstance;

export const emitNotificationToUser = (userId, payload) => {
  if (!ioInstance || !userId) {
    return;
  }

  ioInstance.to(`user:${userId}`).emit("notification", payload);
};
