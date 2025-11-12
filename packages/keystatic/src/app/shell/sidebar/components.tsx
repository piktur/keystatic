import { useLocalizedStringFormatter } from '@react-aria/i18n';
import { PressProps } from '@react-aria/interactions';
import { Section, Item } from '@react-stately/collections';
import { gql } from '@ts-gql/tag/no-transform';
import {
  ForwardedRef,
  ReactElement,
  forwardRef,
  useMemo,
  useReducer,
} from 'react';
import { useMutation, useQuery } from 'urql';

import { Avatar } from '@keystar/ui/avatar';
import { ActionButton } from '@keystar/ui/button';
import { AlertDialog, DialogContainer } from '@keystar/ui/dialog';
import { Icon } from '@keystar/ui/icon';
import { moreHorizontalIcon } from '@keystar/ui/icon/icons/moreHorizontalIcon';
import { logOutIcon } from '@keystar/ui/icon/icons/logOutIcon';
import { gitPullRequestIcon } from '@keystar/ui/icon/icons/gitPullRequestIcon';
import { gitBranchPlusIcon } from '@keystar/ui/icon/icons/gitBranchPlusIcon';
import { githubIcon } from '@keystar/ui/icon/icons/githubIcon';
import { gitForkIcon } from '@keystar/ui/icon/icons/gitForkIcon';
import { imageIcon } from '@keystar/ui/icon/icons/imageIcon';
import { monitorIcon } from '@keystar/ui/icon/icons/monitorIcon';
import { moonIcon } from '@keystar/ui/icon/icons/moonIcon';
import { sunIcon } from '@keystar/ui/icon/icons/sunIcon';
import { trash2Icon } from '@keystar/ui/icon/icons/trash2Icon';
import { userIcon } from '@keystar/ui/icon/icons/userIcon';
import { Flex } from '@keystar/ui/layout';
import { ActionMenu, Menu, MenuTrigger } from '@keystar/ui/menu';
import { ClearSlots } from '@keystar/ui/slots';
import { css, useMediaQuery } from '@keystar/ui/style';
import { ColorScheme } from '@keystar/ui/types';
import { Text } from '@keystar/ui/typography';

import { CreateBranchDialog } from '../../branch-selection';
import { useRouter } from '../../router';
import l10nMessages from '../../l10n';
import {
  KEYSTATIC_CLOUD_API_URL,
  KEYSTATIC_CLOUD_HEADERS,
  getRepoUrl,
  isGitHubConfig,
  redirectToCloudAuth,
} from '../../utils';

import { useConfig } from '../context';
import {
  useBranches,
  useCloudInfo,
  useCurrentBranch,
  useRawCloudInfo,
  useRepoInfo,
} from '../data';
import { useViewer } from '../viewer-data';
import { useThemeContext } from '../theme';
import { locales as supportedLocales } from '../../l10n/locales';
import { useImageLibraryURL } from '../../../component-blocks/cloud-image-preview';
import { clearObjectCache } from '../../object-cache';
import { clearDrafts } from '../../persistence';
import { getCloudAuth } from '../../auth';

type MenuItem = {
  icon: ReactElement;
  label: string;
  description?: string;
  key: string;
  href?: string;
  target?: string;
  rel?: string;
};
type MenuSection = { key: string; label: string; children: MenuItem[] };

// Theme controls
// -----------------------------------------------------------------------------

const THEME_MODE = {
  light: { icon: sunIcon, label: 'Light' },
  dark: { icon: moonIcon, label: 'Dark' },
  auto: { icon: monitorIcon, label: 'System' },
} as const;
const themeItems = Object.entries(THEME_MODE).map(([id, { icon, label }]) => ({
  id,
  icon,
  label,
}));

export function ThemeMenu() {
  let { theme, setTheme } = useThemeContext();
  const stringFormatter = useLocalizedStringFormatter(l10nMessages);
  let matchesDark = useMediaQuery('(prefers-color-scheme: dark)');
  let icon = THEME_MODE[theme].icon;
  if (theme === 'auto') {
    icon = matchesDark ? moonIcon : sunIcon;
  }

  return (
    <MenuTrigger align="end">
      <ActionButton aria-label={stringFormatter.format('theme')} prominence="low">
        <Icon src={icon} />
      </ActionButton>
      <Menu
        items={themeItems}
        onSelectionChange={([key]) => setTheme(key as ColorScheme)}
        disallowEmptySelection
        selectedKeys={[theme]}
        selectionMode="single"
      >
        {item => (
          <Item textValue={item.label}>
            <Icon src={item.icon} />
            <Text>{item.label}</Text>
          </Item>
        )}
      </Menu>
    </MenuTrigger>
  );
}

