import type { CollectionAction } from '../../config';

export type CollectionActionModule = {
  key: string;
  label: string;
  icon?: any;
  description?: string;
  handler: CollectionAction['handler'];
  condition?: CollectionAction['condition'];
};

let actionModulesCache: Record<string, CollectionActionModule> | null = null;

export async function loadCollectionActions(
  collectionName: string
): Promise<CollectionAction[]> {
  if (typeof window === 'undefined') {
    return [];
  }

  if (!actionModulesCache) {
    actionModulesCache = await loadActionModules();
  }

  const actions: CollectionAction[] = [];
  const prefix = `/${collectionName}/`;

  for (const [path, module] of Object.entries(actionModulesCache)) {
    if (path.includes(prefix)) {
      actions.push({
        key: module.key,
        label: module.label,
        icon: module.icon,
        description: module.description,
        handler: module.handler,
        condition: module.condition,
      });
    }
  }

  return actions;
}

async function loadActionModules(): Promise<Record<string, CollectionActionModule>> {
  const modules: Record<string, CollectionActionModule> = {};

  if (!(window as any).__KS_ACTION_LOADER__) {
    return modules;
  }

  const loader = (window as any).__KS_ACTION_LOADER__ as Record<
    string,
    () => Promise<CollectionActionModule>
  >;

  for (const [path, loadModule] of Object.entries(loader)) {
    try {
      const module = await loadModule();
      const normalizedPath = normalizePath(path);
      modules[normalizedPath] = module;
    } catch (error) {
      console.error(`Failed to load action module: ${path}`, error);
    }
  }

  return modules;
}

function normalizePath(path: string): string {
  return path
    .replace(/^\.\.\/\.\.\/packages\/[^/]+\/src\/keystatic\/actions/, '')
    .replace(/^\/src\/keystatic\/actions/, '')
    .replace(/\.(ts|js|tsx|jsx)$/, '');
}

export function clearActionCache(): void {
  actionModulesCache = null;
}
