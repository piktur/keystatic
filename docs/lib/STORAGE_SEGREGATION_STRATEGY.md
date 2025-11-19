# Keystatic Storage Layer Segregation Strategy

## Executive Summary

This document outlines a strategy to cleanly segregate Keystatic's form field rendering engine from its data storage layer, enabling hosted forms at protected URLs with swappable storage backends (S3, SQLite, Cloudflare D1, etc.).

## Current Architecture Analysis

### Form Field Rendering Layer
- **Location**: `packages/keystatic/src/form/`
- **Core Components**:
  - `ComponentSchema` - Type system for field definitions
  - `FormField<Value, ValidatedValue, StoredValue>` - Generic field interface
  - Field implementations in `src/form/fields/*`
  - Serialization: `serialize-props.ts`, `parse-props.ts`
  - Value transformation: `props-value.ts`
  - React UI: Each field has an `Input()` component

### Data Storage Layer  
- **Location**: `packages/keystatic/src/api/`, `packages/keystatic/src/reader/`, `packages/keystatic/src/app/`
- **Current Backends**:
  - **Local**: `api-node.ts` - Node.js filesystem (fs/promises)
  - **GitHub**: `generic.ts` - GitHub API, OAuth, tree-based storage
  - **Cloud**: Keystatic cloud service
- **Operations**: 
  - Read: `reader/generic.ts` via `MinimalFs` interface
  - Write: `app/updating.tsx` via GraphQL mutations (GitHub) or HTTP endpoints (local)
  - Tree management: `app/trees.ts` - Git-style object storage

### Coupling Points Identified

1. **Schema-driven serialization** (`form/serialize-props.ts:20-109`)
   - Transforms form state → file structure
   - Generates `extraFiles[]` for assets/content
   - Hard-coded file path generation
   - **Coupling**: Storage format (YAML/JSON + separate files) baked into serialization

2. **Reader layer** (`reader/generic.ts:316-401`)
   - `MinimalFs` interface: `readFile()`, `readdir()`, `fileExists()`
   - Directly maps filesystem paths to schema structure
   - **Coupling**: Assumes hierarchical file-based storage

3. **Update operations** (`app/updating.tsx:109-150`)
   - `useUpsertItem()` hook handles create/update
   - Branches by `config.storage.kind` 
   - **Coupling**: UI layer aware of storage backend

4. **API handlers** (`api/generic.ts:52-194`)
   - `makeGenericAPIRouteHandler()` - routing by storage.kind
   - `localModeApiHandler()` - direct filesystem operations
   - **Coupling**: HTTP API coupled to storage implementation

5. **Configuration** (`config.tsx:109-187`)
   - `storage.kind: 'local' | 'github' | 'cloud'`
   - Storage config mixed with UI/schema config
   - **Coupling**: Single config object for all concerns

## Proposed Segregation Strategy

### 1. Storage Abstraction Interface

```typescript
// packages/keystatic/src/storage/interface.ts

export interface StorageAdapter {
  // Lifecycle
  initialize(config: StorageConfig): Promise<void>;
  
  // Read operations
  readEntry(collection: string, slug: string): Promise<StoredEntry | null>;
  readSingleton(singleton: string): Promise<StoredEntry | null>;
  listEntries(collection: string): Promise<string[]>;
  
  // Write operations  
  createEntry(collection: string, slug: string, data: StoredEntry): Promise<void>;
  updateEntry(collection: string, slug: string, data: StoredEntry): Promise<void>;
  deleteEntry(collection: string, slug: string): Promise<void>;
  
  // Assets/files
  readAsset(path: string): Promise<Uint8Array | null>;
  writeAsset(path: string, data: Uint8Array): Promise<void>;
  deleteAsset(path: string): Promise<void>;
  
  // Transaction support (optional)
  transaction?(fn: (tx: StorageTransaction) => Promise<void>): Promise<void>;
}

export interface StoredEntry {
  data: Record<string, unknown>;        // Parsed YAML/JSON
  assets: Map<string, Uint8Array>;      // Content fields, images, etc.
  metadata?: Record<string, unknown>;   // Created/updated timestamps, etc.
}

export interface StorageConfig {
  kind: string;                         // 'local' | 's3' | 'd1' | 'github'
  options: Record<string, unknown>;     // Adapter-specific config
}
```

