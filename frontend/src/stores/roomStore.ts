/**
 * Room Store - Zustand state management for room state
 *
 * Manages:
 * - Participants list
 * - Room settings
 * - Chat messages
 * - Alerts
 */

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';

interface Participant {
  id: string;
  userId: string;
  displayName: string;
  role: 'host' | 'co_host' | 'moderator' | 'viewer';
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  isScreenSharing: boolean;
  connectionQuality: 'good' | 'medium' | 'poor' | 'unknown';
  joinedAt: Date;
  producers: ProducerInfo[];
}

interface ProducerInfo {
  id: string;
  kind: 'audio' | 'video';
  source: 'camera' | 'microphone' | 'screen';
}

interface ChatMessage {
  id: string;
  userId: string;
  displayName: string;
  content: string;
  type: 'text' | 'system' | 'alert';
  createdAt: Date;
}

interface Alert {
  id: string;
  type: 'info' | 'warning' | 'trade' | 'announcement';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: Date;
}

interface RoomSettings {
  maxParticipants: number;
  allowChat: boolean;
  allowReactions: boolean;
  allowScreenShare: boolean;
  muteOnEntry: boolean;
  waitingRoom: boolean;
}

interface RoomState {
  // Room info
  roomId: string | null;
  roomName: string;
  status: 'scheduled' | 'live' | 'ended';
  settings: RoomSettings;

  // Participants
  participants: Map<string, Participant>;
  spotlightedParticipantId: string | null;

  // Chat
  messages: ChatMessage[];
  unreadMessageCount: number;

  // Alerts
  alerts: Alert[];

  // UI State
  isChatOpen: boolean;
  isParticipantListOpen: boolean;
  layoutMode: 'grid' | 'spotlight' | 'sidebar';

  // Actions
  setRoom: (roomId: string, roomName: string, settings: RoomSettings) => void;
  setStatus: (status: 'scheduled' | 'live' | 'ended') => void;

  // Participant actions
  setParticipants: (participants: Participant[]) => void;
  addParticipant: (participant: Partial<Participant> & { id: string }) => void;
  updateParticipant: (id: string, updates: Partial<Participant>) => void;
  removeParticipant: (id: string) => void;
  setSpotlight: (participantId: string | null) => void;

  // Chat actions
  addMessage: (message: Omit<ChatMessage, 'id' | 'createdAt'>) => void;
  markMessagesAsRead: () => void;
  toggleChat: () => void;

  // Alert actions
  addAlert: (alert: Omit<Alert, 'id' | 'createdAt'>) => void;
  dismissAlert: (id: string) => void;

  // UI actions
  toggleParticipantList: () => void;
  setLayoutMode: (mode: 'grid' | 'spotlight' | 'sidebar') => void;

  // Reset
  reset: () => void;
}

const initialState = {
  roomId: null,
  roomName: '',
  status: 'scheduled' as const,
  settings: {
    maxParticipants: 100,
    allowChat: true,
    allowReactions: true,
    allowScreenShare: true,
    muteOnEntry: true,
    waitingRoom: false,
  },
  participants: new Map<string, Participant>(),
  spotlightedParticipantId: null,
  messages: [],
  unreadMessageCount: 0,
  alerts: [],
  isChatOpen: false,
  isParticipantListOpen: false,
  layoutMode: 'grid' as const,
};