// Preferences (Theme + Locale)
// -----------------------------------------------------------------------------

export function PreferencesMenu() {
  const { theme, setTheme } = useThemeContext();
  const matchesDark = useMediaQuery('(prefers-color-scheme: dark)');
  const stringFormatter = useLocalizedStringFormatter(l10nMessages);

  const themeIcon = (() => {
    if (theme === 'auto') return matchesDark ? moonIcon : sunIcon;
    return THEME_MODE[theme].icon;
  })();

  const themeSection: MenuSection = {
    key: 'appearance',
    label: stringFormatter.format('appearance'),
    children: [
      { key: 'theme:light', icon: sunIcon, label: stringFormatter.format('themeLight') },
      { key: 'theme:dark', icon: moonIcon, label: stringFormatter.format('themeDark') },
      { key: 'theme:auto', icon: monitorIcon, label: stringFormatter.format('themeSystem') },
    ],
  } as any;

  const localeSection: MenuSection = {
    key: 'language',
    label: stringFormatter.format('language'),
    children: (Object.keys(supportedLocales) as Array<keyof typeof supportedLocales>).map(k => ({
      key: `locale:${k as string}`,
      icon: themeIcon, // keep spacing consistent; icon is optional
      label: supportedLocales[k],
    })) as any,
  };

  return (
    <MenuTrigger align="end">
      <ActionButton aria-label={stringFormatter.format('preferences')} prominence="low">
        <Icon src={moreHorizontalIcon} />
      </ActionButton>
      <Menu
        aria-label={stringFormatter.format('preferences')}
        items={[themeSection, localeSection]}
        onAction={key => {
          const action = String(key);
          if (action.startsWith('theme:')) {
            setTheme(action.split(':')[1] as ColorScheme);
            return;
          }
          if (action.startsWith('locale:')) {
            const next = action.split(':')[1];
            try {
              const url = new URL(window.location.href);
              url.searchParams.set('locale', next);
              window.location.replace(url.toString());
            } catch {}
          }
        }}
      >
        {section => (
          <Section key={section.key} aria-label={section.label} items={section.children}>
            {item => (
              <Item key={item.key} textValue={item.label}>
                <Icon src={item.icon} />
                <Text>{item.label}</Text>
              </Item>
            )}
          </Section>
        )}
      </Menu>
    </MenuTrigger>
  );
}

// User controls
// -----------------------------------------------------------------------------

type UserData = {
  name: string;
  avatarUrl?: string;
  login: string;
};

export function UserActions() {
  let config = useConfig();
  const stringFormatter = useLocalizedStringFormatter(l10nMessages);
  let userData = useUserData();
  let router = useRouter();

  if (!userData) {
    return null;
  }

  if (userData === 'unauthorized') {
    return (
      <ActionButton
        onPress={() => {
          redirectToCloudAuth(
            router.params.map(encodeURIComponent).join('/'),
            config
          );
        }}
        flex
      >
        {stringFormatter.format('signIntoCloud')}
      </ActionButton>
    );
  }

  return <UserMenu {...userData} />;
}

export function UserMenu(user: {
  name: string;
  avatarUrl?: string;
  login: string;
}) {
  let config = useConfig();
  const cloudInfo = useCloudInfo();
  const imageLibraryUrl = useImageLibraryURL();

  const menuItems = useMemo(() => {
    let items: MenuItem[] = [
      {
        key: 'logout',
        label: 'Log out',
        href:
          config.storage.kind === 'github'
            ? (('/api' + ((typeof window !== 'undefined' && (window as any).__KS_BASE_PATH__) ? (window as any).__KS_BASE_PATH__ : '/keystatic')) + '/github/logout')
            : undefined,
        icon: logOutIcon,
      },
    ];
    if (config.cloud?.project) {
      items.unshift({
        key: 'manage',
        label: 'Account',
        icon: userIcon,
        href: 'https://keystatic.cloud/account',
        target: '_blank',
        rel: 'noopener noreferrer',
      });
    }
    if (cloudInfo?.team.images) {
      items.unshift({
        key: 'image-library',
        label: 'Image library',
        icon: imageIcon,
        href: imageLibraryUrl,
        target: '_blank',
        rel: 'noopener noreferrer',
      });
    }
    return items;
  }, [cloudInfo, config, imageLibraryUrl]);

  if (!user) {
    return null;
  }

  return (
    <MenuTrigger>
      <UserDetailsButton {...user} />
      <>
        <Menu
          items={menuItems}
          minWidth="scale.2400"
          onAction={async key => {
            await Promise.all([clearObjectCache(), clearDrafts()]);
            switch (key) {
              case 'logout':
                switch (config.storage.kind) {
                  case 'cloud':
                  case 'local': {
                    const token = getCloudAuth(config)?.accessToken;
                    if (token) {
                      await fetch(`${KEYSTATIC_CLOUD_API_URL}/oauth/revoke`, {
                        method: 'POST',
                        body: new URLSearchParams({ token }).toString(),
                        headers: {
                          'Content-Type': 'application/x-www-form-urlencoded',
                          ...KEYSTATIC_CLOUD_HEADERS,
                        },
                      });
                    }
                    localStorage.removeItem('keystatic-cloud-access-token');
                    window.location.reload();
                    break;
                  }
                }
            }
          }}
        >
          {item => (
            <Item
              key={item.key}
              textValue={item.label}
              href={item.href}
              rel={item.rel}
              target={item.target}
            >
              <Icon src={item.icon} />
              <Text>{item.label}</Text>
            </Item>
          )}
        </Menu>
      </>
    </MenuTrigger>
  );
}

