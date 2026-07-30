import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { auth, db } from "@/lib/firebase";

export interface UploadResult {
  url: string;
  path: string;
}

function getStoragePath(folder: string, filename: string): string {
  const user = auth?.currentUser;
  const userId = user?.uid || "anonymous";
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-z0-9._-]/gi, "_");
  return `${folder}/${userId}/${timestamp}-${sanitizedFilename}`;
}

export async function uploadToFirebaseStorage(file: File, folder: string): Promise<UploadResult> {
  if (!db || !auth?.currentUser) {
    throw new Error("You must be signed in to upload files.");
  }

  const storage = getStorage();
  const filename = file.name || "upload";
  const path = getStoragePath(folder, filename);
  const storageRef = ref(storage, path);

  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
    });

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        console.log(`Upload is ${progress}% done`);
      },
      (error) => {
        console.error("Upload failed:", error);
        reject(new Error(`Upload failed: ${error.message}`));
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({
            url: downloadURL,
            path: path,
          });
        } catch (error) {
          reject(new Error(`Failed to get download URL: ${error instanceof Error ? error.message : "Unknown error"}`));
        }
      }
    );
  });
}

export async function deleteFromFirebaseStorage(path: string): Promise<void> {
  const storage = getStorage();
  const storageRef = ref(storage, path);
  
  try {
    await import("firebase/storage").then(({ deleteObject }) => deleteObject(storageRef));
  } catch (error) {
    console.error("Failed to delete file:", error);
    throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}