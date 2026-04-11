/**
 * Default mediasoup router codecs and WebRTC transport options
 *
 * Codec priority: Opus (audio w/ FEC), VP9 SVC, H.264, VP8, AV1
 * Transport: UDP-preferred with bandwidth estimation tuning for trading rooms
 */

import type { RouterRtpCodecCapability, WebRtcTransportOptions } from 'mediasoup/types';

export const mediaCodecs: RouterRtpCodecCapability[] = [
  // Audio: Opus with Forward Error Correction for packet loss resilience
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
    parameters: {
      useinbandfec: 1,
      usedtx: 1,
      minptime: 10,
      'sprop-stereo': 0,
    },
  },
  // Video: VP9 with SVC for scalable simulcast (30-50% bandwidth savings over VP8)
  {
    kind: 'video',
    mimeType: 'video/VP9',
    clockRate: 90000,
    parameters: {
      'profile-id': 2,
      'x-google-start-bitrate': 1000,
    },
  },
  // Video: H.264 Constrained Baseline for Safari/iOS compatibility
  {
    kind: 'video',
    mimeType: 'video/H264',
    clockRate: 90000,
    parameters: {
      'packetization-mode': 1,
      'profile-level-id': '42e01f',
      'level-asymmetry-allowed': 1,
      'x-google-start-bitrate': 1000,
    },
  },
  // Video: H.264 High profile for better quality at same bitrate
  {
    kind: 'video',
    mimeType: 'video/H264',
    clockRate: 90000,
    parameters: {
      'packetization-mode': 1,
      'profile-level-id': '640032',
      'level-asymmetry-allowed': 1,
      'x-google-start-bitrate': 1000,
    },
  },
  // Video: VP8 as fallback (widest compatibility)
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: {
      'x-google-start-bitrate': 1000,
    },
  },
  // Video: AV1 for future-proofing (best compression, growing browser support)
  {
    kind: 'video',
    mimeType: 'video/AV1',
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
  // Bandwidth estimation: start at 600kbps, ramp up quickly
  // Prevents single client from saturating uplink during initial connection
  initialAvailableOutgoingBitrate: 600000,
};
