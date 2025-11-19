import { DialogContainer, Dialog } from '@keystar/ui/dialog';
import { Content, Footer } from '@keystar/ui/slots';
import { Button, ButtonGroup, ActionButton } from '@keystar/ui/button';
import { Flex, VStack } from '@keystar/ui/layout';
import { Text, Heading } from '@keystar/ui/typography';
import { ProgressBar } from '@keystar/ui/progress';
import { Icon } from '@keystar/ui/icon';
// import { uploadCloudIcon } from '@keystar/ui/icon/icons/uploadCloudIcon';
import { xIcon } from '@keystar/ui/icon/icons/xIcon';
import { checkCircleIcon } from '@keystar/ui/icon/icons/checkCircleIcon';
import { alertCircleIcon } from '@keystar/ui/icon/icons/alertCircleIcon';
import { pauseCircleIcon } from '@keystar/ui/icon/icons/pauseCircleIcon';
import { playCircleIcon } from '@keystar/ui/icon/icons/playCircleIcon';
import { Item, ListView } from '@keystar/ui/list-view';
import { ActionGroup, Item as ActionItem } from '@keystar/ui/action-group';
import { useState, useEffect, useRef } from 'react';
import type { CollectionAction, ActionContext } from '../../config';

export interface TransferItem {
  id: string;
  file: File;
  state: 'queued' | 'processing' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  bytesTransferred: number;
  totalBytes: number;
  metadata: Record<string, string>;
  error?: string;
  startTime?: number;
  endTime?: number;
  slug?: string;
}

export interface TransferConfig {
  chunkSize: number;
  concurrency: number;
  batchSize: number;
  maxRetries: number;
  retryDelay: number;
  metadataPatterns?: Array<{
    name: string;
    pattern: RegExp;
    fields: readonly string[];
  }>;
}

export interface BulkUploadWithTransferConfig {
  acceptedFileTypes?: string[];
  maxFiles?: number;
  directory?: string;
  transferConfig?: Partial<TransferConfig>;
  extractMetadata?: (filename: string) => Record<string, any>;
  createSlug?: (filename: string, index: number) => string;
  onItemsCreated?: (items: TransferItem[]) => Promise<void>;
}

const DEFAULT_TRANSFER_CONFIG: TransferConfig = {
  chunkSize: 5 * 1024 * 1024,
  concurrency: 2,
  batchSize: 3,
  maxRetries: 5,
  retryDelay: 2000,
};

