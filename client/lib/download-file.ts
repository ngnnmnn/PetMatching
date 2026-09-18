const EXCEL_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function downloadExcelFile(data: BlobPart, filename: string) {
  const blob =
    data instanceof Blob ? data : new Blob([data], { type: EXCEL_MIME_TYPE });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
