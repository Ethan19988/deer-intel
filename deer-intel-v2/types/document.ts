// A file the hunter attaches to a property — a lease, permit, license, tag,
// regulation PDF, a printed map, or any photo/document worth keeping alongside
// the property. The bytes live in IndexedDB (lib/fileStore), keyed by fileId;
// this record only keeps the metadata so it fits in the localStorage state.
export type DocumentRecord = {
  id: string;
  propertyId: string;
  // What the hunter calls it (defaults to the uploaded file's name).
  label: string;
  fileName: string;
  // MIME type from the browser ("application/pdf", "image/jpeg", ...), or ""
  // when the browser couldn't tell.
  fileType: string;
  // Size in bytes of the stored file, for display; 0 when unknown.
  fileSize: number;
  // Id of the blob in the IndexedDB file store; "" when storing the bytes
  // failed and the record is metadata-only.
  fileId: string;
  notes: string;
  createdAt: string;
};
