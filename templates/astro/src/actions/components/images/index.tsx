import type { CollectionAction } from '@keystatic/core';
// import { uploadCloudIcon } from '@keystar/ui/icon/icons/uploadCloudIcon';

export const key = 'images';
export const label = 'Bulk Upload';
// export const icon = uploadCloudIcon;
export const description = 'Upload multiple images at once with progress tracking';

export const handler: CollectionAction['handler'] = async (context) => {
  return {
    success: true,
    message: 'Bulk upload dialog will appear when you click the button',
  };
};

export const component: CollectionAction['component'] = ({ context, onAction }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [files, setFiles] = React.useState<File[]>([]);

  return (
    <>
      <ActionButton onPress={() => setIsOpen(true)}>
        <Icon src={uploadCloudIcon} />
        <Text>Bulk Upload Images</Text>
      </ActionButton>
    </>
  );
};

export const condition: CollectionAction['condition'] = () => {
  return true;
};
