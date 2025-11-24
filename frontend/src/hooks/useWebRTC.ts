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
  RtpCapabilities,
} from 'mediasoup-client/lib/types';
import { useSignaling } from './useSignaling';
import { useRoomStore } from '../stores/roomStore';

interface MediaState {
  video: boolean;
  audio: boolean;
  screen: boolean;
}

interface Participant {
  id: string;
  userId: string;
  displayName: string;
  role: string;
  producers: ProducerInfo[];
}

interface ProducerInfo {
  id: string;
  kind: 'audio' | 'video';
  source: 'camera' | 'microphone' | 'screen';
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
  const [error, setError] = useState<string | null>(null);

  // Refs
  const deviceRef = useRef<Device | null>(null);
  const sendTransportRef = useRef<Transport | null>(null);
  const recvTransportRef = useRef<Transport | null>(null);
  const producersRef = useRef<Map<string, Producer>>(new Map());
  const consumersRef = useRef<Map<string, Consumer>>(new Map());

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
    onError: (err) => setError(err.message),
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
    participants: Participant[];
  }) {
    try {
      // Initialize mediasoup device
      await initializeDevice(data.routerRtpCapabilities);
      setIsJoined(true);

      // Set initial participants
      setParticipants(data.participants);

      // Create transports
      await createTransports();

      // Consume existing producers
      for (const participant of data.participants) {
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

      transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          signaling.send({
            event: 'connect-transport',
            data: { transportId: data.transportId, dtlsParameters },
          });
          callback();
        } catch (err) {
          errback(err as Error);
        }
      });

      transport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
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
      });
    } else {
      transport = device.createRecvTransport(transportOptions);
      recvTransportRef.current = transport;

      transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          signaling.send({
            event: 'connect-transport',
            data: { transportId: data.transportId, dtlsParameters },
          });
          callback();
        } catch (err) {
          errback(err as Error);
        }
      });
    }

    transport.on('connectionstatechange', (state) => {
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
