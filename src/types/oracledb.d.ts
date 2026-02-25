declare module 'oracledb' {
  export const OUT_FORMAT_OBJECT: number;
  export function createPool(config: PoolAttributes): Promise<Pool>;
  export let initOracleClient: ((cfg?: ClientOpts) => void) | undefined;

  export interface ClientOpts { libDir?: string; configDir?: string; }
  export interface PoolAttributes {
    user?: string; password?: string; connectString?: string;
    poolMax?: number; poolMin?: number; poolIncrement?: number;
    poolTimeout?: number; stmtCacheSize?: number;
  }
  export interface Pool {
    getConnection(): Promise<Connection>;
    close(drain?: number): Promise<void>;
    terminate(drain?: number): Promise<void>;
  }
  export interface Connection {
    execute<T = Record<string, unknown>>(
      sql: string,
      bindParams?: Record<string, unknown> | unknown[],
      options?: ExecuteOptions
    ): Promise<Result<T>>;
    close(): Promise<void>;
    release(): Promise<void>;
  }
  export interface ExecuteOptions {
    outFormat?: number;
    maxRows?: number;
    fetchArraySize?: number;
    autoCommit?: boolean;
    resultSet?: boolean;
  }
  export interface Result<T> {
    rows?: T[];
    rowsAffected?: number;
    metaData?: MetaData[];
    lastRowid?: string;
  }
  export interface MetaData {
    name: string;
    fetchType?: number;
    dbType?: number;
    nullable?: boolean;
    precision?: number;
    scale?: number;
    byteSize?: number;
  }
}
