import { Config } from '../config';
import { assertValidRepoConfig } from './repo-config';

export function Keystatic(props: {
  config: Config;
  appSlug?: { envName: string; value: string | undefined };
  basePath?: string
}) {
  if (props.config.storage.kind === 'github') {
    assertValidRepoConfig(props.config.storage.repo);
  }
  return null;
}
