<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UploadFileRequest;
use App\Models\Room;
use App\Models\RoomFile;
use App\Services\FileUploadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

/**
 * File Controller - API endpoints for room file management
 *
 * @group Files
 *
 * Endpoints for uploading, listing, downloading, and deleting files within rooms.
 */
class FileController extends Controller
{
    public function __construct(
        private readonly FileUploadService $fileUploadService
    ) {}

    /**
     * Upload a file to a room.
     *
     * @bodyParam file file required The file to upload. Max: 50 MB.
     * @bodyParam type string The file category (document, image, video, audio).
     *
     * @response 201 scenario="Created" {
     *   "data": {
     *     "id": "uuid",
     *     "file_name": "presentation.pdf",
     *     "file_url": "https://...",
     *     "file_size": 1048576,
     *     "mime_type": "application/pdf"
     *   },
     *   "message": "File uploaded successfully"
     * }
     * @response 403 scenario="Unauthorized" {"message": "Unauthorized"}
     * @response 422 scenario="Validation Error" {"message": "...", "errors": {...}}
     */
    public function upload(UploadFileRequest $request, Room $room): JsonResponse
    {
        $user = $request->user();

        if (!$this->userCanAccessRoom($user, $room)) {
            return response()->json([
                'message' => 'Unauthorized',
            ], Response::HTTP_FORBIDDEN);
        }

        $validated = $request->validated();
        $file = $validated['file'];

        try {
            $uploadResult = $this->fileUploadService->upload(
                $file,
                "rooms/{$room->id}/files",
            );

            $roomFile = RoomFile::create([
                'room_id' => $room->id,
                'uploaded_by' => $user->id,
                'file_name' => $file->getClientOriginalName(),
                'file_url' => $uploadResult['url'],
                'file_size' => $uploadResult['size'],
                'mime_type' => $uploadResult['mime_type'],
            ]);

            $roomFile->load('uploader:id,name,email');

            return response()->json([
                'data' => [
                    'id' => $roomFile->id,
                    'room_id' => $roomFile->room_id,
                    'file_name' => $roomFile->file_name,
                    'file_url' => $roomFile->file_url,
                    'file_size' => $roomFile->file_size,
                    'mime_type' => $roomFile->mime_type,
                    'uploaded_by' => $roomFile->uploader,
                    'created_at' => $roomFile->created_at->toIso8601String(),
                ],
                'message' => 'File uploaded successfully',
            ], Response::HTTP_CREATED);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        } catch (\RuntimeException $e) {
            Log::error('File upload failed', [
                'room_id' => $room->id,
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'File upload failed. Please try again.',
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * List files in a room.
     *
     * @response 200 scenario="Success" {
     *   "data": [
     *     {
     *       "id": "uuid",
     *       "file_name": "presentation.pdf",
     *       "file_size": 1048576,
     *       "mime_type": "application/pdf"
     *     }
     *   ]
     * }
     */
    public function index(Request $request, Room $room): JsonResponse
    {
        $user = $request->user();

        if (!$this->userCanAccessRoom($user, $room)) {
            return response()->json([
                'message' => 'Unauthorized',
            ], Response::HTTP_FORBIDDEN);
        }

        $files = $room->files()
            ->where('is_deleted', false)
            ->with('uploader:id,name,email')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(fn (RoomFile $file) => [
                'id' => $file->id,
                'room_id' => $file->room_id,
                'file_name' => $file->file_name,
                'file_url' => $file->file_url,
                'file_size' => $file->file_size,
                'mime_type' => $file->mime_type,
                'uploaded_by' => $file->uploader,
                'created_at' => $file->created_at->toIso8601String(),
            ]);

        return response()->json([
            'data' => $files,
        ]);
    }

    /**
     * Delete a file.
     *
     * Soft-deletes the file record and removes it from storage.
     *
     * @response 200 scenario="Deleted" {"message": "File deleted successfully"}
     * @response 403 scenario="Unauthorized" {"message": "Unauthorized"}
     */
    public function destroy(Request $request, RoomFile $file): JsonResponse
    {
        $user = $request->user();

        // Allow deletion by the uploader or a room host/moderator
        if ($file->uploaded_by !== $user->id) {
            $room = $file->room;
            $participant = $room->activeParticipants()
                ->where('user_id', $user->id)
                ->first();

            if (!$participant || !in_array($participant->role, ['host', 'co_host', 'moderator'])) {
                return response()->json([
                    'message' => 'Unauthorized',
                ], Response::HTTP_FORBIDDEN);
            }
        }

        // Soft-delete the file record
        $file->update(['is_deleted' => true]);

        // Attempt to remove from storage (non-blocking)
        try {
            $this->fileUploadService->delete($file->file_url);
        } catch (\Throwable $e) {
            Log::warning('Failed to delete file from storage', [
                'file_id' => $file->id,
                'error' => $e->getMessage(),
            ]);
        }

        return response()->json([
            'message' => 'File deleted successfully',
        ]);
    }

    /**
     * Get a download URL for a file.
     *
     * @response 200 scenario="Success" {
     *   "data": {
     *     "id": "uuid",
     *     "file_name": "presentation.pdf",
     *     "download_url": "https://..."
     *   }
     * }
     */
    public function download(Request $request, RoomFile $file): JsonResponse
    {
        $user = $request->user();
        $room = $file->room;

        if (!$this->userCanAccessRoom($user, $room)) {
            return response()->json([
                'message' => 'Unauthorized',
            ], Response::HTTP_FORBIDDEN);
        }

        if ($file->is_deleted) {
            return response()->json([
                'message' => 'File not found',
            ], Response::HTTP_NOT_FOUND);
        }

        return response()->json([
            'data' => [
                'id' => $file->id,
                'file_name' => $file->file_name,
                'file_size' => $file->file_size,
                'mime_type' => $file->mime_type,
                'download_url' => $file->file_url,
            ],
        ]);
    }

    /**
     * Check if a user can access the room.
     */
    private function userCanAccessRoom($user, Room $room): bool
    {
        return $room->organization->members()
            ->where('user_id', $user->id)
            ->exists();
    }
}
