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

interface UseWebRTCOptions {
  signalingUrl: string;
  token: string;
  roomId: string;
  organizationId: string;
  /** Enable end-to-end encryption via Encoded Transform API. Default: false */
  enableE2EE?: boolean;
}

// ----------------------------------------------------------------
// E2EE: Encoded Transform helpers (RTCRtpScriptTransform / legacy)
// ----------------------------------------------------------------

/** 12-byte random IV prefix; the remaining 4 bytes are a frame counter. */
const E2EE_IV_LENGTH = 12;

/**
 * Encrypt an outgoing encoded frame using AES-GCM.
 * The IV is prepended to the cipher-text so the receiver can extract it.
 */
function setupSenderTransform(
  sender: RTCRtpSender,
  key: CryptoKey
): void {
  // Encoded Transform API (Chrome 110+, Safari 15.4+)
  const readable = (sender as any).createEncodedStreams?.()?.readable
    ?? (sender as any).transform?.readable;
  const writable = (sender as any).createEncodedStreams?.()?.writable
    ?? (sender as any).transform?.writable;

  // Prefer the modern RTCRtpSender.transform setter when available
  if ('transform' in sender) {
    let frameCounter = 0;
    const transform = new TransformStream({
      async transform(frame: any, controller: TransformStreamDefaultController) {
        const data = new Uint8Array(frame.data);
        const iv = new Uint8Array(E2EE_IV_LENGTH);
        crypto.getRandomValues(iv);
        // Embed a monotonic counter in the last 4 bytes for ordering
        const view = new DataView(iv.buffer);
        view.setUint32(iv.byteLength - 4, frameCounter++);

        const ciphertext = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv },
          key,
          data
        );

        const output = new Uint8Array(iv.byteLength + ciphertext.byteLength);
        output.set(iv, 0);
        output.set(new Uint8Array(ciphertext), iv.byteLength);

        frame.data = output.buffer;
        controller.enqueue(frame);
      },
    });

    (sender as any).transform = transform;
    return;
  }

  // Legacy Insertable Streams fallback
  if (readable && writable) {
    let frameCounter = 0;
    const ts = new TransformStream({
      async transform(frame: any, controller: TransformStreamDefaultController) {
        const data = new Uint8Array(frame.data);
        const iv = new Uint8Array(E2EE_IV_LENGTH);
        crypto.getRandomValues(iv);
        const view = new DataView(iv.buffer);
        view.setUint32(iv.byteLength - 4, frameCounter++);

        const ciphertext = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv },
          key,
          data
        );

        const output = new Uint8Array(iv.byteLength + ciphertext.byteLength);
        output.set(iv, 0);
        output.set(new Uint8Array(ciphertext), iv.byteLength);

        frame.data = output.buffer;
        controller.enqueue(frame);
      },
    });

    readable.pipeThrough(ts).pipeTo(writable);
  }
}

/**
 * Decrypt an incoming encoded frame using AES-GCM.
 */
function setupReceiverTransform(
  receiver: RTCRtpReceiver,
  key: CryptoKey
): void {
  if ('transform' in receiver) {
    const transform = new TransformStream({
      async transform(frame: any, controller: TransformStreamDefaultController) {
        const data = new Uint8Array(frame.data);
        if (data.byteLength <= E2EE_IV_LENGTH) {
          // Frame too small to contain IV + ciphertext; drop it
          return;
        }
        const iv = data.slice(0, E2EE_IV_LENGTH);
        const ciphertext = data.slice(E2EE_IV_LENGTH);

        try {
          const plaintext = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            ciphertext
          );
          frame.data = plaintext;
          controller.enqueue(frame);
        } catch {
          // Decryption failure (wrong key, corrupted frame) - drop silently
          console.warn('[E2EE] Frame decryption failed, dropping frame');
        }
      },
    });

    (receiver as any).transform = transform;
    return;
  }

  // Legacy Insertable Streams fallback
  const readable = (receiver as any).createEncodedStreams?.()?.readable
    ?? (receiver as any).transform?.readable;
  const writable = (receiver as any).createEncodedStreams?.()?.writable
    ?? (receiver as any).transform?.writable;

  if (readable && writable) {
    const ts = new TransformStream({
      async transform(frame: any, controller: TransformStreamDefaultController) {
        const data = new Uint8Array(frame.data);
        if (data.byteLength <= E2EE_IV_LENGTH) return;
        const iv = data.slice(0, E2EE_IV_LENGTH);
        const ciphertext = data.slice(E2EE_IV_LENGTH);

        try {
          const plaintext = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            ciphertext
          );
          frame.data = plaintext;
          controller.enqueue(frame);
        } catch {
          console.warn('[E2EE] Frame decryption failed, dropping frame');
        }
      },
    });

    readable.pipeThrough(ts).pipeTo(writable);
  }
}

