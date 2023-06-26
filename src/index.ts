import { ClientSession, Connection } from 'mongoose';

export type actionFunction = (
  sequenceResultStore: any[],
  session: ClientSession | undefined,
) => Promise<any>;

export type SessionConfig = {
  connection: Connection;
  action: actionFunction;
  childrenSessions?: SessionConfig[];
};

export const withTransaction = async (config: SessionConfig) => {
  const isLocal = process.env?.NODE_ENV?.toLowerCase() === 'local';
  const transactionOptions = {
    readConcern: { level: 'majority' },
    writeConcern: { w: 'majority' },
    readPreference: 'primary',
    maxCommitTimeMS: 300_000,
    causalConsistency: true,
  } as any;
  const allSessions: ClientSession[] = [] as any;

  const withChildTransaction = async (
    sessionConfigs: SessionConfig[],
    ...store: any[]
  ) => {
    if (!sessionConfigs || !sessionConfigs.length) return true;
    for await (let sessionConfig of sessionConfigs) {
      const { connection, action, childrenSessions } = sessionConfig;
      const childSession: ClientSession = await connection.startSession();
      allSessions.push(childSession);
      const _session = isLocal ? undefined : childSession;
      await childSession.withTransaction(async () => {
        const result = await action?.(store, _session);
        store.push(result);
        await withChildTransaction(childrenSessions || [], ...store);
        return true;
      }, transactionOptions);
    }
    return true;
  };

  try {
    const { connection, action, childrenSessions } = config;
    const session: ClientSession = await connection.startSession();
    allSessions.push(session);
    const _session = isLocal ? undefined : session;
    await session.withTransaction(async () => {
      const result = await action?.([], _session);
      await withChildTransaction(childrenSessions || [], result);
      return true;
    }, transactionOptions);
  } finally {
    // End the sessions and close the clients
    await Promise.all(
      allSessions.map((ses_: ClientSession) => ses_.endSession()) as any,
    );
  }
};
