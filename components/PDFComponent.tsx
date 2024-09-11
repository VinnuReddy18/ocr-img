import { useEffect, useState } from 'react';
import { Modal, Button, Group } from '@mantine/core';
import axios from 'axios';

interface PDFComponentProps {
  file: File;
  onTextExtracted: (text: string) => void;
}

const PDFComponent: React.FC<PDFComponentProps> = ({ file, onTextExtracted }) => {
  const [error, setError] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const extractText = async () => {
      try {
        const response = await fetch('/api/parse-pdf', {
          method: 'POST',
          body: file,
        });

        if (response.ok) {
          const { text } = await response.json();
          setExtractedText(text);
          onTextExtracted(text);
        } else {
          const errorData = await response.json();
          throw new Error(errorData.details || 'Failed to parse PDF');
        }
      } catch (error) {
        console.error('Error parsing PDF:', error);
        setError(error instanceof Error ? error.message : String(error));
      }
    };
    extractText();
  }, [file, onTextExtracted]);

  const handleDownload = async (format: 'txt' | 'docx') => {
    try {
      const response = await axios.get(`/api/download-${format}`, {
        params: { text: extractedText },
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: response.headers['content-type'] });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `extracted_text.${format}`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(`Error downloading ${format} file:`, error);
    }
    setIsModalOpen(false);
  };

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <>
      {extractedText && (
        <Button onClick={() => setIsModalOpen(true)}>Download Extracted Text</Button>
      )}
      <Modal
        opened={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Choose Download Format"
      >
        <Group position="center">
          <Button onClick={() => handleDownload('txt')}>Download as TXT</Button>
          <Button onClick={() => handleDownload('docx')}>Download as DOCX</Button>
        </Group>
      </Modal>
    </>
  );
};

export default PDFComponent;