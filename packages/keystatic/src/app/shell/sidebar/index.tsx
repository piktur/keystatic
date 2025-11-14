import { useLocalizedStringFormatter } from '@react-aria/i18n';
import { DismissButton, useModalOverlay } from '@react-aria/overlays';
import { useUpdateEffect } from '@react-aria/utils';
import {
  OverlayTriggerState,
  useOverlayTriggerState,
} from '@react-stately/overlays';
import { typedKeys } from 'emery';
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from 'react';

import { ActionButton } from '@keystar/ui/button';
import { ActionGroup, Item as ActionGroupItem } from '@keystar/ui/action-group';
import { Badge } from '@keystar/ui/badge';
import { Divider, ScrollView, HStack, VStack } from '@keystar/ui/layout';
import { NavList, NavItem, NavGroup } from '@keystar/ui/nav-list';
import { Blanket } from '@keystar/ui/overlays';
import { StatusLight } from '@keystar/ui/status-light';
import { Menu, MenuTrigger, Item as MenuItem, Section } from '@keystar/ui/menu';
import { Icon } from '@keystar/ui/icon';
import { globeIcon } from '@keystar/ui/icon/icons/globeIcon';
import { sunIcon } from '@keystar/ui/icon/icons/sunIcon';
import { moonIcon } from '@keystar/ui/icon/icons/moonIcon';
import { monitorIcon } from '@keystar/ui/icon/icons/monitorIcon';
import { moreHorizontalIcon } from '@keystar/ui/icon/icons/moreHorizontalIcon';
import {
  breakpoints,
  css,
  tokenSchema,
  transition,
  useBreakpoint,
} from '@keystar/ui/style';
import { Text } from '@keystar/ui/typography';
import { usePrevious } from '@keystar/ui/utils';

import l10nMessages from '../../l10n';
import { useRouter } from '../../router';
import { ItemOrGroup, useNavItems } from '../../useNavItems';
import { isLocalConfig } from '../../utils';
import { pluralize } from '../../pluralize';

import { useBrand } from '../common';
import { SIDE_PANEL_ID } from '../constants';
import { GitMenu, UserActions } from './components';
import { BranchPicker } from '../../branch-selection';
import { useAppState, useConfig } from '../context';
import { useThemeContext } from '../theme';
import { ColorScheme } from '@keystar/ui/types';
import { locales } from '../../l10n/locales';

const SidebarContext = createContext<OverlayTriggerState | null>(null);
export function useSidebar() {
  let context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be within a SidebarProvider');
  }
  return context;
}

const breakpointNames = typedKeys(breakpoints);
export function SidebarProvider(props: { children: ReactNode }) {
  const matchedBreakpoints = useBreakpoint();
  const state = useOverlayTriggerState({
    defaultOpen: matchedBreakpoints.includes('desktop'),
  });

  let breakpointIndex = breakpointNames.indexOf(matchedBreakpoints[0]);
  let previousIndex = usePrevious(breakpointIndex) || 0;

  useUpdateEffect(() => {
    let larger = previousIndex < breakpointIndex;
    if (larger && breakpointIndex >= 2) {
      state.open();
    } else if (breakpointIndex < 2) {
      state.close();
    }
  }, [matchedBreakpoints]);

  return (
    <SidebarContext.Provider value={state}>
      {props.children}
    </SidebarContext.Provider>
  );
}

export function SidebarPanel() {
  return (
    <VStack backgroundColor="surface" height="100%">
      <SidebarHeader />
      <SidebarGitActions />
      <SidebarNav />
      <SidebarFooter />
    </VStack>
  );
}

