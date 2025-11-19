import { DialogContainer, Dialog } from '@keystar/ui/dialog';
import { Content, Footer } from '@keystar/ui/slots';
import { Button, ButtonGroup } from '@keystar/ui/button';
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
import { useState, useEffect } from 'react';
import type { CollectionAction, ActionContext } from '../../config';

export interface BulkUploadConfig {
  acceptedFileTypes?: string[];
  maxFiles?: number;
  directory?: string;
  extractMetadata?: (filename: string) => Record<string, any>;
  createSlug?: (filename: string, index: number) => string;
}

interface UploadItem {
  id: string;
  file: File;
  filename: string;
  state: 'queued' | 'processing' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  error?: string;
  slug?: string;
  metadata?: Record<string, any>;
}

export function BulkUploadActionComponent(props: {
  context: ActionContext<any>;
  onAction: () => Promise<void>;
  config?: BulkUploadConfig;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const { config = {} } = props;
  const {
    acceptedFileTypes = ['image/*', 'video/*'],
    maxFiles = 50,
    extractMetadata,
    createSlug,
  } = config;

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

    const limitedFiles = validFiles.slice(0, maxFiles);
    const newItems: UploadItem[] = limitedFiles.map((file, index) => {
      const filename = file.name;
      const slug = createSlug
        ? createSlug(filename, index)
        : filename.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');

      return {
        id: crypto.randomUUID(),
        file,
        filename,
        state: 'queued',
        progress: 0,
        slug,
        metadata: extractMetadata ? extractMetadata(filename) : {},
      };
    });

    setItems((prev) => [...prev, ...newItems]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    handleFiles(files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      handleFiles(files);
    }
  };

  const handleUpload = async () => {
    for (const item of items.filter((i) => i.state === 'queued')) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, state: 'processing' as const } : i))
      );

      try {
        const reader = new FileReader();
        const fileData = await new Promise<Uint8Array>((resolve, reject) => {
          reader.onload = () => {
            const arrayBuffer = reader.result as ArrayBuffer;
            resolve(new Uint8Array(arrayBuffer));
          };
          reader.onerror = reject;
          reader.readAsArrayBuffer(item.file);
        });

        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, state: 'completed' as const, progress: 100 }
              : i
          )
        );
      } catch (error) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  state: 'failed' as const,
                  error: error instanceof Error ? error.message : 'Upload failed',
                }
              : i
          )
        );
      }
    }

    await props.onAction();
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const clearAll = () => {
    setItems([]);
  };

  const stats = {
    total: items.length,
    queued: items.filter((i) => i.state === 'queued').length,
    processing: items.filter((i) => i.state === 'processing').length,
    completed: items.filter((i) => i.state === 'completed').length,
    failed: items.filter((i) => i.state === 'failed').length,
  };

  return (
    <>
      <Button onPress={() => setIsOpen(true)}>
        {/* <Icon src={uploadCloudIcon} /> */}
        <Text>Bulk Upload</Text>
      </Button>

      <DialogContainer onDismiss={() => setIsOpen(false)}>
        {isOpen && (
          <Dialog size="large">
            <Heading>Bulk Upload Files</Heading>
            <Content>
              <VStack gap="large">
                <div
                  onDrop={handleDrop}
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
                  <Icon src={uploadCloudIcon} size="large" />
                  <Text weight="medium">
                    {isDragging ? 'Drop files here' : 'Drag and drop files here'}
                  </Text>
                  <Text size="small" color="neutralSecondary">
                    or
                  </Text>
                  <label>
                    <input
                      type="file"
                      multiple
                      accept={acceptedFileTypes.join(',')}
                      onChange={handleFileInput}
                      style={{ display: 'none' }}
                    />
                    <Button onPress={() => {
                      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
                      input?.click();
                    }}>
                      Browse Files
                    </Button>
                  </label>
                  <Text size="small" color="neutralSecondary">
                    Max {maxFiles} files
                  </Text>
                </div>

                {stats.total > 0 && (
                  <Flex direction="row" gap="medium" justifyContent="space-between">
                    <Text>
                      Total: {stats.total} | Queued: {stats.queued} | Processing:{' '}
                      {stats.processing} | Completed: {stats.completed} | Failed: {stats.failed}
                    </Text>
                    <Button prominence="low" onPress={clearAll}>
                      Clear All
                    </Button>
                  </Flex>
                )}

                {items.length > 0 && (
                  <ListView
                    aria-label="Upload queue"
                    items={items}
                    maxHeight="scale.3000"
                    overflowMode="truncate"
                  >
                    {(item: UploadItem) => (
                      <Item key={item.id} textValue={item.filename}>
                        <Flex direction="row" gap="medium" alignItems="center" flex={1}>
                          <Icon
                            src={
                              item.state === 'completed'
                                ? checkCircleIcon
                                : item.state === 'failed'
                                  ? alertCircleIcon
                                  : item.state === 'processing'
                                    ? playCircleIcon
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
                          <VStack flex={1} gap="small">
                            <Text>{item.filename}</Text>
                            <Text size="small" color="neutralSecondary">
                              Slug: {item.slug}
                            </Text>
                            {item.state === 'processing' && (
                              <ProgressBar value={item.progress} aria-label="Upload progress" />
                            )}
                            {item.error && (
                              <Text size="small" color="critical">
                                {item.error}
                              </Text>
                            )}
                          </VStack>
                          <ActionGroup
                            density="compact"
                            onAction={(key) => {
                              if (key === 'remove') {
                                removeItem(item.id);
                              }
                            }}
                          >
                            <ActionItem key="remove" textValue="Remove">
                              <Icon src={xIcon} />
                              <Text>Remove</Text>
                            </ActionItem>
                          </ActionGroup>
                        </Flex>
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

export function createBulkUploadAction(config?: BulkUploadConfig): CollectionAction {
  return {
    key: 'bulk-upload',
    label: 'Bulk Upload',
    icon: uploadCloudIcon,
    description: 'Upload multiple files at once',
    component: (props) => <BulkUploadActionComponent {...props} config={config} />,
    handler: async (context) => {
      return { success: true };
    },
  };
}
