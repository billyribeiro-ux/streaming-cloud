/**
 * Default mediasoup router codecs and WebRTC transport options
 */

import type { RouterRtpCodecCapability, WebRtcTransportOptions } from 'mediasoup/types';

export const mediaCodecs: RouterRtpCodecCapability[] = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: {
      'x-google-start-bitrate': 1000,
    },
  },
];

const announcedIp = process.env.MEDIASOUP_ANNOUNCED_IP;

export const webRtcTransportOptions: WebRtcTransportOptions = {
  listenIps: [{ ip: '0.0.0.0', announcedIp: announcedIp || undefined }],
  enableUdp: true,
  enableTcp: true,
  preferUdp: true,
};
