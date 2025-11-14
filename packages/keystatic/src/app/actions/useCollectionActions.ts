import { useEffect, useState, useMemo } from 'react';
import type { CollectionAction } from '../../config';
import { loadCollectionActions } from './loader';

export function useCollectionActions(
  collectionName: string,
  enabled: boolean = true
): CollectionAction[] {
  const [actions, setActions] = useState<CollectionAction[]>([]);

  useEffect(() => {
    if (!enabled) {
      setActions([]);
      return;
    }

    let cancelled = false;

    loadCollectionActions(collectionName)
      .then(loadedActions => {
        if (!cancelled) {
          setActions(loadedActions);
        }
      })
      .catch(error => {
        console.error(`Failed to load actions for collection: ${collectionName}`, error);
        if (!cancelled) {
          setActions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [collectionName, enabled]);

  return actions;
}

export function useFilteredCollectionActions(
  collectionName: string,
  filterContext: Parameters<NonNullable<CollectionAction['condition']>>[0] | null,
  enabled: boolean = true
): CollectionAction[] {
  const allActions = useCollectionActions(collectionName, enabled);

  return useMemo(() => {
    if (!filterContext) return allActions;

    return allActions.filter(action => {
      if (!action.condition) return true;
      try {
        return action.condition(filterContext);
      } catch (error) {
        console.error(`Error evaluating action condition for ${action.key}:`, error);
        return false;
      }
    });
  }, [allActions, filterContext]);
}
