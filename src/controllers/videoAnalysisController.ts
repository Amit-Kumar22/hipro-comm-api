/// <reference path="../types/ffprobe.d.ts" />

import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

// Function to dynamically import ffprobe modules
async function loadFFprobeModules() {
  const ffprobe = (await import('ffprobe')).default;
  const ffprobeStatic = (await import('ffprobe-static')).default;
  return { ffprobe, ffprobeStatic };
}

// Type definitions for ffprobe data
interface Stream {
  codec_type: string;
  codec_name: string;
  width?: number;
  height?: number;
  bit_rate?: string;
  r_frame_rate?: string;
  duration?: string;
  [key: string]: any;
}

interface ProbeData {
  streams: Stream[];
  format: {
    duration: string;
    bit_rate: string;
    format_name: string;
    [key: string]: any;
  };
}

interface VideoMetadata {
  hasVideo: boolean;
  hasAudio: boolean;
  videoCodec?: string;
  audioCodec?: string;
  duration: number;
  width?: number;
  height?: number;
  bitrate?: number;
  framerate?: number;
  isWebCompatible: boolean;
  issues: string[];
  recommendations: string[];
}

export const analyzeVideoFile = async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    
    if (!filename) {
      return res.status(400).json({
        error: 'Filename parameter is required'
      });
    }
    
    const filePath = path.join(process.cwd(), 'uploads', 'videos', filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: 'Video file not found'
      });
    }

    // Load ffprobe modules
    const { ffprobe, ffprobeStatic } = await loadFFprobeModules();

    // Analyze video using ffprobe
    const probeData: ProbeData = await ffprobe(filePath, { path: ffprobeStatic });
    
    // Extract streams
    const videoStream = probeData.streams.find((s: Stream) => s.codec_type === 'video');
    const audioStream = probeData.streams.find((s: Stream) => s.codec_type === 'audio');
    
    // Calculate duration
    const duration = parseFloat(probeData.format.duration) || 0;
    
    // Analyze video metadata
    const metadata: VideoMetadata = {
      hasVideo: !!videoStream,
      hasAudio: !!audioStream,
      duration,
      isWebCompatible: true,
      issues: [],
      recommendations: []
    };

    if (videoStream) {
      metadata.videoCodec = videoStream.codec_name;
      metadata.width = videoStream.width;
      metadata.height = videoStream.height;
      metadata.bitrate = parseInt(videoStream.bit_rate || '0');
      
      // Calculate framerate
      if (videoStream.r_frame_rate) {
        const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
        metadata.framerate = (den && num) ? num / den : 0;
      }
      
      // Check video codec compatibility
      const webCompatibleVideoCodecs = ['h264', 'vp8', 'vp9', 'av01'];
      if (!webCompatibleVideoCodecs.includes(videoStream.codec_name.toLowerCase())) {
        metadata.isWebCompatible = false;
        metadata.issues.push(`Video codec ${videoStream.codec_name} may not be supported in all browsers`);
        metadata.recommendations.push('Re-encode video with H.264, VP8, or VP9 codec for better web compatibility');
      }
      
      // Check resolution
      if (metadata.width && metadata.height) {
        if (metadata.width > 1920 || metadata.height > 1080) {
          metadata.issues.push('High resolution video may cause performance issues');
          metadata.recommendations.push('Consider reducing resolution to 1080p or lower for web delivery');
        }
      }
      
      // Check bitrate
      if (metadata.bitrate && metadata.bitrate > 5000000) { // 5 Mbps
        metadata.issues.push('High bitrate may cause slow loading');
        metadata.recommendations.push('Consider reducing bitrate for faster loading');
      }
    } else {
      metadata.isWebCompatible = false;
      metadata.issues.push('No video stream found - this may be an audio-only file');
      metadata.recommendations.push('Upload a file with video content');
    }

    if (audioStream) {
      metadata.audioCodec = audioStream.codec_name;
      
      // Check audio codec compatibility
      const webCompatibleAudioCodecs = ['aac', 'mp3', 'vorbis', 'opus'];
      if (!webCompatibleAudioCodecs.includes(audioStream.codec_name.toLowerCase())) {
        metadata.isWebCompatible = false;
        metadata.issues.push(`Audio codec ${audioStream.codec_name} may not be supported in all browsers`);
        metadata.recommendations.push('Re-encode audio with AAC or MP3 codec for better web compatibility');
      }
    }

    // Container format compatibility
    const webCompatibleFormats = ['mp4', 'webm', 'ogg'];
    const formatName = probeData.format.format_name.toLowerCase();
    const isFormatCompatible = webCompatibleFormats.some(format => 
      formatName.includes(format)
    );
    
    if (!isFormatCompatible) {
      metadata.isWebCompatible = false;
      metadata.issues.push(`Container format ${probeData.format.format_name} may not be web-compatible`);
      metadata.recommendations.push('Re-encode to MP4, WebM, or OGG container for web compatibility');
    }

    // Return comprehensive analysis
    return res.status(200).json({
      success: true,
      filename,
      metadata,
      technical: {
        format: probeData.format,
        streams: probeData.streams.map((stream: Stream) => ({
          type: stream.codec_type,
          codec: stream.codec_name,
          bitrate: stream.bit_rate,
          duration: stream.duration,
          ...(stream.codec_type === 'video' && {
            width: stream.width,
            height: stream.height,
            framerate: stream.r_frame_rate
          })
        }))
      }
    });

  } catch (error) {
    console.error('Video analysis error:', error);
    return res.status(500).json({
      error: 'Failed to analyze video file',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};