import cloudinary from "../config/cloudinary.js";
import fs from "fs";

export const uploadToCloudinary = async (filePath, folder) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
    });

    return {
      url: result.secure_url,
      public_id: result.public_id,
    };
  } finally {
    // Luôn xoá file local dù upload thành công hay lỗi
    if (filePath) {
      await fs.promises.unlink(filePath).catch(() => {});
    }
  }
};