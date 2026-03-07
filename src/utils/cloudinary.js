import cloudinary from "../config/cloudinary.js";

export const uploadToCloudinary = async (file, folder = "rioshop") => {
  try {
    const result = await cloudinary.uploader.upload(file, {
      folder,
      resource_type: "auto",
    });
    return result;
  } catch (error) {
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  }
};

export const deleteFromCloudinary = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error(`Cloudinary delete failed: ${error.message}`);
  }
};

export const uploadMultipleToCloudinary = async (
  files,
  folder = "rioshop",
) => {
  try {
    const uploads = files.map((file) =>
      cloudinary.uploader.upload(file, { folder, resource_type: "auto" }),
    );
    return await Promise.all(uploads);
  } catch (error) {
    throw new Error(`Cloudinary batch upload failed: ${error.message}`);
  }
};
