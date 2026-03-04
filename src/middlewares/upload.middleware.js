import multer from "multer";

// use memory storage so we can access file.buffer
const storage = multer.memoryStorage();

export const upload = multer({ storage });
