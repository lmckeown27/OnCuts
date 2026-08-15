import QRCode from 'qrcode';

export async function downloadBookingLinkQr(url: string, filename: string): Promise<void> {
  const dataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: 'M',
    width: 1024,
    margin: 2,
    color: {
      dark: '#111827',
      light: '#FFFFFF',
    },
  });

  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
