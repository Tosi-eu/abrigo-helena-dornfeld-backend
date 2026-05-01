import { Connection, Client } from '@temporalio/client';

export function envTemporalAddress(): string {
  return process.env.TEMPORAL_ADDRESS?.trim() || 'temporal:7233';
}

export function envTemporalNamespace(): string {
  return process.env.TEMPORAL_NAMESPACE?.trim() || 'default';
}

export function envTemporalTaskQueue(): string {
  return process.env.TEMPORAL_TASK_QUEUE?.trim() || 'abrigo';
}

let cached: { client: Client; close: () => Promise<void> } | null = null;

export async function getTemporalClient(): Promise<{
  client: Client;
  close: () => Promise<void>;
}> {
  if (cached) return cached;

  const connection = await Connection.connect({
    address: envTemporalAddress(),
  });
  const client = new Client({
    connection,
    namespace: envTemporalNamespace(),
  });
  cached = {
    client,
    close: async () => {
      try {
        await connection.close();
      } finally {
        cached = null;
      }
    },
  };
  return cached;
}
