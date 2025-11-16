import { useState, FormEvent } from 'react';
import { KeystarProvider } from '@keystar/ui/core';
import { Button, ButtonGroup } from '@keystar/ui/button';
import { Box, Flex } from '@keystar/ui/layout';
import { Notice } from '@keystar/ui/notice';
import { ProgressCircle } from '@keystar/ui/progress';
import { Heading } from '@keystar/ui/typography';
import { Config } from '../config';
import { fields } from '../form/api';
import { createGetPreviewProps } from '../form/preview-props';
import { FormValueContentFromPreviewProps } from '../form/form-from-preview';
import { serializeProps } from '../form/serialize-props';

export type SerializedFormData = {
  data: Record<string, unknown>;
  files: Array<{
    path: string;
    contents: Uint8Array;
    parent?: string;
  }>;
};

export type KeystaticFormProps = {
  config: Config;
  collectionKey: string;
  onSubmit: (data: SerializedFormData) => Promise<void>;
  locale?: string;
};

export function PrintPageBreak() {
  return <div className="print-page-break" aria-hidden="true" />;
}

export function KeystaticForm({
  config,
  collectionKey,
  onSubmit,
  locale,
}: KeystaticFormProps) {
  const collectionConfig = config.collections![collectionKey];

  if (!collectionConfig) {
    throw new Error(`Collection "${collectionKey}" not found in config`);
  }

  const schema = { kind: 'object' as const, fields: collectionConfig.schema };

  const [state, setState] = useState(() =>
    fields.object(collectionConfig.schema).defaultValue()
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const previewProps = createGetPreviewProps(
    schema,
    setState,
    () => undefined
  )(state);

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const { value, extraFiles } = serializeProps(
        state,
        fields.object(collectionConfig.schema),
        undefined,
        undefined,
        true
      );

      await onSubmit({ data: value, files: extraFiles });
      setSuccess(true);

      // Reset form
      setState(fields.object(collectionConfig.schema).defaultValue());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeystarProvider locale={locale || config.locale || 'en-US'}>
      <style>{`
        @media print {
          @page {
            margin: 1.5cm;
            size: A4;
          }
          
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          
          .print-hide {
            display: none !important;
          }
          
          .print-page-break {
            page-break-before: always;
            break-before: page;
          }
          
          .print-avoid-break {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}</style>
      <Box padding="large">
        <Flex direction="column" gap="large">
          {collectionConfig.label && (
            <Heading>{collectionConfig.label}</Heading>
          )}

          <div className="print-hide">
            {error && (
              <Notice tone="critical">{error}</Notice>
            )}

            {success && (
              <Notice tone="positive">Form submitted successfully!</Notice>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            <Flex direction="column" gap="large">
              <FormValueContentFromPreviewProps {...previewProps} />

              <div className="print-hide">
                <ButtonGroup>
                  <Button
                    type="submit"
                    prominence="high"
                    isDisabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <ProgressCircle
                          isIndeterminate
                          size="small"
                          aria-label="Submitting"
                        />
                        Submitting...
                      </>
                    ) : (
                      'Submit'
                    )}
                  </Button>
                  <Button
                    onPress={() => window.print()}
                    isDisabled={isSubmitting}
                  >
                    Print
                  </Button>
                </ButtonGroup>
              </div>
            </Flex>
          </form>
        </Flex>
      </Box>
    </KeystarProvider>
  );
}
