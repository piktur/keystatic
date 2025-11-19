import type { CollectionAction } from '@keystatic/core';
// import { uploadCloudIcon } from '@keystar/ui/icon/icons/uploadCloudIcon';

export const key = 'videos';
export const label = 'Bulk Upload';
// export const icon = uploadCloudIcon;
export const description = 'Upload multiple videos with robust pause/resume/cancel controls';

const VIDEO_METADATA_PATTERN = /^(?<camera>\w+)[-_](?<timestamp>\d+)[-_](?<resolution>\d+p)/;

export const handler: CollectionAction['handler'] = async (context) => {
  return {
    success: true,
    message: 'Video bulk upload completed',
  };
};

export const config = {
  acceptedFileTypes: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska'],
  maxFiles: 20,
  transferConfig: {
    chunkSize: 5 * 1024 * 1024,
    concurrency: 2,
    batchSize: 3,
    maxRetries: 5,
    retryDelay: 2000,
    metadataPatterns: [
      {
        name: 'video',
        pattern: VIDEO_METADATA_PATTERN,
        fields: ['camera', 'timestamp', 'resolution'],
      },
    ],
  },
  extractMetadata: (filename: string) => {
    const match = filename.match(VIDEO_METADATA_PATTERN);
    if (match?.groups) {
      return {
        camera: match.groups.camera,
        timestamp: match.groups.timestamp,
        resolution: match.groups.resolution,
        originalName: filename,
      };
    }
    return {
      originalName: filename,
    };
  },
  createSlug: (filename: string, index: number) => {
    const baseName = filename.replace(/\.[^.]+$/, '');
    const slug = baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `${slug}-${index}`;
  },
};

export const condition: CollectionAction['condition'] = () => {
  return true;
};
