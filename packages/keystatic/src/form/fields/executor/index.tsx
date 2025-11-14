import { Executor } from '#field-ui/executor';
import { BasicFormField, FormFieldStoredValue } from '../../api';
import { basicFormFieldWithSimpleReaderParse } from '../utils';

export function executor({
  label,
  description,
  command,
}: {
  label: string;
  description?: string;
  command: (input: string) => Promise<{ response: string; success: boolean }>;
}): BasicFormField<
  { value: FormFieldStoredValue },
  { value: FormFieldStoredValue },
  unknown
> {
  return basicFormFieldWithSimpleReaderParse({
    label,
    Input(props) {
      return (
        <Executor
          {...props}
          label={label}
          description={description}
          command={command}
        />
      );
    },
    defaultValue() {
      return { value: undefined };
    },
    parse(value) {
      return { value };
    },
    validate(value) {
      return value;
    },
    serialize(value) {
      return value;
    },
  });
}
