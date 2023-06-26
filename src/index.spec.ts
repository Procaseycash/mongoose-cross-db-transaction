import { ClientSession, Connection } from 'mongoose';
import { SessionConfig, withTransaction } from './index';
import expect from 'expect';

const connection = {
  startSession: () => {
    return connection;
  },
  endSession: () => 2,
  withTransaction: (cb) => cb(),
} as unknown as Connection;

describe('mongoose-cross-db-transaction', () => {
  describe('when NODE_ENV is set to local', () => {
    it('Should not run db transaction and session is set to undefined', async () => {
      process.env.NODE_ENV = 'local';
      const action = async (storeResult, session) => {
        expect(session).toEqual(undefined);
        expect(storeResult.length).toEqual(0);
      };
      await withTransaction({ connection, action } as SessionConfig);
    });
  });

  describe('when NODE_ENV is not set to local', () => {
    it('Should run db transaction and session is not undefined', async () => {
      process.env.NODE_ENV = 'development';
      const action = async (storeResult, session) => {
        expect(session).toEqual(connection);
        expect(storeResult.length).toEqual(0);
      };
      await withTransaction({ connection, action } as SessionConfig);
    });
  });

  describe('when using a single children session', () => {
    it('Should run db transaction and session is not undefined', async () => {
      process.env.NODE_ENV = 'development';

      const action = async (storeResult, session) => {
        expect(session).toEqual(connection);
        expect(storeResult.length).toEqual(0);
        return 1;
      };

      const action2 = async (storeResult, session) => {
        expect(session).toEqual(connection);
        expect(storeResult.length).toEqual(1);
        expect(storeResult[0]).toEqual(1); // result of action 1;
      };

      await withTransaction({
        connection,
        action,
        childrenSessions: [{ connection, action: action2 }],
      } as SessionConfig);
    });
  });

  describe('when using a multiple children session', () => {
    it('Should run db transaction and session is not undefined', async () => {
      process.env.NODE_ENV = 'development';

      const action = async (storeResult, session) => {
        expect(session).toEqual(connection);
        expect(storeResult.length).toEqual(0);
        return 1;
      };

      const action2 = async (storeResult, session) => {
        expect(session).toEqual(connection);
        expect(storeResult.length).toEqual(1);
        expect(storeResult[0]).toEqual(1); // result of action 1;
        return 2;
      };

      const action3 = async (storeResult, session) => {
        expect(session).toEqual(connection);
        expect(storeResult.length).toEqual(2);
        expect(storeResult).toEqual([1, 2]); // result of action 1;
      };

      await withTransaction({
        connection,
        action,
        childrenSessions: [
          { connection, action: action2 },
          { connection, action: action3 },
        ],
      } as SessionConfig);
    });
  });

  describe('when using a multiple level children session', () => {
    it('Should run db transaction and session is not undefined', async () => {
      process.env.NODE_ENV = 'development';

      const action = async (storeResult, session) => {
        expect(session).toEqual(connection);
        expect(storeResult.length).toEqual(0);
        return 1;
      };

      const action2 = async (storeResult, session) => {
        expect(session).toEqual(connection);
        expect(storeResult.length).toEqual(1);
        expect(storeResult[0]).toEqual(1); // result of action 1;
        return 2;
      };

      const action3 = async (storeResult, session) => {
        expect(session).toEqual(connection);
        expect(storeResult.length).toEqual(2);
        expect(storeResult).toEqual([1, 2]); // result of action 1-2;
        return 3;
      };

      const action4 = async (storeResult, session) => {
        expect(session).toEqual(connection);
        expect(storeResult.length).toEqual(3);
        expect(storeResult).toEqual([1, 2, 3]); // result of action 1-3;
        return 4;
      };

      const action5 = async (storeResult, session) => {
        expect(session).toEqual(connection);
        expect(storeResult.length).toEqual(2);
        expect(storeResult).toEqual([1, 2]); // result of action 1 & 2 as the earlier runs from parent and first children they are grouped together;
        return 5;
      };

      const action6 = async (storeResult, session) => {
        expect(session).toEqual(connection);
        expect(storeResult.length).toEqual(3);
        expect(storeResult).toEqual([1, 2, 5]); // result of action 1,2,5;
        return 6;
      };

      const action7 = async (storeResult, session) => {
        expect(session).toEqual(connection);
        expect(storeResult.length).toEqual(4);
        expect(storeResult).toEqual([1, 2, 5, 6]); // result of action 1,2,5,6;
        return 7;
      };

      await withTransaction({
        connection,
        action,
        childrenSessions: [
          {
            connection,
            action: action2,
            childrenSessions: [
              { connection, action: action3 },
              { connection, action: action4 },
            ],
          },
          {
            connection,
            action: action5,
            childrenSessions: [
              { connection, action: action6 },
              { connection, action: action7 },
            ],
          },
        ],
      } as SessionConfig);
    });
  });
});
