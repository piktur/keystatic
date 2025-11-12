import { useLocalizedStringFormatter } from '@react-aria/i18n';
import { interpolateMessage } from '../l10n/interpolate';
import { Flex } from '@keystar/ui/layout';
import { Heading, Text } from '@keystar/ui/typography';
import { GitHubConfig } from '../..';
import { InstallGitHubApp } from './install-app';
import { serializeRepoConfig } from '../repo-config';
import l10nMessages from '../l10n';

export function CreatedGitHubApp(props: { config: GitHubConfig }) {
  const stringFormatter = useLocalizedStringFormatter(l10nMessages);
  return (
    <Flex alignItems="center" justifyContent="center" margin="xxlarge">
      <Flex
        backgroundColor="surface"
        padding="large"
        border="color.alias.borderIdle"
        borderRadius="medium"
        direction="column"
        justifyContent="center"
        gap="xlarge"
        maxWidth="scale.4600"
      >
        <Heading>
          {stringFormatter.format('createdGitHubAppHeading')}
        </Heading>
        <Text>{stringFormatter.format('createdGitHubAppDescription')}</Text>
        <Text>
          {interpolateMessage(
            stringFormatter.format('createdGitHubAppRepo'),
            { repo: <code>{serializeRepoConfig(props.config.storage.repo)}</code> }
          )}
        </Text>
        <InstallGitHubApp config={props.config} />
      </Flex>
    </Flex>
  );
}
