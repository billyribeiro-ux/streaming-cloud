/**
 * useWebRTC Hook - WebRTC Connection Management
 *
 * Manages the entire WebRTC lifecycle including:
 * - Signaling server connection
 * - Transport creation
 * - Producer/Consumer management
 * - Media stream handling
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Device } from 'mediasoup-client';
import type {
  Transport,
  Producer,
  Consumer,
  DataProducer,
  DataConsumer,
  RtpCapabilities,
  DtlsParameters,
  RtpParameters,
  MediaKind,
  AppData,
  ConnectionState,
  SctpStreamParameters,
} from 'mediasoup-client/types';
import { useSignaling } from './useSignaling';
import {
  useRoomStore,
  type Participant,
  type ProducerInfo,
} from '../stores/roomStore';

interface MediaState {
  video: boolean;
  audio: boolean;
  screen: boolean;
}

function mapServerParticipant(
  p: Partial<Participant> & {
    id: string;
    producers?: ProducerInfo[];
    joinedAt?: Date | string | number;
  }
): Participant {
  return {
    id: p.id,
    userId: p.userId ?? '',
    displayName: p.displayName ?? 'Unknown',
    role: (p.role as Participant['role']) ?? 'viewer',
    isVideoEnabled: p.isVideoEnabled ?? false,
    isAudioEnabled: p.isAudioEnabled ?? false,
    isScreenSharing: p.isScreenSharing ?? false,
    connectionQuality: p.connectionQuality ?? 'unknown',
    joinedAt:
      p.joinedAt instanceof Date
        ? p.joinedAt
        : new Date(p.joinedAt ?? Date.now()),
    producers: p.producers ?? [],
  };
}

interface ConsumerInfo {
  consumerId: string;
  producerId: string;
  kind: 'audio' | 'video';
  track: MediaStreamTrack;
  participantId: string;
}

type ConnectionQualityLevel = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';

function mapScoreToQuality(score: number): ConnectionQualityLevel {
  if (score >= 8) return 'excellent';
  if (score >= 5) return 'good';
  if (score >= 3) return 'fair';
  return 'poor';
}

interface DataMessage {
  label: string;
  data: string;
  participantId: string;
  timestamp: number;
}

interface UseWebRTCOptions {
  signalingUrl: string;
  token: string;
  roomId: string;
  organizationId: string;
}

export function useWebRTC(options: UseWebRTCOptions) {
  const { signalingUrl, token, roomId, organizationId } = options;

  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [mediaState, setMediaState] = useState<MediaState>({
    video: false,
    audio: false,
    screen: false,
  });
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [consumers, setConsumers] = useState<Map<string, ConsumerInfo>>(new Map());
  const [dataMessages, setDataMessages] = useState<DataMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const deviceRef = useRef<Device | null>(null);
  const sendTransportRef = useRef<Transport | null>(null);
  const recvTransportRef = useRef<Transport | null>(null);
  const producersRef = useRef<Map<string, Producer>>(new Map());
  const consumersRef = useRef<Map<string, Consumer>>(new Map());
  const dataProducersRef = useRef<Map<string, DataProducer>>(new Map());
  const dataConsumersRef = useRef<Map<string, DataConsumer>>(new Map());

  // Connection quality per participant
  const [connectionQuality, setConnectionQuality] = useState<
    Map<string, 'excellent' | 'good' | 'fair' | 'poor' | 'unknown'>
  >(new Map());

  // Store
  const { setParticipants, addParticipant, removeParticipant, updateParticipant } = useRoomStore();

  // Signaling connection
  const signaling = useSignaling({
    url: signalingUrl,
    onOpen: () => setIsConnected(true),
    onClose: () => {
      setIsConnected(false);
      setIsJoined(false);
    },
    onError: () => setError('WebSocket connection error'),
    onMessage: handleSignalingMessage,
  });

  // Handle signaling messages
  function handleSignalingMessage(message: any) {
    switch (message.event) {
      case 'authenticated':
        console.log('Authenticated with signaling server');
        break;

      case 'room-joined':
        handleRoomJoined(message.data);
        break;

      case 'transport-created':
        handleTransportCreated(message.data);
        break;

      case 'transport-connected':
        console.log('Transport connected:', message.data.transportId);
        break;

      case 'produced':
        console.log('Producer created:', message.data.producerId);
        break;

      case 'consumer-created':
        handleConsumerCreated(message.data);
        break;

      case 'new-producer':
        handleNewProducer(message.data);
        break;

      case 'participant-joined':
        addParticipant(message.data);
        break;

      case 'participant-left':
        removeParticipant(message.data.participantId);
        break;

      case 'data-produced':
        console.log('DataProducer created:', message.data.dataProducerId);
        break;

      case 'data-consumer-created':
        handleDataConsumerCreated(message.data);
        break;

      case 'new-data-producer':
        handleNewDataProducer(message.data);
        break;

      case 'producer-paused':
      case 'producer-resumed':
      case 'producer-closed':
        handleProducerStateChange(message);
        break;

      case 'active-speaker':
        // Active speaker detected via AudioLevelObserver
        console.log('Active speaker:', message.data.participantId, 'volume:', message.data.volume);
        break;

      case 'score':
        // Connection quality score update
        console.log('Score update:', message.data.type, message.data.id, message.data.score);
        break;

      case 'ice-restarted':
        handleIceRestarted(message.data);
        break;

      case 'error':
        setError(message.data.message);
        break;
    }
  }

  // Initialize device with RTP capabilities
  const initializeDevice = useCallback(
    async (rtpCapabilities: RtpCapabilities) => {
      const device = new Device();
      await device.load({ routerRtpCapabilities: rtpCapabilities });
      deviceRef.current = device;
      return device;
    },
    []
  );

  // Handle room joined event
  async function handleRoomJoined(data: {
    roomId: string;
    participantId: string;
    routerRtpCapabilities: RtpCapabilities;
    participants: Partial<Participant> & { id: string }[];
  }) {
    try {
      // Initialize mediasoup device
      await initializeDevice(data.routerRtpCapabilities);
      setIsJoined(true);

      const normalizedParticipants = data.participants.map(mapServerParticipant);
      setParticipants(normalizedParticipants);

      // Create transports
      await createTransports();

      // Consume existing producers
      for (const participant of normalizedParticipants) {
        for (const producer of participant.producers) {
          await consumeProducer(producer.id);
        }
      }
    } catch (err) {
      console.error('Error handling room joined:', err);
      setError('Failed to initialize WebRTC');
    }
  }

  // Create send and receive transports
  async function createTransports() {
    const device = deviceRef.current;
    const sctpCapabilities = device?.sctpCapabilities;

    // Create send transport (for producing)
    signaling.send({
      event: 'create-transport',
      data: { direction: 'send', sctpCapabilities },
    });

    // Create receive transport (for consuming)
    signaling.send({
      event: 'create-transport',
      data: { direction: 'recv', sctpCapabilities },
    });
  }

  // Handle transport created event
  async function handleTransportCreated(data: {
    transportId: string;
    direction: 'send' | 'recv';
    iceParameters: any;
    iceCandidates: any[];
    dtlsParameters: any;
    sctpParameters?: any;
  }) {
    const device = deviceRef.current;
    if (!device) return;

    const transportOptions = {
      id: data.transportId,
      iceParameters: data.iceParameters,
      iceCandidates: data.iceCandidates,
      dtlsParameters: data.dtlsParameters,
      sctpParameters: data.sctpParameters,
    };

    let transport: Transport;

    if (data.direction === 'send') {
      transport = device.createSendTransport(transportOptions);
      sendTransportRef.current = transport;

      transport.on(
        'connect',
        async (
          { dtlsParameters }: { dtlsParameters: DtlsParameters },
          callback: () => void,
          errback: (error: Error) => void
        ) => {
        try {
          signaling.send({
            event: 'connect-transport',
            data: { transportId: data.transportId, dtlsParameters },
          });
          callback();
        } catch (err) {
          errback(err as Error);
        }
      }
      );

      transport.on(
        'produce',
        async (
          {
            kind,
            rtpParameters,
            appData,
          }: {
            kind: MediaKind;
            rtpParameters: RtpParameters;
            appData: AppData;
          },
          callback: (result: { id: string }) => void,
          errback: (error: Error) => void
        ) => {
        try {
          signaling.send({
            event: 'produce',
            data: {
              transportId: data.transportId,
              kind,
              rtpParameters,
              appData,
            },
          });

          // Wait for produced event
          const producerId = await waitForProducerId();
          callback({ id: producerId });
        } catch (err) {
          errback(err as Error);
        }
      }
      );

      transport.on(
        'producedata',
        async (
          {
            sctpStreamParameters,
            label,
            protocol,
            appData,
          }: {
            sctpStreamParameters: SctpStreamParameters;
            label: string;
            protocol: string;
            appData: AppData;
          },
          callback: (result: { id: string }) => void,
          errback: (error: Error) => void
        ) => {
        try {
          signaling.send({
            event: 'produce-data',
            data: {
              transportId: data.transportId,
              sctpStreamParameters,
              label,
              protocol,
              appData,
            },
          });

          const dataProducerId = await waitForDataProducerId();
          callback({ id: dataProducerId });
        } catch (err) {
          errback(err as Error);
        }
      }
      );
    } else {
      transport = device.createRecvTransport(transportOptions);
      recvTransportRef.current = transport;

      transport.on(
        'connect',
        async (
          { dtlsParameters }: { dtlsParameters: DtlsParameters },
          callback: () => void,
          errback: (error: Error) => void
        ) => {
        try {
          signaling.send({
            event: 'connect-transport',
            data: { transportId: data.transportId, dtlsParameters },
          });
          callback();
        } catch (err) {
          errback(err as Error);
        }
      }
      );
    }

    transport.on('connectionstatechange', (state: ConnectionState) => {
      console.log(`Transport ${data.direction} connection state:`, state);
      if (state === 'failed') {
        // Request ICE restart instead of closing - keeps the session alive
        console.warn(`Transport ${data.direction} failed, requesting ICE restart`);
        signaling.send({
          event: 'restart-ice',
          data: { transportId: data.transportId },
        });
      }
    });
  }

  // Wait for producer ID from signaling
  function waitForProducerId(): Promise<string> {
    return new Promise((resolve) => {
      const handler = (message: any) => {
        if (message.event === 'produced') {
          resolve(message.data.producerId);
        }
      };
      // Add one-time handler
      signaling.once('produced', handler);
    });
  }

  // Join room - authenticate first, then join on authenticated event
  const joinRoom = useCallback(
    async (displayName: string, role: string = 'viewer') => {
      if (!signaling.isConnected) {
        throw new Error('Not connected to signaling server');
      }

      // Wait for authenticated event before joining
      signaling.once('authenticated', () => {
        signaling.send({
          event: 'join-room',
          data: {
            roomId,
            role,
            displayName,
            rtpCapabilities: deviceRef.current?.rtpCapabilities,
          },
        });
      });

      // Send authenticate request
      signaling.send({
        event: 'authenticate',
        data: { token, organizationId },
      });
    },
    [signaling, token, organizationId, roomId]
  );

  // Leave room
  const leaveRoom = useCallback(async () => {
    // Stop all producers
    for (const producer of producersRef.current.values()) {
      producer.close();
    }
    producersRef.current.clear();

    // Stop all consumers
    for (const consumer of consumersRef.current.values()) {
      consumer.close();
    }
    consumersRef.current.clear();
    setConsumers(new Map());

    // Close all data producers
    for (const dataProducer of dataProducersRef.current.values()) {
      dataProducer.close();
    }
    dataProducersRef.current.clear();

    // Close all data consumers
    for (const dataConsumer of dataConsumersRef.current.values()) {
      dataConsumer.close();
    }
    dataConsumersRef.current.clear();
    setDataMessages([]);

    // Close transports
    sendTransportRef.current?.close();
    recvTransportRef.current?.close();

    // Stop local streams
    localStream?.getTracks().forEach((track) => track.stop());
    screenStream?.getTracks().forEach((track) => track.stop());
    setLocalStream(null);
    setScreenStream(null);

    // Send leave event
    signaling.send({ event: 'leave-room', data: {} });

    setIsJoined(false);
    setMediaState({ video: false, audio: false, screen: false });
  }, [signaling, localStream, screenStream]);

  // Enable/disable camera
  const toggleVideo = useCallback(async () => {
    const transport = sendTransportRef.current;
    if (!transport) return;

    if (mediaState.video) {
      // Disable video
      const producer = producersRef.current.get('video');
      if (producer) {
        producer.close();
        producersRef.current.delete('video');
        signaling.send({
          event: 'close-producer',
          data: { producerId: producer.id },
        });
      }
      setMediaState((prev) => ({ ...prev, video: false }));
    } else {
      // Enable video
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
        });

        const track = stream.getVideoTracks()[0];
        const producer = await transport.produce({
          track,
          encodings: [
            { rid: 'q', maxBitrate: 150000, scaleResolutionDownBy: 4, scalabilityMode: 'L1T3' },
            { rid: 'h', maxBitrate: 500000, scaleResolutionDownBy: 2, scalabilityMode: 'L1T3' },
            { rid: 'f', maxBitrate: 1200000, scalabilityMode: 'L1T3' },
          ],
          codecOptions: {
            videoGoogleStartBitrate: 1000,
          },
          appData: { source: 'camera' },
        });

        producersRef.current.set('video', producer);
        setLocalStream((prev) => {
          const newStream = prev || new MediaStream();
          newStream.addTrack(track);
          return newStream;
        });
        setMediaState((prev) => ({ ...prev, video: true }));
      } catch (err) {
        console.error('Failed to get video:', err);
        setError('Failed to access camera');
      }
    }
  }, [mediaState.video, signaling]);

  // Enable/disable microphone
  const toggleAudio = useCallback(async () => {
    const transport = sendTransportRef.current;
    if (!transport) return;

    if (mediaState.audio) {
      // Disable audio
      const producer = producersRef.current.get('audio');
      if (producer) {
        producer.close();
        producersRef.current.delete('audio');
        signaling.send({
          event: 'close-producer',
          data: { producerId: producer.id },
        });
      }
      setMediaState((prev) => ({ ...prev, audio: false }));
    } else {
      // Enable audio
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        const track = stream.getAudioTracks()[0];
        const producer = await transport.produce({
          track,
          codecOptions: {
            opusStereo: false,
            opusDtx: true,
            opusFec: true,
            opusMaxPlaybackRate: 48000,
          },
          appData: { source: 'microphone' },
        });

        producersRef.current.set('audio', producer);
        setLocalStream((prev) => {
          const newStream = prev || new MediaStream();
          newStream.addTrack(track);
          return newStream;
        });
        setMediaState((prev) => ({ ...prev, audio: true }));
      } catch (err) {
        console.error('Failed to get audio:', err);
        setError('Failed to access microphone');
      }
    }
  }, [mediaState.audio, signaling]);

  // Toggle screen share
  const toggleScreen = useCallback(async () => {
    const transport = sendTransportRef.current;
    if (!transport) return;

    if (mediaState.screen) {
      // Stop screen share
      const producer = producersRef.current.get('screen');
      if (producer) {
        producer.close();
        producersRef.current.delete('screen');
        signaling.send({
          event: 'close-producer',
          data: { producerId: producer.id },
        });
      }
      screenStream?.getTracks().forEach((track) => track.stop());
      setScreenStream(null);
      setMediaState((prev) => ({ ...prev, screen: false }));
    } else {
      // Start screen share
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
          },
          audio: true,
        });

        const videoTrack = stream.getVideoTracks()[0];

        // Handle user stopping share via browser UI
        videoTrack.onended = () => {
          toggleScreen();
        };

        const producer = await transport.produce({
          track: videoTrack,
          encodings: [
            { maxBitrate: 1500000, scaleResolutionDownBy: 2 },
            { maxBitrate: 4000000 },
          ],
          codecOptions: {
            videoGoogleStartBitrate: 1000,
          },
          appData: { source: 'screen' },
        });

        producersRef.current.set('screen', producer);
        setScreenStream(stream);
        setMediaState((prev) => ({ ...prev, screen: true }));
      } catch (err) {
        console.error('Failed to get screen:', err);
        // User cancelled or error - don't show error for cancel
        if ((err as Error).name !== 'NotAllowedError') {
          setError('Failed to share screen');
        }
      }
    }
  }, [mediaState.screen, signaling, screenStream]);

  // Consume a producer
  async function consumeProducer(producerId: string) {
    const device = deviceRef.current;
    if (!device || !device.rtpCapabilities) return;

    signaling.send({
      event: 'consume',
      data: {
        producerId,
        rtpCapabilities: device.rtpCapabilities,
      },
    });
  }

  // Handle new producer notification
  async function handleNewProducer(data: {
    producerId: string;
    producerUserId: string;
    participantId: string;
    kind: 'audio' | 'video';
    appData: any;
  }) {
    await consumeProducer(data.producerId);
  }

  // Handle consumer created
  async function handleConsumerCreated(data: {
    consumerId: string;
    producerId: string;
    kind: 'audio' | 'video';
    rtpParameters: any;
    appData: any;
  }) {
    const transport = recvTransportRef.current;
    if (!transport) return;

    try {
      const consumer = await transport.consume({
        id: data.consumerId,
        producerId: data.producerId,
        kind: data.kind,
        rtpParameters: data.rtpParameters,
        appData: data.appData,
      });

      consumersRef.current.set(data.consumerId, consumer);

      // Listen for score events to track connection quality
      consumer.on('score', (score) => {
        const participantId = data.appData?.participantId || '';
        if (!participantId) return;

        // mediasoup-client consumer score is { score, producerScore, producerScores }
        const consumerScore =
          typeof score === 'object' && score !== null && 'score' in score
            ? (score as { score: number }).score
            : typeof score === 'number'
              ? score
              : 0;
        const quality = mapScoreToQuality(consumerScore);

        setConnectionQuality((prev) => {
          const next = new Map(prev);
          next.set(participantId, quality);
          return next;
        });

        updateParticipant(participantId, { connectionQuality: quality });
      });

      // Resume consumer
      signaling.send({
        event: 'resume-consumer',
        data: { consumerId: data.consumerId },
      });

      // Add to state
      setConsumers((prev) => {
        const newMap = new Map(prev);
        newMap.set(data.consumerId, {
          consumerId: data.consumerId,
          producerId: data.producerId,
          kind: data.kind,
          track: consumer.track,
          participantId: data.appData?.participantId || '',
        });
        return newMap;
      });
    } catch (err) {
      console.error('Failed to consume:', err);
    }
  }

  // Handle ICE restart response from server
  async function handleIceRestarted(data: { transportId: string; iceParameters: any }) {
    // Find which transport needs the ICE restart applied
    const sendTransport = sendTransportRef.current;
    const recvTransport = recvTransportRef.current;

    const transport =
      sendTransport?.id === data.transportId ? sendTransport :
      recvTransport?.id === data.transportId ? recvTransport :
      null;

    if (transport) {
      await transport.restartIce({ iceParameters: data.iceParameters });
      console.log('ICE restart completed for transport:', data.transportId);
    }
  }

  // Handle producer state changes
  function handleProducerStateChange(message: any) {
    const { producerId } = message.data;
    // Update UI based on producer state changes
    console.log('Producer state change:', message.event, producerId);
  }

  // Poll recv transport stats every 5 seconds when joined
  useEffect(() => {
    if (!isJoined) return;

    const interval = setInterval(async () => {
      const transport = recvTransportRef.current;
      if (!transport) return;

      try {
        const stats = await transport.getStats();

        stats.forEach((report) => {
          if (report.type === 'inbound-rtp') {
            const { roundTripTime, jitter, packetsLost, bytesReceived, packetsReceived } =
              report as RTCInboundRtpStreamStats & { roundTripTime?: number };

            if (
              packetsLost !== undefined &&
              packetsReceived !== undefined &&
              packetsReceived > 0
            ) {
              const lossPercent = (packetsLost / (packetsReceived + packetsLost)) * 100;
              if (lossPercent > 2) {
                console.warn(
                  `[WebRTC Stats] High packet loss: ${lossPercent.toFixed(1)}% (lost=${packetsLost}, received=${packetsReceived})`
                );
              }
            }

            if (jitter !== undefined && jitter > 0.03) {
              console.warn(
                `[WebRTC Stats] High jitter: ${(jitter * 1000).toFixed(1)}ms`
              );
            }

            if (roundTripTime !== undefined || bytesReceived !== undefined) {
              console.debug('[WebRTC Stats]', {
                roundTripTime,
                jitter,
                packetsLost,
                bytesReceived,
              });
            }
          }
        });
      } catch (err) {
        console.debug('Failed to get transport stats:', err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isJoined]);

  // Handle new data producer notification
  async function handleNewDataProducer(data: {
    dataProducerId: string;
    participantId: string;
    label: string;
    protocol: string;
    appData: any;
  }) {
    signaling.send({
      event: 'consume-data',
      data: { dataProducerId: data.dataProducerId },
    });
  }

  // Handle data consumer created
  async function handleDataConsumerCreated(data: {
    dataConsumerId: string;
    dataProducerId: string;
    sctpStreamParameters: any;
    label: string;
    protocol: string;
    appData: any;
  }) {
    const transport = recvTransportRef.current;
    if (!transport) return;

    try {
      const dataConsumer = await transport.consumeData({
        id: data.dataConsumerId,
        dataProducerId: data.dataProducerId,
        sctpStreamParameters: data.sctpStreamParameters as SctpStreamParameters,
        label: data.label,
        protocol: data.protocol,
        appData: data.appData,
      });

      dataConsumersRef.current.set(data.dataConsumerId, dataConsumer);

      dataConsumer.on('message', (message: string | ArrayBuffer) => {
        const text = typeof message === 'string' ? message : new TextDecoder().decode(message as ArrayBuffer);
        setDataMessages((prev) => [
          ...prev,
          {
            label: dataConsumer.label,
            data: text,
            participantId: data.appData?.participantId || '',
            timestamp: Date.now(),
          },
        ]);
      });
    } catch (err) {
      console.error('Failed to consume data:', err);
    }
  }

  // Wait for data producer ID from signaling
  function waitForDataProducerId(): Promise<string> {
    return new Promise((resolve) => {
      const handler = (message: any) => {
        if (message.event === 'data-produced') {
          resolve(message.data.dataProducerId);
        }
      };
      signaling.once('data-produced', handler);
    });
  }

  // Send data on a DataChannel
  const sendData = useCallback(
    async (label: string, data: string) => {
      const transport = sendTransportRef.current;
      if (!transport) throw new Error('Send transport not created');

      let dataProducer = dataProducersRef.current.get(label);

      if (!dataProducer || dataProducer.closed) {
        // Create a new data producer for this label
        dataProducer = await transport.produceData({
          label,
          protocol: 'trading-data',
          appData: { label },
        });

        // Wait for server acknowledgment
        const dataProducerId = await waitForDataProducerId();
        console.log('DataProducer confirmed:', dataProducerId);

        dataProducersRef.current.set(label, dataProducer);
      }

      dataProducer.send(data);
    },
    []
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      leaveRoom();
      signaling.disconnect();
    };
  }, []);

  return {
    // State
    isConnected,
    isJoined,
    mediaState,
    localStream,
    screenStream,
    consumers,
    connectionQuality,
    dataMessages,
    error,

    // Actions
    connect: signaling.connect,
    disconnect: signaling.disconnect,
    joinRoom,
    leaveRoom,
    toggleVideo,
    toggleAudio,
    toggleScreen,
    sendData,

    // Utils
    clearError: () => setError(null),
  };
}
