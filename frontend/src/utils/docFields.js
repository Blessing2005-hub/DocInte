// Fields shared by library/my-documents rows (DocumentOut) and inbox/sent
// rows (SharedDocumentOut): what the viewer may do with the document.
export function editFields(d) {
  return {
    fileType: d.file_type || '',
    department: d.department || '',
    version: d.version || 1,
    updatedBy: d.updated_by_name || null,
    canEdit: !!d.can_edit,
    canRestore: !!d.can_restore,
  };
}
