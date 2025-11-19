# Bulk Upload Actions in Keystatic

## Overview

Keystatic now supports **bulk upload actions** for collections, enabling users to drag-and-drop multiple files (images, videos, etc.) and create multiple collection items at once.

## Features

- ✅ **Drag & Drop**: Multi-file drag-and-drop interface
- ✅ **Progress Tracking**: Real-time progress bars per file
- ✅ **Pause/Resume/Cancel**: Control individual file transfers
- ✅ **Metadata Extraction**: Auto-extract metadata from filenames
- ✅ **Slug Generation**: Automatic slug creation from filenames
- ✅ **Transfer Engine**: Robust streaming with chunked uploads
- ✅ **Configurable**: Customize file types, chunk size, concurrency

## Setup

### 1. Define Collection Actions

Create action files in `src/keystatic/actions/{collection}/`:

```typescript
// src/keystatic/actions/images/bulk-upload.ts
import type { CollectionAction } from '@keystatic/core';
import { uploadCloudIcon } from '@keystar/ui/icon/icons/uploadCloudIcon';

export const key = 'bulk-upload-images';
export const label = 'Bulk Upload';
export const icon = uploadCloudIcon;
export const description = 'Upload multiple images at once';

export const config = {
  acceptedFileTypes: ['image/*'],
  maxFiles: 50,
  transferConfig: {
    chunkSize: 1024 * 1024, // 1MB
    concurrency: 2,
    batchSize: 5,
  },
  createSlug: (filename: string, index: number) => {
    return filename
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') + \`-\${index}\`;
  },
};

export const handler: CollectionAction['handler'] = async (context) => {
  return { success: true };
};

export const condition: CollectionAction['condition'] = () => true;
```

### 2. Configure Collections

In `keystatic.config.ts`:

```typescript
import { config, fields, collection } from '@keystatic/core';

export default config({
  storage: { kind: 'local' },
  collections: {
    images: collection({
      label: 'Images',
      slugField: 'title',
      path: 'src/content/images/*',
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        description: fields.text({ label: 'Description', multiline: true }),
        image: fields.image({
          label: 'Image',
          directory: 'src/content/images',
        }),
        tags: fields.array(
          fields.text({ label: 'Tag' }),
          { label: 'Tags' }
        ),
      },
      // Actions are auto-discovered from src/keystatic/actions/images/
    }),
  },
});
```

### 3. Use the Action

1. Navigate to the **Images** collection in Keystatic dashboard
2. Click the **"Bulk Upload"** button in the header
3. Drag-and-drop multiple images or click "Browse Files"
4. Monitor progress with individual progress bars
5. Use pause/resume/cancel controls as needed
6. Click **"Upload"** to create collection items

## Configuration Options

### Transfer Config

```typescript
export const config = {
  transferConfig: {
    chunkSize: 5 * 1024 * 1024,  // 5MB for videos
    concurrency: 2,               // Max 2 simultaneous transfers
    batchSize: 3,                 // Process 3 files per batch
    maxRetries: 5,                // Retry failed chunks 5 times
    retryDelay: 2000,             // Wait 2s between retries
    metadataPatterns: [
      {
        name: 'video',
        pattern: /^(?<camera>\w+)[-_](?<timestamp>\d+)[-_](?<resolution>\d+p)/,
        fields: ['camera', 'timestamp', 'resolution'],
      },
    ],
  },
};
```

### Metadata Extraction

```typescript
export const config = {
  extractMetadata: (filename: string) => {
    const match = filename.match(/CAM(\d+)_(\d+)_(\d+p)/);
    if (match) {
      return {
        camera: \`CAM\${match[1]}\`,
        timestamp: match[2],
        resolution: match[3],
      };
    }
    return { originalName: filename };
  },
};
```

### Slug Generation

```typescript
export const config = {
  createSlug: (filename: string, index: number) => {
    // Extract date from filename: "2024-01-15-event.jpg"
    const match = filename.match(/^(\d{4}-\d{2}-\d{2})-(.+)/);
    if (match) {
      const [, date, name] = match;
      return \`\${date}-\${name.replace(/\.[^.]+$/, '')}-\${index}\`;
    }
    return filename.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  },
};
```

## Examples

### Images Collection

