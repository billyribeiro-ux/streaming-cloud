/**
 * CreateRoomPage - Room creation form
 *
 * Features:
 * - Name, description, scheduled start/end fields
 * - Settings toggles (max participants, chat, screen share, mute, waiting room)
 * - react-hook-form + zod validation
 * - Creates room via API and redirects to room detail
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  AlertCircle,
  Users,
  MessageSquare,
  Monitor,
  MicOff,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../../lib/api';
import { cn } from '../../utils/cn';

const createRoomSchema = z.object({
  name: z
    .string()
    .min(3, 'Room name must be at least 3 characters')
    .max(100, 'Room name must be less than 100 characters'),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  scheduledStartTime: z.string().optional(),
  scheduledEndTime: z.string().optional(),
  maxParticipants: z
    .number()
    .min(2, 'Minimum 2 participants')
    .max(1000, 'Maximum 1000 participants'),
  allowChat: z.boolean(),
  allowScreenShare: z.boolean(),
  muteOnEntry: z.boolean(),
  waitingRoom: z.boolean(),
});

type CreateRoomFormData = z.infer<typeof createRoomSchema>;

function ToggleSwitch({
  label,
  description,
  icon: Icon,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  icon: React.ElementType;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon className="w-4 h-4 text-gray-300" />
        </div>
        <div>
          <p className="text-sm font-medium text-white">{label}</p>
          <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900',
          checked ? 'bg-blue-600' : 'bg-gray-600'
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out',
            checked ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  );
}

function CreateRoomPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateRoomFormData>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: {
      name: '',
      description: '',
      scheduledStartTime: '',
      scheduledEndTime: '',
      maxParticipants: 100,
      allowChat: true,
      allowScreenShare: true,
      muteOnEntry: true,
      waitingRoom: false,
    },
  });

  const allowChat = watch('allowChat');
  const allowScreenShare = watch('allowScreenShare');
  const muteOnEntry = watch('muteOnEntry');
  const waitingRoom = watch('waitingRoom');

  const onSubmit = async (data: CreateRoomFormData) => {
    try {
      setServerError(null);

      const payload = {
        ...data,
        scheduledStartTime: data.scheduledStartTime || undefined,
        scheduledEndTime: data.scheduledEndTime || undefined,
      };

      const room = await api.post<{ id: string }>('/v1/rooms', payload);
      navigate(`/rooms/${room.id}`);
    } catch (err: any) {
      setServerError(err?.message || 'Failed to create room. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gray-900/80 backdrop-blur border-b border-gray-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              to="/rooms"
              className="text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-semibold text-white">Create Room</h1>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        {/* Server Error */}
        {serverError && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-400 text-sm">{serverError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-4">
              Room Details
            </h2>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-300 mb-1.5"
                >
                  Room Name *
                </label>
                <input
                  id="name"
                  type="text"
                  {...register('name')}
                  className="w-full px-3 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  placeholder="e.g., Morning Market Analysis"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-400">
                    {errors.name.message}
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-gray-300 mb-1.5"
                >
                  Description
                </label>
                <textarea
                  id="description"
                  rows={3}
                  {...register('description')}
                  className="w-full px-3 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-none"
                  placeholder="Describe what this room is about..."
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-400">
                    {errors.description.message}
                  </p>
                )}
              </div>

              {/* Schedule */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="scheduledStartTime"
                    className="block text-sm font-medium text-gray-300 mb-1.5"
                  >
                    Start Time
                  </label>
                  <input
                    id="scheduledStartTime"
                    type="datetime-local"
                    {...register('scheduledStartTime')}
                    className="w-full px-3 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="scheduledEndTime"
                    className="block text-sm font-medium text-gray-300 mb-1.5"
                  >
                    End Time
                  </label>
                  <input
                    id="scheduledEndTime"
                    type="datetime-local"
                    {...register('scheduledEndTime')}
                    className="w-full px-3 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors [color-scheme:dark]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-4">
              Room Settings
            </h2>

            <div className="space-y-1">
              {/* Max Participants */}
              <div className="flex items-start justify-between gap-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Users className="w-4 h-4 text-gray-300" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      Max Participants
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Maximum number of people who can join
                    </p>
                  </div>
                </div>
                <input
                  type="number"
                  {...register('maxParticipants', { valueAsNumber: true })}
                  className="w-24 px-3 py-1.5 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              {errors.maxParticipants && (
                <p className="text-sm text-red-400 pl-11">
                  {errors.maxParticipants.message}
                </p>
              )}

              <div className="border-t border-gray-700" />

              <ToggleSwitch
                label="Allow Chat"
                description="Participants can send text messages"
                icon={MessageSquare}
                checked={allowChat}
                onChange={(val) => setValue('allowChat', val)}
              />

              <div className="border-t border-gray-700" />

              <ToggleSwitch
                label="Allow Screen Share"
                description="Participants can share their screen"
                icon={Monitor}
                checked={allowScreenShare}
                onChange={(val) => setValue('allowScreenShare', val)}
              />

              <div className="border-t border-gray-700" />

              <ToggleSwitch
                label="Mute on Entry"
                description="Automatically mute participants when they join"
                icon={MicOff}
                checked={muteOnEntry}
                onChange={(val) => setValue('muteOnEntry', val)}
              />

              <div className="border-t border-gray-700" />

              <ToggleSwitch
                label="Waiting Room"
                description="Participants must be approved before entering"
                icon={ShieldCheck}
                checked={waitingRoom}
                onChange={(val) => setValue('waitingRoom', val)}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <Link
              to="/rooms"
              className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Create Room
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateRoomPage;
