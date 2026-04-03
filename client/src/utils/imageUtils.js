/**
 * Compress an image file to reduce size for upload.
 * Scales down images larger than maxDimension and reduces JPEG quality iteratively.
 * 
 * @param {File} file - The image file to compress
 * @param {number} maxSizeMB - Maximum file size in MB (default: 2)
 * @param {number} maxDimension - Maximum width/height in pixels (default: 1920)
 * @returns {Promise<File>} Compressed file (or original if already small enough)
 */
export const compressImage = (file, maxSizeMB = 2, maxDimension = 1920) => {
  return new Promise((resolve) => {
    // If not an image or already small enough, return as-is
    if (!file.type.startsWith('image/') || file.size <= maxSizeMB * 1024 * 1024) {
      resolve(file)
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img

        // Scale down if image is very large
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension
            width = maxDimension
          } else {
            width = (width / height) * maxDimension
            height = maxDimension
          }
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        // Start with quality 0.85 and reduce if needed
        let quality = 0.85
        const tryCompress = () => {
          canvas.toBlob((blob) => {
            if (blob.size > maxSizeMB * 1024 * 1024 && quality > 0.3) {
              quality -= 0.1
              tryCompress()
            } else {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: file.lastModified
              })
              resolve(compressedFile)
            }
          }, 'image/jpeg', quality)
        }
        tryCompress()
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}
