import { useState, FormEvent, useMemo, useCallback } from 'react';
import { useLocalizedStringFormatter } from '@react-aria/i18n';
import l10nMessages from '#l10n';
import { KeystarProvider } from '@keystar/ui/core';
import { ActionButton, Button, ButtonGroup } from '@keystar/ui/button';
import {  Flex } from '@keystar/ui/layout';
import { Notice } from '@keystar/ui/notice';
import { ProgressCircle } from '@keystar/ui/progress';
import { Heading } from '@keystar/ui/typography';
import { printerIcon } from '@keystar/ui/icon/icons/printerIcon';
import { sunIcon } from '@keystar/ui/icon/icons/sunIcon';
import { moonIcon } from '@keystar/ui/icon/icons/moonIcon';
import { monitorIcon } from '@keystar/ui/icon/icons/monitorIcon';
import { globeIcon } from '@keystar/ui/icon/icons/globeIcon';
import { moreHorizontalIcon } from '@keystar/ui/icon/icons/moreHorizontalIcon';
import { Menu, MenuTrigger, Item, Section } from '@keystar/ui/menu';
import { useMediaQuery } from '@keystar/ui/style';
import { Config } from '../config';
import { fields } from '../form/api';
import { createGetPreviewProps } from '../form/preview-props';
import { FormValueContentFromPreviewProps } from '../form/form-from-preview';
import { serializeProps } from '../form/serialize-props';
import { getInitialPropsValue } from '../form/initial-values';
import { ConfigContext } from './shell/context';
import { serializeEntryToFiles } from './updating';
import { getCollectionFormat } from './path-utils';
import { Icon } from '@keystar/ui/icon';
import { Text } from '@keystar/ui/typography';
import { PageRoot, PageContainer } from './shell/page';
import { Box } from '@keystar/ui/layout';
import { ScrollView } from './shell/primitives';
import { SplitView, SplitPanePrimary, SplitPaneSecondary } from '@keystar/ui/split-view';
import { useTheme, useThemeContext, ThemeProvider } from './shell/theme';
import { locales } from './l10n/locales';

// Polyfill for crypto.randomUUID
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback UUID v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export type SerializedFormData = {
  data: Record<string, unknown>;
  files: Array<{
    path: string;
    contents: Uint8Array;
    parent?: string;
  }>;
  serializedFiles: Array<{
    path: string;
    contents: Uint8Array;
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

const THEME_OPTIONS = [
  { key: 'light', icon: sunIcon, labelKey: 'themeLight' },
  { key: 'dark', icon: moonIcon, labelKey: 'themeDark' },
  { key: 'auto', icon: monitorIcon, labelKey: 'themeSystem' },
] as const;

const SUPPORTED_LOCALES = ['en-US', 'zh-CN'] as const;

function ThemeMenu() {
  const stringFormatter = useLocalizedStringFormatter(l10nMessages);
  const { theme, setTheme } = useThemeContext();
  const matchesDark = useMediaQuery('(prefers-color-scheme: dark)');

  const themeItems = useMemo(
    () =>
      THEME_OPTIONS.map(option => ({
        key: option.key,
        icon: option.icon,
        label: stringFormatter.format(option.labelKey),
      })),
    [stringFormatter]
  );

  const current =
    themeItems.find(option => option.key === theme) ?? themeItems[0];

  let icon = current.icon;
  if (theme === 'auto') {
    icon = matchesDark ? moonIcon : sunIcon;
  }

  return (
    <MenuTrigger align="end">
      <ActionButton
        aria-label={stringFormatter.format('appearance')}
        prominence="low"
      >
        <Icon src={icon} />
      </ActionButton>
      <Menu
        aria-label={stringFormatter.format('appearance')}
        selectedKeys={[theme]}
        onAction={key => setTheme(key as any)}
        selectionMode="single"
      >
        {themeItems.map(item => (
          <Item key={item.key} textValue={item.label}>
            <Icon src={item.icon} />
            <Text>{item.label}</Text>
          </Item>
        ))}
      </Menu>
    </MenuTrigger>
  );
}

function LocaleMenu() {
  const stringFormatter = useLocalizedStringFormatter(l10nMessages);

  const localeItems = useMemo(() => {
    return SUPPORTED_LOCALES.map(key => {
      const label = locales[key] ?? key;
      return {
        key,
        label: label.replace(/\s*\([^)]*\)\s*.*$/, ''),
      };
    });
  }, []);

  const handleLocaleChange = useCallback((key: string | number) => {
    const next = String(key);
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('locale', next);
      window.location.replace(url.toString());
    } catch {}
  }, []);

  return (
    <MenuTrigger align="end">
      <ActionButton
        aria-label={stringFormatter.format('preferences')}
        prominence="low"
      >
        <Icon src={moreHorizontalIcon} />
      </ActionButton>
      <Menu
        aria-label={stringFormatter.format('preferences')}
        onAction={handleLocaleChange}
      >
        <Section
          aria-label={stringFormatter.format('language')}
          items={localeItems}
        >
          {item => (
            <Item key={item.key} textValue={item.label}>
              <Icon src={globeIcon} />
              <Text>{item.label}</Text>
            </Item>
          )}
        </Section>
      </Menu>
    </MenuTrigger>
  );
}


