import type { Config } from '@keystatic/core';
import { Keystatic as $Keystatic } from '@keystatic/core/ui';
import 'react';
import 'react/jsx-runtime';
import { config, fields, collection } from '@keystatic/core';

const _config = config({
  storage: {
    kind: 'local',
  },
  collections: {
    posts: collection({
      label: 'Posts',
      slugField: 'title',
      path: 'src/content/posts/*',
      format: { contentField: 'content' },
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        content: fields.markdoc({
          label: 'Content',
          options: {
            image: {
              directory: 'src/assets/images/posts',
              publicPath: '../../assets/images/posts/',
            },
          },
        }),
      },
    }),
  },
});

interface Props {
  config: Config
  basePath?: string
}

const appSlug = {
  envName: 'PUBLIC_KEYSTATIC_GITHUB_APP_SLUG',
  value: import.meta.env.PUBLIC_KEYSTATIC_GITHUB_APP_SLUG ?? '',
};

/**
 * Will retrieve locale from search params or navigator
 * @example
 *   https://localhost:3002/keystatic?locale=zh-CN
 */
export const Keystatic = (props: Props): ReturnType<typeof $Keystatic> | null => {
  try {

    // Set global -- Keystatic entrypoint does not handle basePath (yet).
    // @todo Load ambient types from @keystatic/core/globals.d.ts
    ;(window as Window & { __KS_BASE_PATH__?: string }).__KS_BASE_PATH__ = props.basePath;

    return $Keystatic({
      config: _config,
      appSlug: appSlug,
      basePath: props.basePath,
    });
  } catch (err) {
    console.error(err);
    return null;
  }
};
export default Keystatic;
