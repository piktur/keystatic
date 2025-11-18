import { Picker, Item } from '@keystar/ui/picker';
import { Combobox } from '@keystar/ui/combobox';
import { Item as ComboboxItem } from '@react-stately/collections';
import { useFieldSpan } from '../context';
import { useReducer, useMemo } from 'react';

export function SelectFieldInput<Value extends string>(props: {
  value: Value;
  onChange: (value: Value) => void;
  autoFocus?: boolean;
  label: string;
  description?: string;
  options: readonly { label: string; value: Value }[];
  combobox?: boolean;
}) {
  let fieldSpan = useFieldSpan();
  const [, onBlur] = useReducer(() => true, false);
  const items = useMemo(() => {
    return props.options.map(opt => ({ key: opt.value, label: opt.label }));
  }, [props.options]);

  if (props.combobox) {
    return (
      <Combobox
        label={props.label}
        description={props.description}
        selectedKey={props.value}
        onSelectionChange={key => {
          if (typeof key === 'string') {
            props.onChange(key as Value);
          }
        }}
        onBlur={onBlur}
        autoFocus={props.autoFocus}
        defaultItems={items}
        width="auto"
      >
        {item => <ComboboxItem key={item.key}>{item.label}</ComboboxItem>}
      </Combobox>
    );
  }

  return (
    <Picker
      label={props.label}
      description={props.description}
      items={props.options}
      selectedKey={props.value}
      onSelectionChange={key => {
        props.onChange(key as Value);
      }}
      autoFocus={props.autoFocus}
      width={{
        mobile: 'auto',
        tablet: fieldSpan === 12 ? 'alias.singleLineWidth' : 'auto',
      }}
    >
      {item => <Item key={item.value}>{item.label}</Item>}
    </Picker>
  );
}