function KeystaticFormInner({
  config,
  collectionKey,
  onSubmit,
}: KeystaticFormProps) {
  const stringFormatter = useLocalizedStringFormatter(l10nMessages);
  const collectionConfig = config.collections![collectionKey];

  if (!collectionConfig) {
    throw new Error(`Collection "${collectionKey}" not found in config`);
  }

  const schema = { kind: 'object' as const, fields: collectionConfig.schema };

  const [state, setState] = useState(() =>
    getInitialPropsValue(schema)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const previewProps = createGetPreviewProps(
    schema,
    setState,
    () => undefined
  )(state);

  const serializedPreview = useMemo(() => {
    try {
      const { value } = serializeProps(
        state,
        fields.object(collectionConfig.schema),
        undefined,
        undefined,
        true
      );
      return JSON.stringify(value, null, 2);
    } catch (err) {
      return `Error serializing: ${err instanceof Error ? err.message : String(err)}`;
    }
  }, [state, collectionConfig.schema]);

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

      // Serialize to actual file format (YAML/JSON + markdown)
      const formatInfo = getCollectionFormat(config, collectionKey);
      const timestamp = Date.now();
      const submissionId = generateUUID();
      const basePath = `submissions/${collectionKey}/${timestamp}-${submissionId}`;

      const serializedFiles = serializeEntryToFiles({
        basePath,
        schema: collectionConfig.schema,
        format: formatInfo,
        state,
        slug: collectionConfig.slugField
          ? {
              field: collectionConfig.slugField,
              value: (state as any)[collectionConfig.slugField] || submissionId
            }
          : undefined
      });

      await onSubmit({
        data: value as Record<string, unknown>,
        files: extraFiles,
        serializedFiles
      });
      setSuccess(true);

      // Reset form
      setState(getInitialPropsValue(schema));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ConfigContext.Provider value={config}>
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

          * {
            background: none !important;
            background-color: transparent !important;
          }
        }
      `}</style>
      <PageRoot containerWidth="medium">
        <Flex direction="column" backgroundColor="canvas" height="100vh">
        <Box borderBottom="muted" elementType="header" flexShrink={0} UNSAFE_className="print-hide">
          <Flex
            alignItems="center"
            gap={{ mobile: 'small', tablet: 'regular' }}
            height={{ mobile: 'element.large', tablet: 'element.xlarge' }}
            paddingX={{ mobile: 'medium', tablet: 'xlarge', desktop: 'xxlarge' }}
          >
            <Flex flex alignItems="center" gap="regular">
              {collectionConfig.label && (
                <Heading size="small">{collectionConfig.label}</Heading>
              )}
            </Flex>
            <ThemeMenu />
            <LocaleMenu />
          </Flex>
        </Box>
        <SplitView
          autoSaveId="keystatic-form-preview-split"
          defaultSize={400}
          minSize={300}
          maxSize={600}
          flex
        >
          <SplitPaneSecondary>
            <ScrollView>
              <PageContainer paddingY={{ mobile: 'medium', tablet: 'xlarge', desktop: 'xxlarge' }}>
                <Flex direction="column" gap="large">
                  {error && (
                    <div className="print-hide">
                      <Notice tone="critical">{error}</Notice>
                    </div>
                  )}

                  {success && (
                    <div className="print-hide">
                      <Notice tone="positive">{stringFormatter.format('formSubmittedSuccessfully')}</Notice>
                    </div>
                  )}

                  <form onSubmit={handleSubmit}>
                  <Flex direction="column" gap="large">
                    <FormValueContentFromPreviewProps {...previewProps} />

                    <Box
                      borderTop="emphasis"
                      paddingTop="xlarge"
                      marginTop="xlarge"
                      UNSAFE_className="print-hide"
                    >
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
                                aria-label={stringFormatter.format('submitting')}
                              />
                              <Text>{stringFormatter.format('submittingEllipsis')}</Text>
                            </>
                          ) : <Text>{stringFormatter.format('submit')}</Text>
}
                        </Button>
                        <Button
                          onPress={() => window.print()}
                          isDisabled={isSubmitting}
                        >
                          <Icon src={printerIcon} />
                          <Text>{stringFormatter.format('print')}</Text>
                        </Button>
                      </ButtonGroup>
                    </Box>
                  </Flex>
                </form>
                </Flex>
              </PageContainer>
            </ScrollView>
          </SplitPaneSecondary>
          <SplitPanePrimary UNSAFE_className="print-hide">
            <ScrollView>
              <Box padding={{ mobile: 'medium', tablet: 'xlarge', desktop: 'xxlarge' }}>
                <Flex direction="column" gap="medium">
                  <Heading size="small">JSON Preview</Heading>
                  <Box
                    backgroundColor="surface"
                    padding="medium"
                    borderRadius="medium"
                    UNSAFE_style={{
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      overflow: 'auto',
                      maxHeight: '80vh'
                    }}
                  >
                    {serializedPreview}
                  </Box>
                </Flex>
              </Box>
            </ScrollView>
          </SplitPanePrimary>
        </SplitView>
        </Flex>
      </PageRoot>
    </ConfigContext.Provider>
  );
}

export function KeystaticForm(props: KeystaticFormProps) {
  const themeState = useTheme();

  return (
    <ThemeProvider value={themeState}>
      <KeystarProvider locale={props.locale || props.config?.locale || 'en-US'} colorScheme={themeState.theme}>
        <KeystaticFormInner {...props} />
      </KeystarProvider>
    </ThemeProvider>
  );
}
