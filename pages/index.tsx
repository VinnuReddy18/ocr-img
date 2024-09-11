import { useEffect, useRef, useState } from 'react';
import { Group, Stack, Text, Image, Progress, Button, SimpleGrid, Paper, CloseButton } from '@mantine/core';
import { Dropzone, IMAGE_MIME_TYPE, PDF_MIME_TYPE } from '@mantine/dropzone';
import { createWorker } from 'tesseract.js';
import dynamic from 'next/dynamic';

const PDFComponent = dynamic(() => import('../components/PDFComponent'), { ssr: false });

const Home = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [imageData, setImageData] = useState<{ id: string; data: string; file: File }[]>([]);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('idle');
  const [ocrResults, setOcrResults] = useState<{ id: string; text: string }[]>([]);

  const workerRef = useRef<Tesseract.Worker | null>(null);

  useEffect(() => {
    workerRef.current = createWorker({
      logger: message => {
        if ('progress' in message) {
          setProgress(message.progress);
          setProgressLabel(message.progress == 1 ? 'Done' : message.status);
        }
      }
    });
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    }
  }, []);

  const loadFiles = async (newFiles: File[]) => {
    setFiles(prevFiles => [...prevFiles, ...newFiles]);
    for (const file of newFiles) {
      const id = Math.random().toString(36).substr(2, 9);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImageData(prevData => [...prevData, { id, data: reader.result as string, file }]);
        };
        reader.readAsDataURL(file);
      } else if (file.type === 'application/pdf') {
        setImageData(prevData => [...prevData, { id, data: '', file }]);
      }
    }
  };

  const handleDelete = (id: string) => {
    setImageData(prevData => prevData.filter(item => item.id !== id));
    setFiles(prevFiles => prevFiles.filter(file => !imageData.find(item => item.id === id)?.file.name.includes(file.name)));
    setOcrResults(prevResults => prevResults.filter(result => result.id !== id));
  };

  const handleRemoveResult = (id: string) => {
    setOcrResults(prev => prev.filter(result => result.id !== id));
  };

  const handleExtract = async () => {
    setProgress(0);
    setProgressLabel('starting');
    setOcrResults([]);

    const worker = workerRef.current!;
    await worker.load();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    
    for (const item of imageData) {
      if (item.file.type.startsWith('image/')) {
        const response = await worker.recognize(item.data);
        setOcrResults(prev => [...prev, { id: item.id, text: response.data.text }]);
      }
    }
  };

  const handleDownload = () => {
    const text = ocrResults.map(result => result.text).join('\n\n--- Next File ---\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ocr_results.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Stack spacing="md" p="md">
      <Dropzone
        onDrop={loadFiles}
        accept={[...IMAGE_MIME_TYPE, ...PDF_MIME_TYPE]}
        multiple={true}
      >
        {() => (
          <Text size="xl" inline>
            Drag images or click to select files
          </Text>
        )}
      </Dropzone>

      <SimpleGrid cols={3} spacing="sm" breakpoints={[{ maxWidth: 'sm', cols: 1 }]}>
        {imageData.map(({ id, data, file }) => (
          <Paper key={id} shadow="sm" p="xs" style={{ position: 'relative' }}>
            <CloseButton
              style={{ position: 'absolute', top: 5, right: 5, zIndex: 1 }}
              onClick={() => handleDelete(id)}
            />
            {file.type.startsWith('image/') ? (
              <Image src={data} fit="contain" height={200} />
            ) : (
              <PDFComponent 
                file={file} 
                onTextExtracted={(text) => {
                  setOcrResults(prev => [...prev, { id, text }]);
                }} 
              />
            )}
          </Paper>
        ))}
      </SimpleGrid>

      <Group position="apart">
        <Button disabled={imageData.length === 0 || !workerRef.current} onClick={handleExtract}>
          Extract Text
        </Button>
        <Button disabled={ocrResults.length === 0} onClick={handleDownload} color="green">
          Download Results
        </Button>
      </Group>

      <Text>{progressLabel.toUpperCase()}</Text>
      <Progress value={progress * 100} />

      {ocrResults.length > 0 && (
        <Stack>
          <Text size="xl">RESULTS</Text>
          {ocrResults.map((result) => (
            <Paper key={result.id} shadow="sm" p="md" style={{ position: 'relative', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
              <CloseButton
                style={{ position: 'absolute', top: 5, right: 5, zIndex: 1 }}
                onClick={() => handleRemoveResult(result.id)}
              />
              {result.text}
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

export default Home;