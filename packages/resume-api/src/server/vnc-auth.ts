import { createCipheriv } from "node:crypto";
import { connect, createServer, type Socket } from "node:net";

/** VNC authentication uses DES with each password byte's bits reversed. */
export function vncChallengeResponse(password: string, challenge: Buffer): Buffer {
  if (challenge.length !== 16) throw new Error("Invalid VNC challenge.");
  const key = Buffer.alloc(8);
  Buffer.from(password, "latin1").copy(key, 0, 0, 8);
  for (let i = 0; i < key.length; i++) {
    let reversed = 0;
    for (let bit = 0; bit < 8; bit++)
      reversed |= ((key[i] >> bit) & 1) << (7 - bit);
    key[i] = reversed;
  }
  // DES-EDE3 with the same key repeated three times equals single DES.
  // des-ede3 remains available on Node/OpenSSL builds without legacy providers.
  const cipher = createCipheriv("des-ede3", Buffer.concat([key, key, key]), null);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(challenge), cipher.final()]);
}

/** Buffer exact RFB protocol bytes during authentication, then release the socket. */
class Reader {
  private buffered = Buffer.alloc(0);
  private waiting?: { count: number; resolve: (data: Buffer) => void; reject: (error: Error) => void };
  private readonly onData = (chunk: Buffer) => {
    this.buffered = Buffer.concat([this.buffered, chunk]);
    if (this.buffered.length > 65536) {
      this.socket.destroy();
      return;
    }
    this.flush();
  };
  private readonly onClose = () => this.waiting?.reject(new Error("VNC connection closed."));
  private readonly onError = () => this.waiting?.reject(new Error("VNC connection failed."));

  constructor(private readonly socket: Socket) {
    socket.on("data", this.onData);
    socket.on("close", this.onClose);
    socket.on("error", this.onError);
  }

  take(count: number): Promise<Buffer> {
    if (this.waiting) throw new Error("Concurrent VNC reads are not supported.");
    if (this.buffered.length >= count) {
      const result = this.buffered.subarray(0, count);
      this.buffered = this.buffered.subarray(count);
      return Promise.resolve(result);
    }
    return new Promise((resolve, reject) => {
      this.waiting = { count, resolve, reject };
    });
  }

  private flush() {
    const waiting = this.waiting;
    if (!waiting || this.buffered.length < waiting.count) return;
    this.waiting = undefined;
    const result = this.buffered.subarray(0, waiting.count);
    this.buffered = this.buffered.subarray(waiting.count);
    waiting.resolve(result);
  }

  release(): Buffer {
    this.socket.off("data", this.onData);
    this.socket.off("close", this.onClose);
    this.socket.off("error", this.onError);
    return this.buffered;
  }
}

/**
 * Bridge the browser's passwordless RFB connection to a password-protected
 * localhost x11vnc server. The password is only handled by this Node process.
 * The bridge is reachable solely through the session-checked WebSocket proxy.
 */
export function createAuthenticatedVncBridge(password: string, upstreamPort = 5900) {
  if (!password) throw new Error("WEB_VNC_PASSWORD is required for the viewer.");
  return createServer((viewer) => {
    const backend = connect(upstreamPort, "127.0.0.1");
    const browser = new Reader(viewer);
    const server = new Reader(backend);
    const close = () => {
      viewer.destroy();
      backend.destroy();
    };
    void (async () => {
      const version = await server.take(12);
      if (!/^RFB 003\.00[78]\n$/.test(version.toString("ascii")))
        throw new Error("Unsupported VNC protocol version.");
      viewer.write(version);
      const browserVersion = await browser.take(12);
      if (!/^RFB 003\.00[78]\n$/.test(browserVersion.toString("ascii")))
        throw new Error("Unsupported viewer protocol version.");
      backend.write(browserVersion);
      const count = (await server.take(1))[0];
      if (!count) throw new Error("VNC security negotiation failed.");
      const types = await server.take(count);
      if (!types.includes(2)) throw new Error("VNC password authentication is unavailable.");
      // Present security type None to noVNC, but use type 2 with x11vnc locally.
      viewer.write(Buffer.from([1, 1]));
      if ((await browser.take(1))[0] !== 1)
        throw new Error("Unexpected viewer security selection.");
      backend.write(Buffer.from([2]));
      backend.write(vncChallengeResponse(password, await server.take(16)));
      const result = await server.take(4);
      viewer.write(result);
      if (result.readUInt32BE(0) !== 0)
        throw new Error("Internal VNC authentication failed.");
      // The remainder is ordinary RFB and can be forwarded as raw TCP bytes.
      const pendingViewer = browser.release();
      const pendingBackend = server.release();
      if (pendingViewer.length) backend.write(pendingViewer);
      if (pendingBackend.length) viewer.write(pendingBackend);
      viewer.on("error", close);
      backend.on("error", close);
      viewer.on("close", () => backend.destroy());
      backend.on("close", () => viewer.destroy());
      viewer.pipe(backend);
      backend.pipe(viewer);
    })().catch(close);
  });
}
