import { useState, useCallback } from 'react';
import { useLocalizedStringFormatter } from '@react-aria/i18n';
import { FormFieldInputProps, FormFieldStoredValue } from '../../api';
import { TextField } from '@keystar/ui/text-field';
import { Button } from '@keystar/ui/button';
import { Icon } from '@keystar/ui/icon';
import { playIcon } from '@keystar/ui/icon/icons/playIcon';
import { VStack } from '@keystar/ui/layout';
import { Text } from '@keystar/ui/typography';
import { ProgressCircle } from '@keystar/ui/progress';
import localizedMessages from '#l10n';

export function Executor(
  props: FormFieldInputProps<{ value: FormFieldStoredValue }> & {
    label: string;
    description?: string;
    command: (input: string) => Promise<{ response: string; success: boolean }>;
  }
) {
  const stringFormatter = useLocalizedStringFormatter(localizedMessages);
  const [input, setInput] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleInvoke = useCallback(async () => {
    if (!input.trim()) return;

    setIsLoading(true);
    try {
      const result = await props.command(input);
      setResponse(result.response);
      props.onChange({ value: result.success });
    } catch (error) {
      setResponse(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      props.onChange({ value: false });
    } finally {
      setIsLoading(false);
    }
  }, [input, props]);

  return (
    <VStack gap="medium">
      <TextField
        label={props.label}
        description={props.description}
        value={input}
        onChange={setInput}
        autoFocus={props.autoFocus}
      />
      <Button onPress={handleInvoke} isDisabled={!input.trim() || isLoading}>
        <Icon src={playIcon} />
        <Text>{isLoading ? 'Processing...' : 'Execute'}</Text>
      </Button>

      {isLoading && (
        <ProgressCircle
          isIndeterminate
          aria-label={stringFormatter.format('processing')}
        />
      )}

      {response && (
        <VStack gap="small">
          <Text weight="semibold">Response:</Text>
          <Text>{response}</Text>
          <Text color={props.value ? 'positive' : 'critical'}>
            Status: {props.value ? 'Success' : 'Failed'}
          </Text>
        </VStack>
      )}
    </VStack>
  );
}
