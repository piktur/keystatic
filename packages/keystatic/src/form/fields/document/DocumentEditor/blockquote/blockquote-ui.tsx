import { useMemo } from 'react';
import { Editor, Transforms } from 'slate';
import { ReactEditor, RenderElementProps } from 'slate-react';

import { ActionButton } from '@keystar/ui/button';
import { quoteIcon } from '@keystar/ui/icon/icons/quoteIcon';
import { Icon } from '@keystar/ui/icon';
import { TooltipTrigger, Tooltip } from '@keystar/ui/tooltip';
import { Kbd, Text } from '@keystar/ui/typography';
import { useLocalizedStringFormatter } from '@react-aria/i18n';
import l10nMessages from '#l10n';

import { useToolbarState } from '../toolbar-state';
import { isElementActive } from '../utils';

export const insertBlockquote = (editor: Editor) => {
  const isActive = isElementActive(editor, 'blockquote');
  if (isActive) {
    Transforms.unwrapNodes(editor, {
      match: node => node.type === 'blockquote',
    });
  } else {
    Transforms.wrapNodes(editor, {
      type: 'blockquote',
      children: [],
    });
  }
};

export const BlockquoteElement = ({
  attributes,
  children,
}: RenderElementProps) => {
  return <blockquote {...attributes}>{children}</blockquote>;
};

const BlockquoteButton = () => {
  const {
    editor,
    blockquote: { isDisabled, isSelected },
  } = useToolbarState();
  return useMemo(
    () => (
      <ActionButton
        prominence="low"
        isSelected={isSelected}
        isDisabled={isDisabled}
        onPress={() => {
          insertBlockquote(editor);
          ReactEditor.focus(editor);
        }}
      >
        <Icon src={quoteIcon} />
      </ActionButton>
    ),
    [editor, isDisabled, isSelected]
  );
};
function BlockquoteButtonWithTooltip() {
  const stringFormatter = useLocalizedStringFormatter(l10nMessages);
  return (
    <TooltipTrigger>
      <BlockquoteButton />
      <Tooltip>
        <Text>{stringFormatter.format('quote')}</Text>
        <Kbd>{'>⎵'}</Kbd>
      </Tooltip>
    </TooltipTrigger>
  );
}

export const blockquoteButton = <BlockquoteButtonWithTooltip />;
