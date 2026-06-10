import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { httpsCallable } from 'firebase/functions'
import { db, storage, functions } from '@/firebase/config'
import type { GalleryItem, GalleryCategory } from '@/types'

const GALLERY_COL = 'gallery'
const MAX_PX = 1200
const JPEG_QUALITY = 0.82

export async function getGalleryItems(): Promise<GalleryItem[]> {
  const snap = await getDocs(query(collection(db, GALLERY_COL), orderBy('order', 'asc')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as GalleryItem))
}

export async function addGalleryItem(
  file: File,
  label: string,
  category: GalleryCategory,
  currentCount: number
): Promise<GalleryItem> {
  const compressed = await compressImage(file)
  const filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
  const storagePath = `gallery/${filename}`
  const storageRef = ref(storage, storagePath)
  await uploadBytes(storageRef, compressed, { contentType: 'image/jpeg' })
  const url = await getDownloadURL(storageRef)

  const docRef = await addDoc(collection(db, GALLERY_COL), {
    url,
    label,
    category,
    storagePath,
    order: currentCount,
    uploadedAt: serverTimestamp(),
  })

  return {
    id: docRef.id,
    url,
    label,
    category,
    storagePath,
    order: currentCount,
    uploadedAt: null as any,
  }
}

export function instagramShortcode(url: string): string | null {
  const m = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/)
  return m?.[1] ?? null
}

export async function addInstagramItem(
  instagramUrl: string,
  label: string,
  category: GalleryCategory,
  currentCount: number
): Promise<GalleryItem> {
  if (!instagramShortcode(instagramUrl)) throw new Error('קישור אינסטגרם לא תקין')

  // Cloud Function fetches the page server-side, downloads the image, and re-uploads to Storage
  const importFn = httpsCallable<
    { instagramUrl: string },
    { url: string; storagePath: string }
  >(functions, 'importInstagramPhoto')

  const result = await importFn({ instagramUrl })
  const { url, storagePath } = result.data

  const docRef = await addDoc(collection(db, GALLERY_COL), {
    url,
    instagramUrl,
    label,
    category,
    storagePath,
    order: currentCount,
    uploadedAt: serverTimestamp(),
  })

  return {
    id: docRef.id,
    url,
    instagramUrl,
    label,
    category,
    storagePath,
    order: currentCount,
    uploadedAt: null as any,
  }
}

export async function deleteGalleryItem(item: GalleryItem): Promise<void> {
  await deleteDoc(doc(db, GALLERY_COL, item.id))
  try {
    await deleteObject(ref(storage, item.storagePath))
  } catch {
    // storage object may already be gone
  }
}

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      let { width, height } = img
      if (width > MAX_PX || height > MAX_PX) {
        const ratio = Math.min(MAX_PX / width, MAX_PX / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('compression failed'))),
        'image/jpeg',
        JPEG_QUALITY
      )
    }
    img.onerror = reject
    img.src = objectUrl
  })
}
