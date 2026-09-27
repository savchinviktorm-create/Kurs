import fs from 'fs';
import path from 'path';
const src = path.resolve('node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
const dest = path.resolve('public/pdf.worker.min.mjs');
if (fs.existsSync(src)) {
  fs.copyFileSync(src, dest);
  console.log('PDF.js worker copied to public/pdf.worker.min.mjs');
} else {
  console.warn('PDF.js worker not found; PDF viewer will be unavailable until dependencies are installed.');
}