const UserDetailsButton = forwardRef(function UserDetailsButton(
  props: UserData & PressProps,
  ref: ForwardedRef<HTMLButtonElement>
) {
  let { avatarUrl, login, name, ...otherProps } = props;
  const stringFormatter = useLocalizedStringFormatter(l10nMessages);
  return (
    <ActionButton
      {...otherProps}
      ref={ref}
      aria-label={stringFormatter.format('userMenu')}
      prominence="low"
      flexGrow={1}
      UNSAFE_className={css({ justifyContent: 'start', textAlign: 'start' })}
    >
      <Flex alignItems="center" gap="regular">
        <Avatar src={avatarUrl} name={name ?? undefined} size="small" />
        <ClearSlots>
          <Flex direction="column" gap="small">
            <Text size="small" weight="semibold" color="neutralEmphasis">
              {name}
            </Text>
            {name === login ? null : (
              <Text size="small" color="neutralTertiary">
                {login}
              </Text>
            )}
          </Flex>
        </ClearSlots>
      </Flex>
    </ActionButton>
  );
});

// Git controls
// -----------------------------------------------------------------------------

export function useAssociatedPullRequest() {
  const branches = useBranches();
  const repoInfo = useRepoInfo();
  const currentBranch = useCurrentBranch();
  const currentBranchId = branches.get(currentBranch)?.id;

  const [prResult] = useQuery({
    query: gql`
      query PullRequestForBranch($refId: ID!) {
        node(id: $refId) {
          __typename
          id
          ... on Ref {
            associatedPullRequests(states: [OPEN], first: 1) {
              nodes {
                id
                number
              }
            }
          }
        }
      }
    ` as import('../../../../__generated__/ts-gql/PullRequestForBranch').type,
    pause: !currentBranchId || currentBranch === repoInfo?.defaultBranch,
    variables: { refId: currentBranchId! },
  });
  return prResult.data?.node && prResult.data.node.__typename === 'Ref'
    ? prResult.data.node.associatedPullRequests?.nodes?.[0]?.number ?? false
    : undefined;
}

