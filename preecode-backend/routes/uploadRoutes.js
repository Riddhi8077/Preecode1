const express = require('express');
const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// Upload profile picture
router.post('/avatar', auth, upload.single('avatar'), async (req, res) => {
  try {
    console.log('[upload] Avatar upload request from user:', req.user?._id);

    if (!req.file) {
      console.log('[upload] No file in request');
      return res.status(400).json({ message: 'No file uploaded' });
    }

    console.log('[upload] File received:', req.file.originalname, 'size:', req.file.size, 'type:', req.file.mimetype);

    // Check if Cloudinary is configured
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
      console.error('[upload] Cloudinary not configured');
      return res.status(500).json({ message: 'Image upload service not configured' });
    }

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'preecode/avatars',
          transformation: [
            { width: 200, height: 200, crop: 'fill', gravity: 'face' },
            { quality: 'auto', fetch_format: 'auto' },
          ],
        },
        (error, result) => {
          if (error) {
            console.error('[upload] Cloudinary upload error:', error);
            reject(error);
          } else {
            console.log('[upload] Cloudinary upload success, public_id:', result.public_id);
            resolve(result);
          }
        }
      );
      uploadStream.end(req.file.buffer);
    });

    console.log('[upload] Avatar uploaded successfully:', result.secure_url);

    res.json({
      url: result.secure_url,
      public_id: result.public_id,
    });
  } catch (error) {
    console.error('[upload] Avatar upload failed:', error.message || error);
    res.status(500).json({ message: error.message || 'Failed to upload image' });
  }
});

module.exports = router;
