// A minimal Chrome DevTools Protocol client over the built-in WebSocket, so it
// runs unchanged in Deno (edge functions, against a hosted browser) and in
// Node 22 (local dry runs, against a local Chrome). Nothing to install.

export interface Page {
  send: (method: string, params?: Record<string, unknown>) => Promise<any>;
  /** Runs `fn` in the page with one JSON argument and returns its JSON result. */
  evaluate: (fn: (arg: any) => unknown, arg?: unknown) => Promise<any>;
  close: () => void;
}

/** Opens a fresh tab on the browser behind `browserWsUrl` (a browser-level endpoint). */
export async function openPage(browserWsUrl: string): Promise<Page> {
  const socket = new WebSocket(browserWsUrl);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = () => reject(new Error('Could not connect to the browser.'));
  });

  let nextId = 1;
  const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
  socket.onmessage = (event) => {
    const message = JSON.parse(String(event.data));
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
  };
  socket.onclose = () => {
    for (const waiter of pending.values()) waiter.reject(new Error('The browser closed the connection.'));
    pending.clear();
  };

  const call = (method: string, params: Record<string, unknown> = {}, sessionId?: string) =>
    new Promise<any>((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params, sessionId }));
    });

  const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
  const send = (method: string, params: Record<string, unknown> = {}) => call(method, params, sessionId);

  return {
    send,
    evaluate: async (fn, arg) => {
      const reply = await send('Runtime.evaluate', {
        expression: `(${fn.toString()})(${JSON.stringify(arg ?? null)})`,
        awaitPromise: true,
        returnByValue: true,
      });
      if (reply.exceptionDetails) {
        throw new Error(reply.exceptionDetails.exception?.description || reply.exceptionDetails.text);
      }
      return reply.result.value;
    },
    close: () => socket.close(),
  };
}
