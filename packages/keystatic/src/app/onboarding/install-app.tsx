import { useLocalizedStringFormatter } from '@react-aria/i18n';
import { interpolateMessage } from '../l10n/interpolate';
import { ActionButton, Button } from '@keystar/ui/button';
import { Flex } from '@keystar/ui/layout';
import { Notice } from '@keystar/ui/notice';
import { TextField } from '@keystar/ui/text-field';
import { Text } from '@keystar/ui/typography';
import { useRouter } from '../router';
import { GitHubConfig } from '../../config';
import { createContext, useContext } from 'react';
import { parseRepoConfig } from '../repo-config';
import l10nMessages from '../l10n';

export const AppSlugContext = createContext<
  { envName: string; value: string | undefined } | undefined
>(undefined);

export const AppSlugProvider = AppSlugContext.Provider;

export function InstallGitHubApp(props: { config: GitHubConfig }) {
  const stringFormatter = useLocalizedStringFormatter(l10nMessages);
  const router = useRouter();
  const appSlugFromContext = useContext(AppSlugContext);
  const appSlug =
    new URL(router.href, 'https://example.com').searchParams.get('slug') ??
    appSlugFromContext?.value;
  const parsedRepo = parseRepoConfig(props.config.storage.repo);
  return (
    <Flex direction="column" gap="regular">
      <Flex alignItems="end" gap="regular">
        <TextField
          label={stringFormatter.format('installGitHubAppRepoLabel')}
          width="100%"
          isReadOnly
          value={parsedRepo.name}
        />
        <ActionButton
          onPress={() => {
            navigator.clipboard.writeText(parsedRepo.name);
          }}
        >
          {stringFormatter.format('installGitHubAppCopyLabel')}
        </ActionButton>
      </Flex>
      {appSlug ? (
        <Button
          prominence="high"
          href={`https://github.com/apps/${appSlug}/installations/new`}
        >
          {stringFormatter.format('installGitHubAppButtonLabel')}
        </Button>
      ) : (
        <Notice tone="caution">
          {appSlugFromContext ? (
            <Text>
              {interpolateMessage(
                stringFormatter.format('installGitHubAppMissingSlug'),
                { envName: <code>{appSlugFromContext.envName}</code> }
              )}
            </Text>
          ) : (
            <Text>
              {stringFormatter.format('installGitHubAppGenericWarning')}
            </Text>
          )}
        </Notice>
      )}
    </Flex>
  );
}