```typescript
// src/keystatic/actions/images/bulk-upload.ts
export const config = {
  acceptedFileTypes: ['image/png', 'image/jpeg', 'image/webp'],
  maxFiles: 100,
  transferConfig: {
    chunkSize: 1024 * 1024, // 1MB chunks
    concurrency: 3,
  },
  createSlug: (filename, index) => {
    const name = filename.replace(/\.[^.]+$/, '');
    return \`\${name}-\${Date.now()}-\${index}\`;
  },
};
```

### Videos Collection

```typescript
// src/keystatic/actions/videos/bulk-upload.ts
export const config = {
  acceptedFileTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
  maxFiles: 20,
  transferConfig: {
    chunkSize: 5 * 1024 * 1024, // 5MB chunks for large files
    concurrency: 2,
    batchSize: 3,
    maxRetries: 5,
    retryDelay: 2000,
    metadataPatterns: [
      {
        name: 'video',
        pattern: /^(?<camera>\w+)[-_](?<timestamp>\d+)[-_](?<resolution>\d+p)/,
        fields: ['camera', 'timestamp', 'resolution'],
      },
    ],
  },
  extractMetadata: (filename) => {
    const match = filename.match(/^(\w+)_(\d+)_(\d+p)/);
    return match
      ? {
          camera: match[1],
          timestamp: new Date(parseInt(match[2]) * 1000).toISOString(),
          resolution: match[3],
        }
      : {};
  },
};
```

## File Structure

```
keystatic-project/
├── keystatic.config.ts
└── src/
    ├── content/
    │   ├── images/           # Image files stored here
    │   └── videos/           # Video files stored here
    └── keystatic/
        └── actions/
            ├── images/
            │   └── bulk-upload.ts
            └── videos/
                └── bulk-upload.ts
```

## Implementation Details

### Transfer Engine

The bulk upload uses a streaming transfer engine with:

- **Chunked streaming**: Files are processed in chunks (configurable size)
- **Memory efficient**: Never loads entire file into memory
- **Pause/resume**: Can pause mid-transfer and resume later
- **Cancellation**: Clean abort of in-progress transfers
- **Retry logic**: Automatic retries with exponential backoff
- **Progress tracking**: Real-time bytes transferred and percentage

### Collection Item Creation

When upload completes:

1. Files are stored in the configured `directory`
2. Collection items are created with:
   - Auto-generated slug
   - Extracted metadata
   - File reference
   - Default frontmatter values

Example created item:

```yaml
---
title: sunset-beach-2024
description: ''
alt: Sunset at the beach
tags:
  - nature
  - sunset
---
```

## Advanced Usage

### Custom Upload Handler

```typescript
export const config = {
  onItemsCreated: async (items) => {
    // Process uploaded items
    for (const item of items) {
      console.log(\`Created: \${item.slug}\`);
      
      // Could trigger additional processing:
      // - Generate thumbnails
      // - Extract EXIF data
      // - Run image optimization
      // - Send notifications
    }
  },
};
```

### Conditional Actions

```typescript
export const condition: CollectionAction['condition'] = ({ currentState }) => {
  // Only show bulk upload if user has permission
  return userHasPermission('bulk-upload');
};
```

## Troubleshooting

### Large Files Not Uploading

Increase `chunkSize` and reduce `concurrency`:

```typescript
transferConfig: {
  chunkSize: 10 * 1024 * 1024, // 10MB
  concurrency: 1,
}
```

### Memory Issues

Reduce `batchSize` to process fewer files simultaneously:

```typescript
transferConfig: {
  batchSize: 2, // Only 2 files in memory at once
}
```

### Network Errors

Increase retries and delay:

```typescript
transferConfig: {
  maxRetries: 10,
  retryDelay: 5000, // 5 seconds
}
```

## API Reference

See:
- `~/Code/piktur/keystatic/packages/keystatic/src/app/actions/BulkUploadAction.tsx`
- `~/Code/piktur/keystatic/packages/keystatic/src/app/actions/BulkUploadWithTransferEngine.tsx`

## Next Steps

1. Customize metadata extraction for your use case
2. Add custom validation logic
3. Integrate with external APIs (e.g., image optimization services)
4. Add automated tests for bulk upload workflows
