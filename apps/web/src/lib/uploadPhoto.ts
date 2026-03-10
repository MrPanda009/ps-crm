import { supabase } from '@/src/lib/supabase'

const BUCKET = 'complaint-photos'
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
const MAX_PHOTOS = 5

export async function uploadComplaintPhoto(
  file: File,
  complaintId: string
): Promise<string | null> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    console.error('Invalid file type:', file.type)
    return null
  }

  if (file.size > MAX_FILE_SIZE) {
    console.error('File too large:', file.size)
    return null
  }

  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const fileName = `${complaintId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    })

  if (error) {
    console.error('Upload failed:', error.message)
    return null
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(fileName)

  return urlData.publicUrl
}

export async function uploadMultiplePhotos(
  files: File[],
  complaintId: string
): Promise<string[]> {
  const filesToUpload = files.slice(0, MAX_PHOTOS)

  const results = await Promise.all(
    filesToUpload.map(file => uploadComplaintPhoto(file, complaintId))
  )

  return results.filter((url): url is string => url !== null)
}