export function BulkUploadWithTransferEngineComponent(props: {
  context: ActionContext<any>;
  onAction: () => Promise<void>;
  config?: BulkUploadWithTransferConfig;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<TransferItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const processingRef = useRef<Map<string, AbortController>>(new Map());

  const { config = {} } = props;
  const {
    acceptedFileTypes = ['image/*', 'video/*'],
    maxFiles = 50,
    transferConfig = {},
    extractMetadata,
    createSlug,
    onItemsCreated,
  } = config;

  const finalConfig: TransferConfig = {
    ...DEFAULT_TRANSFER_CONFIG,
    ...transferConfig,
  };

  const extractMetadataFromFilename = (filename: string): Record<string, string> => {
    if (extractMetadata) {
      return extractMetadata(filename) as Record<string, string>;
    }

    const metadata: Record<string, string> = {
      originalName: filename,
    };

    if (finalConfig.metadataPatterns) {
      for (const pattern of finalConfig.metadataPatterns) {
        const match = filename.match(pattern.pattern);
        if (match?.groups) {
          metadata._pattern = pattern.name;
          for (const field of pattern.fields) {
            const value = match.groups[field];
            if (value !== undefined) {
              metadata[field] = value;
            }
          }
          break;
        }
      }
    }

    const ext = filename.split('.').pop() || '';
    metadata.extension = ext.toLowerCase();

    return metadata;
  };

  const handleFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter((file) =>
      acceptedFileTypes.some((type) => {
        if (type.endsWith('/*')) {
          const baseType = type.split('/')[0];
          return file.type.startsWith(baseType + '/');
        }
        return file.type === type;
      })
    );

    if (validFiles.length === 0) return;

    const limitedFiles = validFiles.slice(0, maxFiles - items.length);
    const newItems: TransferItem[] = limitedFiles.map((file, index) => {
      const filename = file.name;
      const slug = createSlug
        ? createSlug(filename, items.length + index)
        : filename.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');

      const metadata = extractMetadataFromFilename(filename);

      return {
        id: crypto.randomUUID(),
        file,
        state: 'queued',
        progress: 0,
        bytesTransferred: 0,
        totalBytes: file.size,
        metadata,
        slug,
        startTime: Date.now(),
      };
    });

    setItems((prev) => [...prev, ...newItems]);
  };

  const processFile = async (item: TransferItem): Promise<void> => {
    const controller = new AbortController();
    processingRef.current.set(item.id, controller);

    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, state: 'processing' as const } : i))
    );

    try {
      const chunks: Uint8Array[] = [];
      const reader = item.file.stream().getReader();
      let bytesRead = 0;

      while (true) {
        if (controller.signal.aborted) {
          throw new Error('Cancelled');
        }

        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        bytesRead += value.length;

        const progress = (bytesRead / item.totalBytes) * 100;
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  bytesTransferred: bytesRead,
                  progress: Math.min(progress, 100),
                }
              : i
          )
        );

        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                state: 'completed' as const,
                progress: 100,
                bytesTransferred: item.totalBytes,
                endTime: Date.now(),
              }
            : i
        )
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'Cancelled') {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  state: 'cancelled' as const,
                  error: 'Cancelled by user',
                  endTime: Date.now(),
                }
              : i
          )
        );
      } else {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  state: 'failed' as const,
                  error: error instanceof Error ? error.message : 'Upload failed',
                  endTime: Date.now(),
                }
              : i
          )
        );
      }
    } finally {
      processingRef.current.delete(item.id);
    }
  };

  const handleUpload = async () => {
    const queuedItems = items.filter((i) => i.state === 'queued');

    for (let i = 0; i < queuedItems.length; i += finalConfig.concurrency) {
      const batch = queuedItems.slice(i, i + finalConfig.concurrency);
      await Promise.all(batch.map(processFile));
    }

    const completedItems = items.filter((i) => i.state === 'completed');
    if (completedItems.length > 0 && onItemsCreated) {
      await onItemsCreated(completedItems);
    }

    await props.onAction();
  };

  const pauseItem = (id: string) => {
    const controller = processingRef.current.get(id);
    if (controller) {
      controller.abort();
    }
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, state: 'paused' as const } : i))
    );
  };

  const resumeItem = (id: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, state: 'queued' as const } : i))
    );
  };

  const cancelItem = (id: string) => {
    const controller = processingRef.current.get(id);
    if (controller) {
      controller.abort();
    }
  };

  const removeItem = (id: string) => {
    cancelItem(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const clearAll = () => {
    items.forEach((item) => cancelItem(item.id));
    setItems([]);
  };

  const stats = {
    total: items.length,
    queued: items.filter((i) => i.state === 'queued').length,
    processing: items.filter((i) => i.state === 'processing').length,
    paused: items.filter((i) => i.state === 'paused').length,
    completed: items.filter((i) => i.state === 'completed').length,
    failed: items.filter((i) => i.state === 'failed').length,
    cancelled: items.filter((i) => i.state === 'cancelled').length,
    bytesTransferred: items.reduce((sum, i) => sum + i.bytesTransferred, 0),
    totalBytes: items.reduce((sum, i) => sum + i.totalBytes, 0),
  };

  return (
    <>
      <ActionButton onPress={() => setIsOpen(true)}>
        {/* <Icon src={uploadCloudIcon} /> */}
        <Text>Bulk Upload</Text>
      </ActionButton>

      <DialogContainer onDismiss={() => setIsOpen(false)}>
        {isOpen && (
          <Dialog size="large">
            <Heading>Bulk Upload Files</Heading>
            <Content>
              <VStack gap="large">
                <div
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    handleFiles(e.dataTransfer.files);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  style={{
                    border: isDragging ? '2px dashed #0066cc' : '2px dashed #ccc',
                    borderRadius: '8px',
                    padding: '32px',
                    textAlign: 'center',
                    backgroundColor: isDragging ? '#f0f8ff' : 'transparent',
                    transition: 'all 0.2s',
                  }}
                >
                  <VStack gap="medium" alignItems="center">
                    <Icon src={uploadCloudIcon} size="large" />
                    <Text weight="medium">
                      {isDragging ? 'Drop files here' : 'Drag and drop files here'}
                    </Text>
                    <Text size="small" color="neutralSecondary">
                      Max {maxFiles} files • {finalConfig.chunkSize / (1024 * 1024)}MB chunks
                    </Text>
                  </VStack>
                </div>

                {stats.total > 0 && (
                  <VStack gap="small">
                    <Flex direction="row" gap="medium" justifyContent="space-between">
                      <Text size="small">
                        Total: <strong>{stats.total}</strong> | Queued:{' '}
                        <strong>{stats.queued}</strong> | Processing:{' '}
                        <strong>{stats.processing}</strong> | Completed:{' '}
                        <strong>{stats.completed}</strong> | Failed:{' '}
                        <strong>{stats.failed}</strong>
                      </Text>
                      <Button prominence="low" onPress={clearAll}>
                        Clear All
                      </Button>
                    </Flex>
                    <ProgressBar
                      value={(stats.bytesTransferred / stats.totalBytes) * 100}
                      aria-label="Overall progress"
                    />
                    <Text size="small" color="neutralSecondary">
                      {(stats.bytesTransferred / (1024 * 1024)).toFixed(2)}MB /{' '}
                      {(stats.totalBytes / (1024 * 1024)).toFixed(2)}MB
                    </Text>
                  </VStack>
                )}

                {items.length > 0 && (
                  <ListView
                    aria-label="Upload queue"
                    items={items}
                    maxHeight="scale.3000"
                    overflowMode="truncate"
                  >
                    {(item: TransferItem) => (
                      <Item key={item.id} textValue={item.file.name}>
                        <VStack gap="small" flex={1}>
                          <Flex direction="row" gap="medium" alignItems="center">
                            <Icon
                              src={
                                item.state === 'completed'
                                  ? checkCircleIcon
                                  : item.state === 'failed'
                                    ? alertCircleIcon
                                    : item.state === 'processing'
                                      ? playCircleIcon
                                      : item.state === 'paused'
                                        ? pauseCircleIcon
                                        : uploadCloudIcon
                              }
                              color={
                                item.state === 'completed'
                                  ? 'positive'
                                  : item.state === 'failed'
                                    ? 'critical'
                                    : 'neutral'
                              }
                            />
                            <VStack flex={1} gap="xsmall">
                              <Text>{item.file.name}</Text>
                              <Text size="small" color="neutralSecondary">
                                Slug: {item.slug} •{' '}
                                {(item.totalBytes / (1024 * 1024)).toFixed(2)}MB
                              </Text>
                            </VStack>
                            <ActionGroup
                              density="compact"
                              onAction={(key) => {
                                if (key === 'pause') pauseItem(item.id);
                                if (key === 'resume') resumeItem(item.id);
                                if (key === 'cancel') cancelItem(item.id);
                                if (key === 'remove') removeItem(item.id);
                              }}
                            >
                              {item.state === 'processing' && (
                                <ActionItem key="pause" textValue="Pause">
                                  <Icon src={pauseCircleIcon} />
                                  <Text>Pause</Text>
                                </ActionItem>
                              )}
                              {item.state === 'paused' && (
                                <ActionItem key="resume" textValue="Resume">
                                  <Icon src={playCircleIcon} />
                                  <Text>Resume</Text>
                                </ActionItem>
                              )}
                              {(item.state === 'queued' || item.state === 'processing') && (
                                <ActionItem key="cancel" textValue="Cancel">
                                  <Icon src={xIcon} />
                                  <Text>Cancel</Text>
                                </ActionItem>
                              )}
                              <ActionItem key="remove" textValue="Remove">
                                <Icon src={xIcon} />
                                <Text>Remove</Text>
                              </ActionItem>
                            </ActionGroup>
                          </Flex>
                          {(item.state === 'processing' || item.state === 'paused') && (
                            <ProgressBar value={item.progress} aria-label="File progress" />
                          )}
                          {item.error && (
                            <Text size="small" color="critical">
                              {item.error}
                            </Text>
                          )}
                        </VStack>
                      </Item>
                    )}
                  </ListView>
                )}
              </VStack>
            </Content>
            <Footer>
              <ButtonGroup>
                <Button onPress={() => setIsOpen(false)}>Cancel</Button>
                <Button
                  prominence="high"
                  isDisabled={items.length === 0 || stats.queued === 0}
                  onPress={handleUpload}
                >
                  Upload {stats.queued > 0 && `(${stats.queued})`}
                </Button>
              </ButtonGroup>
            </Footer>
          </Dialog>
        )}
      </DialogContainer>
    </>
  );
}

export function createBulkUploadWithTransferAction(
  config?: BulkUploadWithTransferConfig
): CollectionAction {
  return {
    key: 'bulk-upload-transfer',
    label: 'Bulk Upload',
    icon: uploadCloudIcon,
    description: 'Upload multiple files with progress tracking and pause/resume',
    component: (props) => <BulkUploadWithTransferEngineComponent {...props} config={config} />,
    handler: async (context) => {
      return { success: true };
    },
  };
}
