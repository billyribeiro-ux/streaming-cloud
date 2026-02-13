/**
 * FileUploader Component - File upload with drag and drop
 *
 * Features:
 * - Drag and drop zone with visual feedback
 * - File type validation
 * - File size validation
 * - Upload progress bar
 * - Uses lucide-react icons
 */

import { useState, useRef, useCallback, type DragEvent } from 'react';
import { Upload, File, X, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '../utils/cn';

interface FileUploaderProps {
  onUpload: (file: File) => Promise<void>;
  accept?: string;
  maxSize?: number; // in MB
  className?: string;
}

type UploadState = 'idle' | 'dragging' | 'uploading' | 'success' | 'error';

export default function FileUploader({
  onUpload,
  accept = '*',
  maxSize = 10,
  className,
}: FileUploaderProps) {
  const [state, setState] = useState<UploadState>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const maxSizeBytes = maxSize * 1024 * 1024;

  const validateFile = useCallback(
    (file: File): string | null => {
      // Check file size
      if (file.size > maxSizeBytes) {
        return `File size exceeds ${maxSize}MB limit`;
      }

      // Check file type
      if (accept && accept !== '*') {
        const acceptedTypes = accept.split(',').map((t) => t.trim());
        const fileType = file.type;
        const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;

        const isAccepted = acceptedTypes.some((type) => {
          if (type.startsWith('.')) {
            return fileExtension === type.toLowerCase();
          }
          if (type.endsWith('/*')) {
            return fileType.startsWith(type.replace('/*', '/'));
          }
          return fileType === type;
        });

        if (!isAccepted) {
          return `File type not accepted. Allowed: ${accept}`;
        }
      }

      return null;
    },
    [accept, maxSize, maxSizeBytes]
  );

  const handleFile = useCallback(
    async (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setErrorMessage(validationError);
        setState('error');
        return;
      }

      setSelectedFile(file);
      setErrorMessage(null);
      setState('uploading');
      setProgress(0);

      // Simulate progress since onUpload is a Promise
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 15;
        });
      }, 200);

      try {
        await onUpload(file);
        clearInterval(progressInterval);
        setProgress(100);
        setState('success');

        // Reset after success
        setTimeout(() => {
          setState('idle');
          setSelectedFile(null);
          setProgress(0);
        }, 2000);
      } catch (err) {
        clearInterval(progressInterval);
        setProgress(0);
        setState('error');
        setErrorMessage(
          err instanceof Error ? err.message : 'Upload failed. Please try again.'
        );
      }
    },
    [onUpload, validateFile]
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setState('dragging');
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setState('idle');
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFile(files[0]);
      } else {
        setState('idle');
      }
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  const handleClear = useCallback(() => {
    setState('idle');
    setSelectedFile(null);
    setProgress(0);
    setErrorMessage(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, []);

  return (
    <div className={cn('w-full', className)}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => state === 'idle' && inputRef.current?.click()}
        className={cn(
          'relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer',
          state === 'idle' &&
            'border-gray-700 hover:border-gray-500 bg-gray-900/50',
          state === 'dragging' &&
            'border-blue-500 bg-blue-500/5 scale-[1.02]',
          state === 'uploading' && 'border-blue-500/50 bg-gray-900/50 cursor-default',
          state === 'success' && 'border-green-500/50 bg-green-500/5 cursor-default',
          state === 'error' && 'border-red-500/50 bg-red-500/5'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          className="hidden"
        />

        {/* Idle / Dragging State */}
        {(state === 'idle' || state === 'dragging') && (
          <div className="space-y-3">
            <div className="flex justify-center">
              <div
                className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center',
                  state === 'dragging' ? 'bg-blue-500/10' : 'bg-gray-800'
                )}
              >
                <Upload
                  className={cn(
                    'w-6 h-6',
                    state === 'dragging' ? 'text-blue-500' : 'text-gray-400'
                  )}
                />
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-300">
                {state === 'dragging' ? (
                  'Drop file here'
                ) : (
                  <>
                    <span className="text-blue-500 font-medium">Click to upload</span>{' '}
                    or drag and drop
                  </>
                )}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {accept !== '*' ? `Accepted: ${accept}` : 'Any file type'} (max{' '}
                {maxSize}MB)
              </p>
            </div>
          </div>
        )}

        {/* Uploading State */}
        {state === 'uploading' && selectedFile && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <File className="w-8 h-8 text-blue-500 flex-shrink-0" />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm text-white truncate">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-800 rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full bg-blue-500 transition-all duration-300"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400">
              Uploading... {Math.round(progress)}%
            </p>
          </div>
        )}

        {/* Success State */}
        {state === 'success' && selectedFile && (
          <div className="space-y-2">
            <CheckCircle className="w-8 h-8 text-green-500 mx-auto" />
            <p className="text-sm text-green-400">Upload complete!</p>
            <p className="text-xs text-gray-500 truncate">{selectedFile.name}</p>
          </div>
        )}

        {/* Error State */}
        {state === 'error' && (
          <div className="space-y-3">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
            <p className="text-sm text-red-400">
              {errorMessage || 'Upload failed'}
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="text-xs text-gray-400 hover:text-white underline"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
