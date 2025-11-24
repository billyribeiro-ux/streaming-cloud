/**
 * Signaling Protocol Types
 */

// Client to Server Events
export type ClientEventType =
  | 'authenticate'
  | 'join-room'
  | 'leave-room'
  | 'create-transport'
  | 'connect-transport'
  | 'produce'
  | 'consume'
  | 'resume-consumer'
  | 'pause-producer'
  | 'resume-producer'
  | 'close-producer'
  | 'set-preferred-layers'
  | 'get-router-rtp-capabilities';

// Server to Client Events
export type ServerEventType =
  | 'welcome'
  | 'authenticated'
  | 'room-joined'
  | 'transport-created'
  | 'transport-connected'
  | 'produced'
  | 'consumer-created'
  | 'consumer-resumed'
  | 'new-producer'
  | 'participant-joined'
  | 'participant-left'
  | 'producer-paused'
  | 'producer-resumed'
  | 'producer-closed'
  | 'router-rtp-capabilities'
  | 'error';

export interface SignalingMessage {
  event: string;
  data: any;
}

export interface ClientMessage extends SignalingMessage {
  event: ClientEventType;
}

export interface ServerMessage extends SignalingMessage {
  event: ServerEventType;
}

export interface ParticipantInfo {
  id: string;
  odUserId: string;
  displayName: string;
  role: string;
  producers: ProducerInfo[];
}

export interface ProducerInfo {
  id: string;
  kind: 'audio' | 'video';
  source: 'camera' | 'microphone' | 'screen';
}

export interface TransportOptions {
  id: string;
  iceParameters: any;
  iceCandidates: any[];
  dtlsParameters: any;
  sctpParameters?: any;
}

export interface RoomJoinedData {
  roomId: string;
  participantId: string;
  routerRtpCapabilities: any;
  participants: ParticipantInfo[];
  sfuNode: string;
}
