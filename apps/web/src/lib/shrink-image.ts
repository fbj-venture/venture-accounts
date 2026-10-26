// Phone cameras make photos of several megabytes - far more than a receipt
// needs, and slow over mobile data. A photo over SHRINK_ABOVE_BYTES is redrawn
// no larger than MAX_SIDE pixels on its long side and re-saved as a JPEG.
// Smaller photos, and anything the browser can't read (e.g. HEIC outside
// Safari), are returned as they are - the server still checks the result.
const SHRINK_ABOVE_BYTES = 1024 * 1024
const MAX_SIDE = 2000
const JPEG_QUALITY = 0.85

export async function shrinkImage(file: File): Promise<File> {
  if (file.size <= SHRINK_ABOVE_BYTES || !file.type.startsWith("image/")) {
    return file
  }
  try {
    // "from-image" applies the camera's rotation, so the redrawn photo is upright.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    )
    // Keep the original if redrawing somehow made it bigger.
    if (!blob || blob.size >= file.size) {
      return file
    }
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" })
  } catch {
    return file
  }
}
