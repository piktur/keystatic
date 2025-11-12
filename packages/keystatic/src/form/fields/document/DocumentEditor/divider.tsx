import { useMemo } from 'react';
import { Editor } from 'slate';
import { RenderElementProps, useSelected } from 'slate-react';

import { ActionButton } from '@keystar/ui/button';
import { tokenSchema } from '@keystar/ui/style';
import { Tooltip, TooltipTrigger } from '@keystar/ui/tooltip';
import { Text, Kbd } from '@keystar/ui/typography';
import { useLocalizedStringFormatter } from '@react-aria/i18n';
import l10nMessages from '#l10n';

import { useToolbarState } from './toolbar-state';
import { insertNodesButReplaceIfSelectionIsAtEmptyParagraphOrHeading } from './ui-utils';
import { Icon } from '@keystar/ui/icon';
import { minusIcon } from '@keystar/ui/icon/icons/minusIcon';

export function insertDivider(editor: Editor) {
  insertNodesButReplaceIfSelectionIsAtEmptyParagraphOrHeading(editor, {
    type: 'divider',
    children: [{ text: '' }],
  });
  Editor.insertNode(editor, { type: 'paragraph', children: [{ text: '' }] });
}

const DividerButton = () => {
  const {
    editor,
    dividers: { isDisabled },
  } = useToolbarState();
  return useMemo(
    () => (
      <ActionButton
        prominence="low"
        isDisabled={isDisabled}
        onPress={() => {
          insertDivider(editor);
        }}
      >
        <Icon src={minusIcon} />
      </ActionButton>
    ),
    [editor, isDisabled]
  );
};

function DividerButtonWithTooltip() {
  const stringFormatter = useLocalizedStringFormatter(l10nMessages);
  return (
    <TooltipTrigger delay={200}>
      <DividerButton />
      <Tooltip>
        <Text>{stringFormatter.format('divider')}</Text>
        <Kbd>---</Kbd>
      </Tooltip>
    </TooltipTrigger>
  );
}

export const dividerButton = <DividerButtonWithTooltip />;

export function DividerElement({ attributes, children }: RenderElementProps) {
  const selected = useSelected();
  return (
    <div {...attributes} style={{ caretColor: 'transparent' }}>
      <hr
        style={{
          backgroundColor: selected
            ? tokenSchema.color.alias.borderSelected
            : tokenSchema.color.alias.borderIdle,
        }}
      />
      {children}
    </div>
  );
}
