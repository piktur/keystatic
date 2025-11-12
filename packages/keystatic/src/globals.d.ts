declare global {
  interface Window {
    __KS_BASE_PATH__?: string;
    __KS_ACTION_LOADER__?: Record<
      string,
      () => Promise<import('./app/actions/loader').CollectionActionModule>
    >;
  }
}

export { };