function SidebarHeader() {
  let isLocalNoCloud = useIsLocalNoCloud();
  let { brandMark, brandName } = useBrand();

  return (
    <HStack
      alignItems="center"
      gap="regular"
      paddingY="regular"
      paddingX="medium"
      height={{ mobile: 'element.large', tablet: 'element.xlarge' }}
    >
      <HStack
        flex
        alignItems="center"
        gap="regular"
        UNSAFE_className={css({
          // let consumers use "currentColor" in SVG for their brand mark
          color: tokenSchema.color.foreground.neutralEmphasis,

          // ensure that the brand mark doesn't get squashed
          '& :first-child': {
            flexShrink: 0,
          },
        })}
      >
        {brandMark}

        <Text color="inherit" weight="medium" truncate>
          {brandName}
        </Text>
      </HStack>
      <SidebarPreferences />
    </HStack>
  );
}

// when local mode w/o cloud there's no user actions, so we hide the footer and
// move the theme menu to the header
function SidebarFooter() {
  let isLocalNoCloud = useIsLocalNoCloud();
  if (isLocalNoCloud) {
    return null;
  }
  return (
    <HStack
      alignItems="center"
      paddingY="regular"
      paddingX="medium"
      gap="regular"
    >
      <UserActions />
    </HStack>
  );
}

// no git actions in local mode
function SidebarGitActions() {
  let config = useConfig();
  if (isLocalConfig(config)) {
    return null;
  }
  return (
    <HStack gap="regular" paddingY="regular" paddingX="medium">
      <BranchPicker />
      <GitMenu />
    </HStack>
  );
}

export function SidebarDialog() {
  const state = useSidebar();
  const router = useRouter();

  // close the sidebar when the route changes
  useUpdateEffect(() => {
    state.close();
  }, [router.href]);

  let dialogRef = useRef<HTMLDivElement>(null);
  let { modalProps, underlayProps } = useModalOverlay(
    { isDismissable: true },
    state,
    dialogRef
  );

  return (
    <>
      <Blanket {...underlayProps} isOpen={state.isOpen} zIndex={10} />
      <div
        data-visible={state.isOpen}
        id={SIDE_PANEL_ID}
        ref={dialogRef}
        {...modalProps}
        // styles
        className={css({
          backgroundColor: tokenSchema.color.background.surface,
          boxShadow: `${tokenSchema.size.shadow.large} ${tokenSchema.color.shadow.regular}`,
          display: 'flex',
          flexDirection: 'column',
          inset: 0,
          insetInlineEnd: 'auto',
          // ensure that there's always enough of gutter for the user to press
          // and exit the sidebar
          maxWidth: `calc(100% - ${tokenSchema.size.element.medium})`,
          minWidth: tokenSchema.size.scale[3000],
          outline: 0,
          pointerEvents: 'none',
          position: 'fixed',
          transform: 'translateX(-100%)',
          visibility: 'hidden',
          zIndex: 10,

          // exit animation
          transition: [
            transition('transform', {
              easing: 'easeIn',
              duration: 'short',
              // delay: 'short',
            }),
            transition('visibility', {
              delay: 'regular',
              duration: 0,
              easing: 'linear',
            }),
          ].join(', '),

          '&[data-visible=true]': {
            transform: 'translateX(0)',
            // enter animation
            transition: transition('transform', { easing: 'easeOut' }),
            pointerEvents: 'auto',
            visibility: 'visible',
          },
        })}
      >
        <SidebarHeader />
        <SidebarGitActions />
        <SidebarNav />
        <SidebarFooter />
        <DismissButton onDismiss={state.close} />
      </div>
    </>
  );
}

export function SidebarNav() {
  const { basePath } = useAppState();
  const stringFormatter = useLocalizedStringFormatter(l10nMessages);
  const navItems = useNavItems();
  const isCurrent = useIsCurrent();

  return (
    <ScrollView flex paddingY="large" paddingEnd="medium">
      <NavList>
        <NavItem
          href={basePath}
          aria-current={isCurrent(basePath, { exact: true })}
        >
          {stringFormatter.format('dashboard')}
        </NavItem>

        {navItems.map((item, i) => (
          <NavItemOrGroup key={i} itemOrGroup={item} />
        ))}
      </NavList>
    </ScrollView>
  );
}

// Utils
// ----------------------------------------------------------------------------

