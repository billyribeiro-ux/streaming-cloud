<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * File Upload Service - Handles file uploads to Cloudflare R2 (S3-compatible)
 *
 * Responsibilities:
 * - Upload files to R2 storage via S3 disk
 * - Delete files from storage
 * - Generate public/signed URLs for file access
 * - Validate file size and MIME type before upload
 *
 * @package App\Services
 */
class FileUploadService
{
    /**
     * Maximum file size in bytes (50 MB).
     */
    private const MAX_FILE_SIZE = 50 * 1024 * 1024;

    /**
     * Allowed MIME types grouped by category.
     */
    private const ALLOWED_MIME_TYPES = [
        'document' => [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain',
            'text/csv',
        ],
        'image' => [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'image/svg+xml',
        ],
        'video' => [
            'video/mp4',
            'video/webm',
            'video/quicktime',
            'video/x-msvideo',
        ],
        'audio' => [
            'audio/mpeg',
            'audio/wav',
            'audio/ogg',
            'audio/webm',
            'audio/aac',
        ],
    ];

    private readonly string $disk;

    public function __construct()
    {
        $this->disk = 's3';
    }

    /**
     * Upload a file to R2/S3 storage.
     *
     * @param UploadedFile $file The file to upload
     * @param string $directory The target directory within the bucket
     * @param string|null $filename Optional custom filename (without extension)
     * @return array{path: string, url: string, size: int, mime_type: string}
     *
     * @throws \InvalidArgumentException If validation fails
     * @throws \RuntimeException If upload fails
     */
    public function upload(UploadedFile $file, string $directory, ?string $filename = null): array
    {
        $this->validateFile($file);

        $extension = $file->getClientOriginalExtension();
        $storedFilename = $filename
            ? $filename . '.' . $extension
            : Str::uuid()->toString() . '.' . $extension;

        $path = Storage::disk($this->disk)->putFileAs(
            $directory,
            $file,
            $storedFilename,
        );

        if ($path === false) {
            Log::error('File upload failed', [
                'directory' => $directory,
                'filename' => $storedFilename,
                'size' => $file->getSize(),
            ]);

            throw new \RuntimeException('Failed to upload file to storage.');
        }

        $url = $this->getUrl($path);

        Log::info('File uploaded successfully', [
            'path' => $path,
            'size' => $file->getSize(),
            'mime_type' => $file->getMimeType(),
        ]);

        return [
            'path' => $path,
            'url' => $url,
            'size' => (int) $file->getSize(),
            'mime_type' => $file->getMimeType() ?? 'application/octet-stream',
        ];
    }

    /**
     * Delete a file from R2/S3 storage.
     *
     * @param string $path The storage path of the file
     * @return bool True if deleted, false otherwise
     */
    public function delete(string $path): bool
    {
        if (!Storage::disk($this->disk)->exists($path)) {
            Log::warning('Attempted to delete non-existent file', ['path' => $path]);
            return false;
        }

        $deleted = Storage::disk($this->disk)->delete($path);

        if ($deleted) {
            Log::info('File deleted from storage', ['path' => $path]);
        } else {
            Log::error('Failed to delete file from storage', ['path' => $path]);
        }

        return $deleted;
    }

    /**
     * Get the public URL for a stored file.
     *
     * @param string $path The storage path of the file
     * @return string The public URL
     */
    public function getUrl(string $path): string
    {
        return Storage::disk($this->disk)->url($path);
    }

    /**
     * Validate file size and MIME type.
     *
     * @param UploadedFile $file The file to validate
     *
     * @throws \InvalidArgumentException If the file fails validation
     */
    private function validateFile(UploadedFile $file): void
    {
        if ($file->getSize() > self::MAX_FILE_SIZE) {
            throw new \InvalidArgumentException(
                sprintf('File size exceeds maximum allowed size of %d MB.', self::MAX_FILE_SIZE / (1024 * 1024))
            );
        }

        $mimeType = $file->getMimeType();
        $allAllowed = array_merge(...array_values(self::ALLOWED_MIME_TYPES));

        if (!in_array($mimeType, $allAllowed, true)) {
            throw new \InvalidArgumentException(
                sprintf('File type "%s" is not allowed.', $mimeType)
            );
        }
    }

    /**
     * Get allowed MIME types for a specific category.
     *
     * @param string|null $type The file category (document, image, video, audio)
     * @return array<string> List of allowed MIME types
     */
    public function getAllowedMimeTypes(?string $type = null): array
    {
        if ($type !== null && isset(self::ALLOWED_MIME_TYPES[$type])) {
            return self::ALLOWED_MIME_TYPES[$type];
        }

        return array_merge(...array_values(self::ALLOWED_MIME_TYPES));
    }
}
