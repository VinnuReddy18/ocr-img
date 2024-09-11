import type { NextApiRequest, NextApiResponse } from 'next';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import path from 'path';

// Set up the workers
const workerSrc = path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.js');
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const buffer = await req.body;
      if (!buffer) {
        throw new Error('No PDF data received');
      }
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map((item: any) => item.str);
        fullText += strings.join(' ') + '\n';
      }

      res.status(200).json({ text: fullText });
    } catch (error) {
        console.error('Failed to parse PDF:', error);
        res.status(500).json({ 
          error: 'Failed to parse PDF', 
          details: error instanceof Error ? error.message : String(error) 
        });
      }
    } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}