export function GitMenu() {
  const branches = useBranches();
  const currentBranch = useCurrentBranch();
  const repoInfo = useRepoInfo();
  const prNumber = useAssociatedPullRequest();
  const stringFormatter = useLocalizedStringFormatter(l10nMessages);
  const [newBranchDialogVisible, toggleNewBranchDialog] = useReducer(
    v => !v,
    false
  );
  const [deleteBranchDialogVisible, toggleDeleteBranchDialog] = useReducer(
    v => !v,
    false
  );
  const [, deleteBranch] = useMutation(
    gql`
      mutation DeleteBranch($refId: ID!) {
        deleteRef(input: { refId: $refId }) {
          __typename
        }
      }
    ` as import('../../../../__generated__/ts-gql/DeleteBranch').type
  );

  const gitMenuItems = useMemo(() => {
    const repoURL = repoInfo ? getRepoUrl(repoInfo.upstream) : '';
    let isDefaultBranch = currentBranch === repoInfo?.defaultBranch;
    let items: MenuSection[] = [];
    let branchSection: MenuItem[] = [
      {
        key: 'new-branch',
        icon: gitBranchPlusIcon,
        label: stringFormatter.format('newBranch'),
      },
    ];
    let prSection: MenuItem[] = [];
    let repoSection: MenuItem[] = [
      {
        key: 'repo',
        icon: githubIcon,
        href: repoURL,
        target: '_blank',
        rel: 'noopener noreferrer',
        label: stringFormatter.format('githubRepo'),
      },
    ];

    if (!isDefaultBranch && prNumber !== undefined) {
      if (prNumber === false) {
        prSection.push({
          key: 'create-pull-request',
          icon: gitPullRequestIcon,
          href: `${repoURL}/pull/new/${currentBranch}`,
          target: '_blank',
          rel: 'noopener noreferrer',
          label: stringFormatter.format('createPullRequest'),
        });
        branchSection.push({
          key: 'delete-branch',
          icon: trash2Icon,
          label: stringFormatter.format('deleteBranch'),
        });
      } else {
        prSection.push({
          key: 'view-pull-request',
          icon: gitPullRequestIcon,
          href: `${repoURL}/pull/${prNumber}`,
          target: '_blank',
          rel: 'noopener noreferrer',
          label: `${stringFormatter.format('pullRequest')} #${prNumber}`,
        });
      }
    }
    const forkRepoUrl = repoInfo ? getRepoUrl(repoInfo) : '';
    if (forkRepoUrl !== repoURL) {
      repoSection.push({
        key: 'fork',
        icon: gitForkIcon,
        href: forkRepoUrl,
        target: '_blank',
        rel: 'noopener noreferrer',
        label: stringFormatter.format('viewFork'),
      });
    }

    if (branchSection.length) {
      items.push({
        key: 'branch-section',
        label: stringFormatter.format('branches'),
        children: branchSection,
      });
    }
    if (prSection.length) {
      items.push({
        key: 'pr-section',
        label: stringFormatter.format('pullRequests'),
        children: prSection,
      });
    }
    if (repoSection.length) {
      items.push({
        key: 'repo-section',
        label: stringFormatter.format('repository'),
        children: repoSection,
      });
    }

    return items;
  }, [currentBranch, repoInfo, stringFormatter, prNumber]);
  const router = useRouter();
  return (
    <>
      <ActionMenu
        aria-label={stringFormatter.format('gitActions')}
        align="end"
        items={gitMenuItems}
        onAction={key => {
          switch (key) {
            case 'new-branch':
              toggleNewBranchDialog();
              break;
            case 'delete-branch': {
              toggleDeleteBranchDialog();
              break;
            }
          }
        }}
      >
        {item => (
          <Section key={item.key} items={item.children} aria-label={item.label}>
            {item => (
              <Item
                key={item.key}
                textValue={item.label}
                href={item.href}
                rel={item.rel}
                target={item.target}
              >
                <Icon src={item.icon} />
                <Text>{item.label}</Text>
              </Item>
            )}
          </Section>
        )}
      </ActionMenu>

      <DialogContainer onDismiss={toggleNewBranchDialog}>
        {newBranchDialogVisible && (
          <CreateBranchDialog
            onDismiss={toggleNewBranchDialog}
            onCreate={branchName => {
              toggleNewBranchDialog();
              router.push(
                router.href.replace(
                  /\/branch\/[^/]+/,
                  '/branch/' + encodeURIComponent(branchName)
                )
              );
            }}
          />
        )}
      </DialogContainer>

      <DialogContainer onDismiss={toggleDeleteBranchDialog}>
        {deleteBranchDialogVisible && (
          <AlertDialog
            title={stringFormatter.format('deleteBranchTitle')}
            tone="critical"
            cancelLabel={stringFormatter.format('cancel')}
            primaryActionLabel={stringFormatter.format('yesDelete')}
            autoFocusButton="cancel"
            onPrimaryAction={async () => {
              if (repoInfo) {
                await deleteBranch({
                  refId: branches.get(currentBranch)!.id,
                });
                router.push(
                  router.href.replace(
                    /\/branch\/[^/]+/,
                    '/branch/' + encodeURIComponent(repoInfo.defaultBranch)
                  )
                );
              }
            }}
          >
            {stringFormatter.format('deleteBranchConfirmBody', { branch: currentBranch })}
          </AlertDialog>
        )}
      </DialogContainer>
    </>
  );
}

// Utils
// -----------------------------------------------------------------------------

function useUserData(): UserData | 'unauthorized' | undefined {
  const config = useConfig();
  const user = useViewer();
  const rawCloudInfo = useRawCloudInfo();

  if (rawCloudInfo) {
    if (rawCloudInfo === 'unauthorized') {
      return rawCloudInfo;
    }

    return {
      avatarUrl: rawCloudInfo.user.avatarUrl,
      login: rawCloudInfo.user.email,
      name: rawCloudInfo.user.name,
    };
  }

  if (isGitHubConfig(config) && user) {
    return {
      avatarUrl: user.avatarUrl,
      login: user.login,
      name: user.name ?? user.login,
    };
  }

  return undefined;
}