function useIsLocalNoCloud() {
  const config = useConfig();
  return isLocalConfig(config) && !config.cloud;
}

function useIsCurrent() {
  const router = useRouter();
  return useCallback(
    (href: string, { exact = false } = {}) => {
      if (exact) {
        return href === router.pathname ? 'page' : undefined;
      }
      return href === router.pathname || router.pathname.startsWith(`${href}/`)
        ? 'page'
        : undefined;
    },
    [router.pathname]
  );
}

// Renderers
// ----------------------------------------------------------------------------
function NavItemOrGroup({ itemOrGroup }: { itemOrGroup: ItemOrGroup }) {
  const isCurrent = useIsCurrent();
  const stringFormatter = useLocalizedStringFormatter(l10nMessages);
  if (itemOrGroup.isDivider) {
    return <Divider />;
  }

  if (itemOrGroup.children) {
    return (
      <NavGroup title={itemOrGroup.title}>
        {itemOrGroup.children.map((child, i) => (
          <NavItemOrGroup itemOrGroup={child} key={i} />
        ))}
      </NavGroup>
    );
  }

  let changeElement = (() => {
    if (!itemOrGroup.changed) {
      return null;
    }

    return typeof itemOrGroup.changed === 'number' ? (
      <Badge tone="accent" marginStart="auto">
        <Text>{itemOrGroup.changed}</Text>
        <Text visuallyHidden>
          {pluralize(itemOrGroup.changed, {
            singular: 'change',
            plural: 'changes',
            inclusive: false,
          })}
        </Text>
      </Badge>
    ) : (
      <StatusLight
        tone="accent"
        marginStart="auto"
        aria-label={stringFormatter.format('changed')}
        role="status"
      />
    );
  })();

  return (
    <NavItem href={itemOrGroup.href} aria-current={isCurrent(itemOrGroup.href)}>
      <Text truncate title={itemOrGroup.label}>
        {itemOrGroup.label}
      </Text>
      {changeElement}
    </NavItem>
  );
}

const THEME_OPTIONS = [
  { key: 'light', icon: sunIcon, labelKey: 'themeLight' },
  { key: 'dark', icon: moonIcon, labelKey: 'themeDark' },
  { key: 'auto', icon: monitorIcon, labelKey: 'themeSystem' },
] as const;

const SUPPORTED_LOCALES = ['en-US', 'zh-CN'] as const;

function SidebarPreferences() {
  const stringFormatter = useLocalizedStringFormatter(l10nMessages);
  const { theme, setTheme } = useThemeContext();

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
        <Section aria-label={stringFormatter.format('appearance')}>
          <MenuItem textValue={stringFormatter.format('appearance')}>
            <VStack gap="small" padding="regular" width="100%">
              <Text
                color="neutralSecondary"
                size="small"
                UNSAFE_className={css({ whiteSpace: 'nowrap' })}
              >
                {stringFormatter.format('appearance')}
              </Text>
              <ActionGroup
                aria-label={stringFormatter.format('theme')}
                buttonLabelBehavior="show"
                density="compact"
                items={THEME_OPTIONS}
                overflowMode="wrap"
                selectedKeys={[theme]}
                selectionMode="single"
                onAction={key => setTheme(key as ColorScheme)}
                width="100%"
              >
                {item => (
                  <ActionGroupItem
                    key={item.key}
                    textValue={stringFormatter.format(item.labelKey)}
                  >
                    <Icon src={item.icon} />
                    <Text>{stringFormatter.format(item.labelKey)}</Text>
                  </ActionGroupItem>
                )}
              </ActionGroup>
            </VStack>
          </MenuItem>
        </Section>
        <Section
          aria-label={stringFormatter.format('language')}
          items={localeItems}
        >
          {item => (
            <MenuItem key={item.key} textValue={item.label}>
              <Icon src={globeIcon} />
              <Text>{item.label}</Text>
            </MenuItem>
          )}
        </Section>
      </Menu>
    </MenuTrigger>
  );
}
