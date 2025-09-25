const cloudinary = require('cloudinary').v2;

// Expect these env vars: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a file buffer to Cloudinary
 * Ensures PDFs and other documents are uploaded as raw assets so they are served with the correct MIME type.
 * @param {Buffer} buffer
 * @param {Object} options
 * @param {string} [options.folder]
 * @param {string} [options.originalFilename]
 * @returns {Promise<{ secure_url: string, public_id: string }>}
 */
function uploadBuffer(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: options.folder || 'brain-box',
      // Upload as raw so PDFs keep application/pdf and render inline in browser
      resource_type: 'raw',
      // Try to preserve the original filename and extension for correct content-type
      use_filename: true,
      unique_filename: true,
    };

    if (options.originalFilename) {
      uploadOptions.filename_override = options.originalFilename;
    }

    const stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

module.exports = { cloudinary, uploadBuffer };


