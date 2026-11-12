import assert from "node:assert/strict";
import test from "node:test";
import { subscribeWithInitialFetch } from "../../lib/initial-subscription";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test("direct read renders before a stalled realtime connection, then accepts live updates", async () => {
  const read = deferred<string>();
  const values: string[] = [];
  let live!: (value: string) => void;
  let reads = 0;
  const stop = subscribeWithInitialFetch<string>((publish) => { live = publish; return () => {}; }, () => { reads++; return read.promise; }, (value) => values.push(value));
  assert.equal(reads, 1, "start the direct read immediately");
  read.resolve("initial messages");
  await read.promise;
  assert.deepEqual(values, ["initial messages"]);
  live("new message");
  assert.deepEqual(values, ["initial messages", "new message"]);
  stop();
});

test("a slow initial read cannot replace newer live messages", async () => {
  const read = deferred<string>();
  const values: string[] = [];
  let live!: (value: string) => void;
  const stop = subscribeWithInitialFetch<string>((publish) => { live = publish; return () => {}; }, () => read.promise, (value) => values.push(value));
  live("newer messages");
  read.resolve("older messages");
  await read.promise;
  assert.deepEqual(values, ["newer messages"]);
  stop();
});

test("leaving a chat prevents late reads and live callbacks from updating it", async () => {
  const read = deferred<string>();
  const values: string[] = [];
  let live!: (value: string) => void;
  let unsubscribed = false;
  const stop = subscribeWithInitialFetch<string>((publish) => { live = publish; return () => { unsubscribed = true; }; }, () => read.promise, (value) => values.push(value));
  stop();
  read.resolve("previous chat");
  await read.promise;
  live("previous chat update");
  assert.equal(unsubscribed, true);
  assert.deepEqual(values, []);
});

test("a failed direct read leaves the realtime connection usable", async () => {
  const read = deferred<string>();
  const values: string[] = [];
  let live!: (value: string) => void;
  const stop = subscribeWithInitialFetch<string>((publish) => { live = publish; return () => {}; }, () => read.promise, (value) => values.push(value));
  read.reject(new Error("offline"));
  await read.promise.catch(() => undefined);
  live("reconnected");
  assert.deepEqual(values, ["reconnected"]);
  stop();
});