### 2. Adapter Implementations

```
packages/keystatic/src/storage/
├── interface.ts           # Core interfaces
├── adapters/
│   ├── local.ts          # Existing fs-based (refactored)
│   ├── github.ts         # Existing GitHub (refactored)  
│   ├── s3.ts             # NEW: AWS S3 backend
│   ├── d1.ts             # NEW: Cloudflare D1 backend
│   └── sqlite.ts         # NEW: SQLite backend
├── registry.ts           # Adapter registration/factory
└── utils.ts              # Shared helpers
```

### 3. Refactored Serialization Layer

**Current** (`serialize-props.ts`):
```typescript
// Generates file structure directly
return {
  value: transformedYAML,
  extraFiles: [{ path: 'content.md', contents: ... }]
}
```

**Proposed**:
```typescript
// Returns storage-agnostic structure
export function serializeToStoredEntry(
  schema: ComponentSchema,
  state: unknown
): StoredEntry {
  return {
    data: serializeToData(schema, state),
    assets: extractAssets(schema, state),
    metadata: { ... }
  };
}

// Storage adapter decides how to persist
adapter.createEntry(collection, slug, storedEntry);
```

### 4. Reader Layer Refactor

**Current** (`reader/generic.ts:193-198`):
```typescript
export type MinimalFs = {
  readFile(path: string): Promise<Uint8Array | null>;
  readdir(path: string): Promise<DirEntry[]>;
  fileExists(path: string): Promise<boolean>;
};
```

**Proposed**:
```typescript
export function createReader<C, S>(
  adapter: StorageAdapter,
  config: Config<C, S>
): Reader<C, S> {
  return {
    collections: mapCollections(adapter, config.collections),
    singletons: mapSingletons(adapter, config.singletons),
  };
}
```

### 5. Configuration Updates

```typescript
// config.tsx
export type Config<Collections, Singletons> = {
  storage: StorageConfig;  // Generic storage config
  collections?: Collections;
  singletons?: Singletons;
  ui?: UserInterface;
};

// Usage
config({
  storage: {
    kind: 's3',
    options: {
      bucket: 'my-forms',
      region: 'us-east-1',
      // ... S3-specific config
    }
  },
  collections: { ... }
});
```

### 6. API Handler Refactor

```typescript
// api/generic.ts
export function makeGenericAPIRouteHandler(
  config: APIRouteConfig,
  adapter: StorageAdapter
) {
  return async (req: KeystaticRequest): Promise<KeystaticResponse> => {
    // Generic CRUD operations via adapter
    if (req.method === 'GET' && params[0] === 'entry') {
      const entry = await adapter.readEntry(collection, slug);
      return { status: 200, body: JSON.stringify(entry) };
    }
    // ... other operations
  };
}
```

## Implementation Phases

### Phase 1: Interface Definition (Low Risk)
**Effort**: 1-2 weeks  
**Files**: 5-10 new files, ~500 LOC

- Define `StorageAdapter` interface
- Create adapter registry
- Add TypeScript types for `StoredEntry`

### Phase 2: Refactor Existing Backends (Medium Risk)  
**Effort**: 3-4 weeks  
**Files**: ~15 files modified, ~1000 LOC changed

- Wrap `api-node.ts` as `LocalStorageAdapter`
- Wrap GitHub logic as `GitHubStorageAdapter`  
- Update serialization layer to use `StoredEntry`
- Maintain backward compatibility

### Phase 3: Update Consumers (High Risk)
**Effort**: 2-3 weeks  
**Files**: ~20 files modified

- Refactor `reader/generic.ts` to use adapters
- Update `app/updating.tsx` to use adapters
- Modify `makeGenericAPIRouteHandler()`
- Update test fixtures

### Phase 4: New Adapters (Low-Medium Risk)
**Effort**: 2-4 weeks per adapter  
**Files**: ~5 new files per adapter, ~800 LOC each

- Implement S3 adapter
- Implement Cloudflare D1 adapter  
- Implement SQLite adapter
- Add integration tests

## Difficulty Assessment

### Overall Complexity: **Medium-High**

