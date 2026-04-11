/**
 * Room Store - Svelte 5 Runes state management
 *
 * Replaces the Zustand store with Svelte 5 $state runes.
 * Manages participants, chat, alerts, and UI state.
 */

export interface Participant {
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

export interface ProducerInfo {
  id: string;
  kind: 'audio' | 'video';
  source: 'camera' | 'microphone' | 'screen';
}

export interface ChatMessage {
  id: string;
  userId: string;
  displayName: string;
  content: string;
  type: 'text' | 'system' | 'alert';
  createdAt: Date;
}

export interface Alert {
  id: string;
  type: 'info' | 'warning' | 'trade' | 'announcement';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: Date;
}

export interface RoomSettings {
  maxParticipants: number;
  allowChat: boolean;
  allowReactions: boolean;
  allowScreenShare: boolean;
  muteOnEntry: boolean;
  waitingRoom: boolean;
}

export interface ConsumerEntry {
  consumerId: string;
  producerId: string;
  kind: 'audio' | 'video';
  track: MediaStreamTrack;
  participantId: string;
}

function createRoomStore() {
  // Room info
  let roomId = $state<string | null>(null);
  let roomName = $state('');
  let status = $state<'scheduled' | 'live' | 'ended'>('scheduled');
  let settings = $state<RoomSettings>({
    maxParticipants: 100,
    allowChat: true,
    allowReactions: true,
    allowScreenShare: true,
    muteOnEntry: true,
    waitingRoom: false,
  });

  // Participants
  let participants = $state<Map<string, Participant>>(new Map());
  let spotlightedParticipantId = $state<string | null>(null);

  // Local media state
  let isVideoEnabled = $state(false);
  let isAudioEnabled = $state(false);
  let isScreenSharing = $state(false);

  // Connection state
  let isConnected = $state(false);
  let isJoined = $state(false);
  let isReconnecting = $state(false);

  // Active speaker
  let activeSpeakerId = $state<string | null>(null);

  // Consumers
  let consumers = $state<Map<string, ConsumerEntry>>(new Map());

  // Local streams
  let localStream = $state<MediaStream | null>(null);
  let screenStream = $state<MediaStream | null>(null);

  // Chat
  let messages = $state<ChatMessage[]>([]);
  let unreadMessageCount = $state(0);

  // Alerts
  let alerts = $state<Alert[]>([]);

  // UI State
  let isChatOpen = $state(false);
  let isParticipantListOpen = $state(false);
  let layoutMode = $state<'grid' | 'spotlight' | 'sidebar'>('grid');

  // Error
  let error = $state<string | null>(null);

  // Derived
  let participantCount = $derived(participants.size);
  let participantList = $derived(Array.from(participants.values()));
  let hosts = $derived(
    participantList.filter((p) => p.role === 'host' || p.role === 'co_host'),
  );
  let viewers = $derived(participantList.filter((p) => p.role === 'viewer'));
  let spotlightedParticipant = $derived(
    spotlightedParticipantId
      ? participants.get(spotlightedParticipantId) ?? null
      : null,
  );
  let consumerList = $derived(Array.from(consumers.values()));

  return {
    // Getters (reactive via $state)
    get roomId() { return roomId; },
    get roomName() { return roomName; },
    get status() { return status; },
    get settings() { return settings; },
    get participants() { return participants; },
    get spotlightedParticipantId() { return spotlightedParticipantId; },
    get isVideoEnabled() { return isVideoEnabled; },
    get isAudioEnabled() { return isAudioEnabled; },
    get isScreenSharing() { return isScreenSharing; },
    get isConnected() { return isConnected; },
    get isJoined() { return isJoined; },
    get isReconnecting() { return isReconnecting; },
    get activeSpeakerId() { return activeSpeakerId; },
    get consumers() { return consumers; },
    get localStream() { return localStream; },
    get screenStream() { return screenStream; },
    get messages() { return messages; },
    get unreadMessageCount() { return unreadMessageCount; },
    get alerts() { return alerts; },
    get isChatOpen() { return isChatOpen; },
    get isParticipantListOpen() { return isParticipantListOpen; },
    get layoutMode() { return layoutMode; },
    get error() { return error; },

    // Derived
    get participantCount() { return participantCount; },
    get participantList() { return participantList; },
    get hosts() { return hosts; },
    get viewers() { return viewers; },
    get spotlightedParticipant() { return spotlightedParticipant; },
    get consumerList() { return consumerList; },

    // Setters
    setRoom(id: string, name: string, s: RoomSettings) {
      roomId = id;
      roomName = name;
      settings = s;
    },

    setStatus(s: 'scheduled' | 'live' | 'ended') {
      status = s;
    },

    setConnected(connected: boolean) {
      isConnected = connected;
    },

    setJoined(joined: boolean) {
      isJoined = joined;
    },

    setReconnecting(reconnecting: boolean) {
      isReconnecting = reconnecting;
    },

    setError(err: string | null) {
      error = err;
    },

    clearError() {
      error = null;
    },

    // Media state
    setVideoEnabled(enabled: boolean) {
      isVideoEnabled = enabled;
    },

    setAudioEnabled(enabled: boolean) {
      isAudioEnabled = enabled;
    },

    setScreenSharing(sharing: boolean) {
      isScreenSharing = sharing;
    },

    setLocalStream(stream: MediaStream | null) {
      localStream = stream;
    },

    setScreenStream(stream: MediaStream | null) {
      screenStream = stream;
    },

    setActiveSpeaker(id: string | null) {
      activeSpeakerId = id;
    },

    // Participant actions
    setParticipants(list: Participant[]) {
      const map = new Map<string, Participant>();
      for (const p of list) {
        map.set(p.id, {
          ...p,
          joinedAt: new Date(p.joinedAt),
        });
      }
      participants = map;
    },

    addParticipant(data: Partial<Participant> & { id: string }) {
      const p: Participant = {
        id: data.id,
        userId: data.userId || '',
        displayName: data.displayName || 'Unknown',
        role: data.role || 'viewer',
        isVideoEnabled: data.isVideoEnabled ?? false,
        isAudioEnabled: data.isAudioEnabled ?? false,
        isScreenSharing: data.isScreenSharing ?? false,
        connectionQuality: data.connectionQuality || 'unknown',
        joinedAt: new Date(),
        producers: data.producers || [],
      };

      const newMap = new Map(participants);
      newMap.set(p.id, p);
      participants = newMap;

      // System message
      messages = [
        ...messages,
        {
          id: `msg-${Date.now()}`,
          userId: 'system',
          displayName: 'System',
          content: `${p.displayName} joined the room`,
          type: 'system',
          createdAt: new Date(),
        },
      ];
    },

    updateParticipant(id: string, updates: Partial<Participant>) {
      const existing = participants.get(id);
      if (!existing) return;

      const newMap = new Map(participants);
      newMap.set(id, { ...existing, ...updates });
      participants = newMap;
    },

    removeParticipant(id: string) {
      const existing = participants.get(id);
      const newMap = new Map(participants);
      newMap.delete(id);
      participants = newMap;

      if (existing) {
        messages = [
          ...messages,
          {
            id: `msg-${Date.now()}`,
            userId: 'system',
            displayName: 'System',
            content: `${existing.displayName} left the room`,
            type: 'system',
            createdAt: new Date(),
          },
        ];
      }

      if (spotlightedParticipantId === id) {
        spotlightedParticipantId = null;
      }
    },

    setSpotlight(id: string | null) {
      spotlightedParticipantId = id;
    },

    // Consumer actions
    addConsumer(entry: ConsumerEntry) {
      const newMap = new Map(consumers);
      newMap.set(entry.consumerId, entry);
      consumers = newMap;
    },

    removeConsumer(consumerId: string) {
      const newMap = new Map(consumers);
      newMap.delete(consumerId);
      consumers = newMap;
    },

    clearConsumers() {
      consumers = new Map();
    },

    // Chat actions
    addMessage(msg: Omit<ChatMessage, 'id' | 'createdAt'>) {
      messages = [
        ...messages,
        {
          ...msg,
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date(),
        },
      ];
      if (!isChatOpen) {
        unreadMessageCount += 1;
      }
    },

    markMessagesAsRead() {
      unreadMessageCount = 0;
    },

    toggleChat() {
      isChatOpen = !isChatOpen;
      if (isChatOpen) {
        unreadMessageCount = 0;
      }
    },

    // Alert actions
    addAlert(a: Omit<Alert, 'id' | 'createdAt'>) {
      alerts = [
        ...alerts,
        {
          ...a,
          id: `alert-${Date.now()}`,
          createdAt: new Date(),
        },
      ];
    },

    dismissAlert(id: string) {
      alerts = alerts.filter((a) => a.id !== id);
    },

    // UI actions
    toggleParticipantList() {
      isParticipantListOpen = !isParticipantListOpen;
    },

    setLayoutMode(mode: 'grid' | 'spotlight' | 'sidebar') {
      layoutMode = mode;
    },

    // Reset
    reset() {
      roomId = null;
      roomName = '';
      status = 'scheduled';
      settings = {
        maxParticipants: 100,
        allowChat: true,
        allowReactions: true,
        allowScreenShare: true,
        muteOnEntry: true,
        waitingRoom: false,
      };
      participants = new Map();
      spotlightedParticipantId = null;
      isVideoEnabled = false;
      isAudioEnabled = false;
      isScreenSharing = false;
      isConnected = false;
      isJoined = false;
      isReconnecting = false;
      activeSpeakerId = null;
      consumers = new Map();
      localStream = null;
      screenStream = null;
      messages = [];
      unreadMessageCount = 0;
      alerts = [];
      isChatOpen = false;
      isParticipantListOpen = false;
      layoutMode = 'grid';
      error = null;
    },
  };
}

export const roomStore = createRoomStore();
