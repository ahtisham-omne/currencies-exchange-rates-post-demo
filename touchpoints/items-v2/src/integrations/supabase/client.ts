/* Supabase client stub for Item v2 attachments port.
 * PI uses Supabase Storage + tables for real uploads; Item v2 keeps everything
 * in-memory. All calls become no-ops that return safe error shapes. */

const notConfigured = () =>
  Promise.resolve({ data: null, error: new Error("supabase not configured") });

const storageBucket = {
  createSignedUrl: (_path: string, _ttl: number) => notConfigured(),
  upload: (_path: string, _file: any, _opts?: any) => notConfigured(),
  remove: (_paths: string[]) => notConfigured(),
  download: (_path: string) => notConfigured(),
};

/* Chainable query builder stub — enough to satisfy PI's usage patterns like
 * `supabase.from('t').insert({...}).select('id').single()` etc. Every terminal
 * call resolves to `{ data: null, error: Error }`. */
function makeQueryBuilder() {
  const self: any = {
    select: (_cols?: string) => self,
    insert: (_row: any) => self,
    update: (_patch: any) => self,
    delete: () => self,
    eq: (_col: string, _val: any) => self,
    neq: (_col: string, _val: any) => self,
    in: (_col: string, _vals: any[]) => self,
    match: (_criteria: any) => self,
    order: (_col: string, _opts?: any) => self,
    limit: (_n: number) => self,
    single: () => notConfigured(),
    maybeSingle: () => notConfigured(),
    then: (onResolve: any) => notConfigured().then(onResolve),
  };
  return self;
}

export const supabase = {
  storage: {
    from: (_bucket: string) => storageBucket,
  },
  from: (_table: string) => makeQueryBuilder(),
  auth: {
    getUser: () => notConfigured(),
    getSession: () => notConfigured(),
  },
} as const;
