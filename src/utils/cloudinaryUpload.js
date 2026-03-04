import cloudinary from "../config/cloudinary.js";

const toDataUri = (file) => {
  if (!file) return null;
  if (file.path && typeof file.path === "string") return file.path;
  if (file.buffer) {
    const base64 = file.buffer.toString("base64");
    const mime = file.mimetype || "application/octet-stream";
    return `data:${mime};base64,${base64}`;
  }
  if (typeof file === "string") return file;
  return null;
};

export const uploadImages = async (req, res) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    const images = files.map((f) => toDataUri(f)).filter(Boolean);

    let uploadedImages = [];

    for (let image of images) {
      const result = await cloudinary.uploader.upload(image);
      uploadedImages.push({
        url: result.secure_url,
        public_id: result.public_id,
      });
    }

    return res.status(200).json(uploadedImages);
  } catch (error) {
    return res.status(400).json({
      name: error.name,
      message: error.message,
    });
  }
};

export const removeImages = async (req, res) => {
  try {
    const publicId = req.params.publicId;
    const result = await cloudinary.uploader.destroy(publicId);

    if (result.result === "not found") {
      throw new Error("publicId not found");
    }

    return res.status(200).json({
      message: "Delete images successfully",
    });
  } catch (error) {
    return res.status(400).json({
      name: error.name,
      message: error.message,
    });
  }
};