export const useRoomStore = create<RoomState>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      ...initialState,

      setRoom: (roomId, roomName, settings) => {
        set({ roomId, roomName, settings });
      },

      setStatus: (status) => {
        set({ status });
      },

      setParticipants: (participants) => {
        const participantMap = new Map<string, Participant>();
        participants.forEach((p) => {
          participantMap.set(p.id, {
            ...p,
            joinedAt: new Date(p.joinedAt),
          });
        });
        set({ participants: participantMap });
      },

      addParticipant: (participant) => {
        set((state) => {
          const newParticipants = new Map(state.participants);
          newParticipants.set(participant.id, {
            id: participant.id,
            userId: participant.userId || '',
            displayName: participant.displayName || 'Unknown',
            role: participant.role || 'viewer',
            isVideoEnabled: participant.isVideoEnabled ?? false,
            isAudioEnabled: participant.isAudioEnabled ?? false,
            isScreenSharing: participant.isScreenSharing ?? false,
            connectionQuality: participant.connectionQuality || 'unknown',
            joinedAt: new Date(),
            producers: participant.producers || [],
          });

          // Add system message
          const messages = [
            ...state.messages,
            {
              id: `msg-${Date.now()}`,
              userId: 'system',
              displayName: 'System',
              content: `${participant.displayName || 'Someone'} joined the room`,
              type: 'system' as const,
              createdAt: new Date(),
            },
          ];

          return { participants: newParticipants, messages };
        });
      },

      updateParticipant: (id, updates) => {
        set((state) => {
          const newParticipants = new Map(state.participants);
          const participant = newParticipants.get(id);
          if (participant) {
            newParticipants.set(id, { ...participant, ...updates });
          }
          return { participants: newParticipants };
        });
      },

      removeParticipant: (id) => {
        set((state) => {
          const newParticipants = new Map(state.participants);
          const participant = newParticipants.get(id);
          newParticipants.delete(id);

          // Add system message
          const messages = participant
            ? [
                ...state.messages,
                {
                  id: `msg-${Date.now()}`,
                  userId: 'system',
                  displayName: 'System',
                  content: `${participant.displayName} left the room`,
                  type: 'system' as const,
                  createdAt: new Date(),
                },
              ]
            : state.messages;

          // Clear spotlight if this participant was spotlighted
          const spotlightedParticipantId =
            state.spotlightedParticipantId === id
              ? null
              : state.spotlightedParticipantId;

          return { participants: newParticipants, messages, spotlightedParticipantId };
        });
      },

      setSpotlight: (participantId) => {
        set({ spotlightedParticipantId: participantId });
      },

      addMessage: (message) => {
        set((state) => ({
          messages: [
            ...state.messages,
            {
              ...message,
              id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              createdAt: new Date(),
            },
          ],
          unreadMessageCount: state.isChatOpen
            ? state.unreadMessageCount
            : state.unreadMessageCount + 1,
        }));
      },

      markMessagesAsRead: () => {
        set({ unreadMessageCount: 0 });
      },

      toggleChat: () => {
        set((state) => ({
          isChatOpen: !state.isChatOpen,
          unreadMessageCount: !state.isChatOpen ? 0 : state.unreadMessageCount,
        }));
      },

      addAlert: (alert) => {
        set((state) => ({
          alerts: [
            ...state.alerts,
            {
              ...alert,
              id: `alert-${Date.now()}`,
              createdAt: new Date(),
            },
          ],
        }));
      },

      dismissAlert: (id) => {
        set((state) => ({
          alerts: state.alerts.filter((a) => a.id !== id),
        }));
      },

      toggleParticipantList: () => {
        set((state) => ({
          isParticipantListOpen: !state.isParticipantListOpen,
        }));
      },

      setLayoutMode: (mode) => {
        set({ layoutMode: mode });
      },

      reset: () => {
        set(initialState);
      },
    })),
    { name: 'room-store' }
  )
);

// Selectors
export const selectParticipantCount = (state: RoomState) =>
  state.participants.size;

export const selectHosts = (state: RoomState) =>
  Array.from(state.participants.values()).filter(
    (p) => p.role === 'host' || p.role === 'co_host'
  );

export const selectViewers = (state: RoomState) =>
  Array.from(state.participants.values()).filter((p) => p.role === 'viewer');

export const selectSpotlightedParticipant = (state: RoomState) =>
  state.spotlightedParticipantId
    ? state.participants.get(state.spotlightedParticipantId)
    : null;