// ----------------------------------------------------------------

export function useWebRTC(options: UseWebRTCOptions) {
  const { signalingUrl, token, roomId, organizationId, enableE2EE = false } = options;

  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [isE2EEEnabled, setIsE2EEEnabled] = useState(false);
  const [mediaState, setMediaState] = useState<MediaState>({
    video: false,
    audio: false,
    screen: false,
  });
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [consumers, setConsumers] = useState<Map<string, ConsumerInfo>>(new Map());
  const [error, setError] = useState<string | null>(null);

  // Refs
  const deviceRef = useRef<Device | null>(null);
  const sendTransportRef = useRef<Transport | null>(null);
  const recvTransportRef = useRef<Transport | null>(null);
  const producersRef = useRef<Map<string, Producer>>(new Map());
  const consumersRef = useRef<Map<string, Consumer>>(new Map());

  // E2EE refs
  const e2eeLocalKeyRef = useRef<CryptoKey | null>(null);
  const e2eeRemoteKeysRef = useRef<Map<string, CryptoKey>>(new Map());
  const e2eeDataProducerRef = useRef<DataProducer | null>(null);

  // Store
  const { setParticipants, addParticipant, removeParticipant } = useRoomStore();

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

      case 'producer-paused':
      case 'producer-resumed':
      case 'producer-closed':
        handleProducerStateChange(message);
        break;

      case 'data-consumer-created':
        handleDataConsumerCreated(message.data);
        break;

      case 'error':
        setError(message.data.message);
        break;
    }
  }

  /**
   * Handle incoming DataConsumer creation (for E2EE key exchange).
   */
  async function handleDataConsumerCreated(data: {
    dataConsumerId: string;
    dataProducerId: string;
    label: string;
    protocol: string;
    sctpStreamParameters: any;
    appData: any;
  }) {
    const transport = recvTransportRef.current;
    if (!transport) return;

    try {
      const dataConsumer = await transport.consumeData({
        id: data.dataConsumerId,
        dataProducerId: data.dataProducerId,
        label: data.label,
        protocol: data.protocol,
        sctpStreamParameters: data.sctpStreamParameters,
        appData: data.appData,
      });

      if (data.label === 'e2ee-key') {
        dataConsumer.on('message', (message: any) => {
          const rawKey = message instanceof ArrayBuffer
            ? message
            : (message as Uint8Array).buffer;
          const participantId = data.appData?.participantId || data.dataProducerId;
          handleE2EEKeyReceived(participantId, rawKey);
        });
        console.log('[E2EE] DataConsumer created for key exchange');
      }
    } catch (err) {
      console.error('Failed to consume data:', err);
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

  // ---- E2EE key generation and broadcast ----------------------------

  /**
   * Generate AES-GCM 256-bit key and broadcast it to peers via DataChannel.
   * Called once after transports are ready when E2EE is enabled.
   */
  async function initializeE2EE(): Promise<void> {
    const transport = sendTransportRef.current;
    if (!transport) return;

    // Generate a random 256-bit AES-GCM key
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true, // extractable so we can export & send to peers
      ['encrypt', 'decrypt']
    );

    e2eeLocalKeyRef.current = key;
    setIsE2EEEnabled(true);

    // Export the raw key bytes for transmission
    const rawKey = await crypto.subtle.exportKey('raw', key);

    // Create a DataProducer to broadcast the key
    try {
      const dataProducer = await transport.produceData({
        label: 'e2ee-key',
        protocol: '',
        ordered: true,
        appData: { source: 'e2ee' },
      });

      e2eeDataProducerRef.current = dataProducer;

      // Broadcast the key as raw bytes
      dataProducer.send(new Uint8Array(rawKey));

      console.log('[E2EE] Local encryption key generated and broadcast');
    } catch (err) {
      console.error('[E2EE] Failed to create DataProducer for key exchange:', err);
    }
  }

  /**
   * Handle incoming DataConsumer with label 'e2ee-key'.
   * Imports the sender's key and stores it indexed by participant ID.
   */
  async function handleE2EEKeyReceived(
    participantId: string,
    rawKeyBytes: ArrayBuffer
  ): Promise<void> {
    try {
      const key = await crypto.subtle.importKey(
        'raw',
        rawKeyBytes,
        { name: 'AES-GCM', length: 256 },
        false, // non-extractable on the receiving side
        ['decrypt']
      );
      e2eeRemoteKeysRef.current.set(participantId, key);
      console.log(`[E2EE] Stored key for participant ${participantId}`);
    } catch (err) {
      console.error('[E2EE] Failed to import remote key:', err);
    }
  }

  // ---- End E2EE helpers --------------------------------------------

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

      // Initialize E2EE after transports are ready (if enabled)
      if (enableE2EE) {
        // Small delay to ensure transports are fully set up
        setTimeout(() => initializeE2EE(), 200);
      }

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
    // Create send transport (for producing)
    signaling.send({
      event: 'create-transport',
      data: { direction: 'send' },
    });

    // Create receive transport (for consuming)
    signaling.send({
      event: 'create-transport',
      data: { direction: 'recv' },
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

      // Handle DataChannel produceData for E2EE key exchange
      transport.on(
        'producedata',
        async (
          {
            sctpStreamParameters,
            label,
            protocol,
            appData,
          }: {
            sctpStreamParameters: any;
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

          // Wait for data-produced event
          const dataProducerId = await new Promise<string>((resolve) => {
            signaling.once('data-produced', (msg: any) => {
              resolve(msg.data.dataProducerId);
            });
          });
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
        transport.close();
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

  // Join room
  const joinRoom = useCallback(
    async (displayName: string, role: string = 'viewer') => {
      if (!signaling.isConnected) {
        throw new Error('Not connected to signaling server');
      }

      // Authenticate first
      signaling.send({
        event: 'authenticate',
        data: { token, organizationId },
      });

      // Wait a bit for auth, then join
      setTimeout(() => {
        signaling.send({
          event: 'join-room',
          data: {
            roomId,
            role,
            displayName,
            rtpCapabilities: deviceRef.current?.rtpCapabilities,
          },
        });
      }, 500);
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

    // Close E2EE DataProducer
    if (e2eeDataProducerRef.current) {
      e2eeDataProducerRef.current.close();
      e2eeDataProducerRef.current = null;
    }
    e2eeLocalKeyRef.current = null;
    e2eeRemoteKeysRef.current.clear();
    setIsE2EEEnabled(false);

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
            { maxBitrate: 100000, scaleResolutionDownBy: 4 },
            { maxBitrate: 300000, scaleResolutionDownBy: 2 },
            { maxBitrate: 900000 },
          ],
          codecOptions: {
            videoGoogleStartBitrate: 1000,
          },
          appData: { source: 'camera' },
        });

        producersRef.current.set('video', producer);

        // Apply E2EE sender transform
        if (enableE2EE && e2eeLocalKeyRef.current) {
          const rtpSender = (producer as any).rtpSender as RTCRtpSender | undefined;
          if (rtpSender) {
            setupSenderTransform(rtpSender, e2eeLocalKeyRef.current);
          }
        }

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
          },
          appData: { source: 'microphone' },
        });

        producersRef.current.set('audio', producer);

        // Apply E2EE sender transform
        if (enableE2EE && e2eeLocalKeyRef.current) {
          const rtpSender = (producer as any).rtpSender as RTCRtpSender | undefined;
          if (rtpSender) {
            setupSenderTransform(rtpSender, e2eeLocalKeyRef.current);
          }
        }

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

        // Apply E2EE sender transform
        if (enableE2EE && e2eeLocalKeyRef.current) {
          const rtpSender = (producer as any).rtpSender as RTCRtpSender | undefined;
          if (rtpSender) {
            setupSenderTransform(rtpSender, e2eeLocalKeyRef.current);
          }
        }

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

      // Apply E2EE receiver transform if enabled
      if (enableE2EE) {
        const participantId = data.appData?.participantId || '';
        const remoteKey = e2eeRemoteKeysRef.current.get(participantId);
        if (remoteKey) {
          const rtpReceiver = (consumer as any).rtpReceiver as RTCRtpReceiver | undefined;
          if (rtpReceiver) {
            setupReceiverTransform(rtpReceiver, remoteKey);
          }
        }
      }

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

  // Handle producer state changes
  function handleProducerStateChange(message: any) {
    const { producerId } = message.data;
    // Update UI based on producer state changes
    console.log('Producer state change:', message.event, producerId);
  }

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
    isE2EEEnabled,
    mediaState,
    localStream,
    screenStream,
    consumers,
    error,

    // Actions
    connect: signaling.connect,
    disconnect: signaling.disconnect,
    joinRoom,
    leaveRoom,
    toggleVideo,
    toggleAudio,
    toggleScreen,

    // Utils
    clearError: () => setError(null),
  };
}