**Easy Parts** (30% of work):
- Interface definition
- Adapter registry
- New adapter implementations (once interface stable)

**Medium Parts** (40% of work):
- Serialization refactor (data vs. files decoupling)
- Reader layer updates
- Configuration updates

**Hard Parts** (30% of work):  
- GitHub adapter refactor (complex tree/OAuth logic)
- UI update operations (React hooks, optimistic updates)
- Transaction semantics for multi-file operations
- Migration path for existing users

## Blast Radius

### High Impact Areas
1. **API Handlers** (`api/generic.ts`, `api/api-node.ts`)
   - Complete rewrite of routing logic
   - Breaking changes to internal APIs

2. **Serialization** (`form/serialize-props.ts`, `form/parse-props.ts`)
   - Change from file-centric to data-centric model
   - Affects all form field types

3. **Reader** (`reader/generic.ts`, `reader/index.ts`)
   - New abstraction layer between config and storage
   - Impacts all consumers using `createReader()`

4. **UI Layer** (`app/updating.tsx`, `app/useItemData.ts`)
   - Replace storage.kind branches with adapter calls
   - Update React hooks for optimistic updates

### Medium Impact Areas  
1. **Configuration** (`config.tsx`)
   - New storage config schema
   - Deprecation path for old configs

2. **Tests** (`test/*`, `*.test.ts`)
   - Mock adapters needed
   - Update ~50 test files

### Low Impact Areas
1. **Form Fields** (`form/fields/*`)
   - Minimal changes (interface already abstract)
   - Serialization logic moves to adapter layer

2. **UI Components** (`app/ItemPage.tsx`, etc.)
   - No direct changes (use hooks)

## Risks & Mitigations

### Risk 1: GitHub Backend Complexity
**Impact**: High  
**Likelihood**: High  
**Mitigation**:
- Keep Git tree logic intact initially
- Thin adapter wrapper around existing code
- Gradual refactor in Phase 2b

### Risk 2: Breaking Changes for Users  
**Impact**: High  
**Likelihood**: Medium  
**Mitigation**:
- Feature flag for new storage layer
- Dual implementation during transition
- Auto-migration for configs

### Risk 3: Performance Regression
**Impact**: Medium  
**Likelihood**: Medium  
**Mitigation**:
- Benchmark before/after
- Optimize adapter hot paths
- Add caching layer if needed

### Risk 4: Asset Handling Edge Cases
**Impact**: Medium  
**Likelihood**: High  
**Mitigation**:
- Comprehensive test suite for assets
- Transaction support for multi-file ops
- Rollback mechanism for failures

## Success Metrics

1. **Clean Separation**: Form rendering has zero imports from `api/` or `app/trees.ts`
2. **Swappability**: Can switch storage adapter via config change only
3. **No Regression**: All existing tests pass with adapter wrappers
4. **New Backends**: S3 + D1 adapters working end-to-end
5. **Performance**: <10% overhead vs. direct implementation

## Alternative Approaches Considered

### Alt 1: Minimal Filesystem Abstraction
- Just replace `MinimalFs` with storage-specific implementations
- **Pros**: Less refactoring, faster
- **Cons**: Still file-centric, hard to optimize for DB backends

### Alt 2: Event Sourcing / CQRS
- Separate write (commands) from read (queries)  
- **Pros**: Ultimate flexibility
- **Cons**: Over-engineered, breaks existing model

### Alt 3: Plugin System
- Storage as runtime plugins (like Webpack loaders)
- **Pros**: Maximum extensibility
- **Cons**: Complex runtime, TypeScript challenges

## Conclusion

**Recommended Path**: Incremental refactor via Phase 1-4  
**Estimated Total Effort**: 10-15 weeks (2-3 engineers)  
**Risk Level**: Medium-High (mitigable with feature flags + gradual rollout)  

The segregation is architecturally sound but requires careful execution due to:
1. Deep coupling between serialization and file-based storage
2. Complex GitHub tree logic
3. React UI layer directly aware of storage backend

Success depends on:
- Strong interface design upfront (Phase 1)
- Backward compatibility during transition (Phase 2-3)
- Comprehensive testing (all phases)
- Feature flags to enable gradual rollout
