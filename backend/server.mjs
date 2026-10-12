// server/public-host.ts
import http from "node:http";
import { access } from "node:fs/promises";
import path5 from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// server/public-call.ts
import { createHash as createHash2, randomBytes as randomBytes2, timingSafeEqual as timingSafeEqual2 } from "node:crypto";
import { readFile as readFile3, mkdir as mkdir2, writeFile, rename, rm } from "node:fs/promises";
import path4 from "node:path";
import { WebSocketServer as WebSocketServer2 } from "ws";
import { z as z3 } from "zod";

// server/public-call-story.ts
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readFile, copyFile } from "node:fs/promises";
import os from "node:os";
import path2 from "node:path";
import { z } from "zod";

// server/project-paths.ts
import path from "node:path";
var defaultDemoId = "northstar-v4";
function projectFile(root, id) {
  if (id === defaultDemoId) return path.join(root, ".northstar/project.json");
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)) throw new Error("Invalid demo ID");
  return path.join(root, ".northstar/demos", id, "project.json");
}
var projectAudioDir = (root, id) => id === defaultDemoId ? path.join(root, "public/audio") : path.join(path.dirname(projectFile(root, id)), "audio");

// src/wav.ts
function inspectWav(bytes, mime = "audio/wav") {
  if (!/^audio\/(wav|wave|x-wav)(;|$)/i.test(mime)) throw new Error(`Expected WAV MIME, received ${mime}`);
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (n) => String.fromCharCode(...bytes.slice(n, n + 4));
  if (bytes.length < 44 || tag(0) !== "RIFF" || tag(8) !== "WAVE" || v.getUint32(4, true) + 8 !== bytes.length) throw new Error("Invalid RIFF/WAVE length or header");
  let rate = 0, channels = 0, bits = 0, block = 0, byteRate = 0, dataSize = 0;
  for (let offset = 12; offset + 8 <= bytes.length; ) {
    const size = v.getUint32(offset + 4, true), start = offset + 8;
    if (start + size > bytes.length) throw new Error("Truncated WAV chunk");
    if (tag(offset) === "fmt ") {
      if (size < 16 || v.getUint16(start, true) !== 1) throw new Error("Expected PCM WAV master");
      channels = v.getUint16(start + 2, true);
      rate = v.getUint32(start + 4, true);
      byteRate = v.getUint32(start + 8, true);
      block = v.getUint16(start + 12, true);
      bits = v.getUint16(start + 14, true);
    }
    if (tag(offset) === "data") dataSize += size;
    offset = start + size + size % 2;
  }
  if (![1, 2].includes(channels) || rate < 8e3 || rate > 192e3 || ![8, 16, 24, 32].includes(bits) || block !== channels * bits / 8 || byteRate !== rate * block || dataSize <= 0 || dataSize % block) throw new Error("Invalid WAV format or empty audio");
  return { sampleRate: rate, channels, bits, duration: dataSize / byteRate };
}

// server/public-call-story.ts
var storySchema = z.object({ format: z.literal("voice-demo"), version: z.literal(1), scenes: z.array(z.object({ cues: z.array(z.object({ speaker: z.enum(["ELAINE", "BEN_CARTER"]), text: z.string().min(1) })) })) });
async function preparePublicCallStory(root) {
  const story = storySchema.parse(JSON.parse(await readFile(path2.join(root, "walkthrough/order-status/story.json"), "utf8")));
  const directory = await mkdtemp(path2.join(os.tmpdir(), "cedar-public-call-")), projectId = randomUUID(), audioDir = projectAudioDir(directory, projectId);
  await mkdir(audioDir, { recursive: true });
  const counters = { MAYA: 0, BEN_CARTER: 0 }, cues = [], inventory = [];
  const hashes = [];
  for (const scene of story.scenes) for (const cue of scene.cues) {
    const speaker = cue.speaker === "ELAINE" ? "MAYA" : "BEN_CARTER", id = `${speaker}-${String(++counters[speaker]).padStart(2, "0")}`, file = id + ".wav";
    const source = path2.join(root, "walkthrough/order-status/audio", id.replace(/^MAYA-/, "ELAINE-") + ".wav"), bytes = await readFile(source);
    inspectWav(bytes);
    await copyFile(source, path2.join(audioDir, file));
    hashes.push(createHash("sha256").update(bytes).digest("hex"));
    cues.push({ id, type: "speech", speaker, presenterMode: { live: "prerecorded" } });
    inventory.push({ id, status: "current", asset: { kind: "tts", file } });
  }
  if (counters.MAYA !== 5 || counters.BEN_CARTER !== 7) throw new Error("The prepared public call needs five Maya and seven Ben recordings.");
  const snapshot = { projectId, revision: createHash("sha256").update(JSON.stringify({ story, hashes })).digest("hex"), cues, inventory };
  const service = { root: directory, async snapshot() {
    return structuredClone(snapshot);
  } };
  return { service, directory };
}

// server/error.ts
var StudioError = class extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
  status;
};

// server/twilio.ts
import { randomUUID as randomUUID2, randomBytes, timingSafeEqual } from "node:crypto";
import { readFile as readFile2 } from "node:fs/promises";
import path3 from "node:path";
import twilio from "twilio";
import { WebSocket, WebSocketServer } from "ws";
import { z as z2 } from "zod";

// server/telephony-audio.ts
function wavToMulaw(bytes) {
  const { sampleRate, channels, bits, duration } = inspectWav(bytes);
  if (duration > 300) throw new Error("Customer cues must be five minutes or shorter.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks = [];
  for (let offset = 12; offset + 8 <= bytes.length; ) {
    const size = view.getUint32(offset + 4, true);
    if (String.fromCharCode(...bytes.slice(offset, offset + 4)) === "data") chunks.push(bytes.subarray(offset + 8, offset + 8 + size));
    offset += 8 + size + size % 2;
  }
  const pcm = Buffer.concat(chunks), data = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const block = channels * bits / 8, frames = pcm.length / block;
  const sample = (frame) => {
    let sum = 0;
    for (let channel = 0; channel < channels; channel++) {
      const offset = frame * block + channel * bits / 8;
      if (bits === 8) sum += (data.getUint8(offset) - 128) * 256;
      else if (bits === 16) sum += data.getInt16(offset, true);
      else if (bits === 24) {
        const n = data.getUint8(offset) | data.getUint8(offset + 1) << 8 | data.getUint8(offset + 2) << 16;
        sum += (n << 8 >> 8) / 256;
      } else sum += data.getInt32(offset, true) / 65536;
    }
    return sum / channels;
  };
  const output = Buffer.alloc(Math.max(1, Math.round(frames * 8e3 / sampleRate)));
  for (let i = 0; i < output.length; i++) {
    const start = i * sampleRate / 8e3, end = Math.min(frames, (i + 1) * sampleRate / 8e3);
    let total = 0, weight = 0;
    for (let frame = Math.floor(start); frame < end; frame++) {
      const fraction = Math.min(frame + 1, end) - Math.max(frame, start);
      total += sample(frame) * fraction;
      weight += fraction;
    }
    output[i] = linearToMulaw(weight ? Math.round(total / weight) : 0);
  }
  return output;
}
function linearToMulaw(value) {
  const sign = value < 0 ? 128 : 0;
  let sample = Math.min(32635, Math.abs(value)) + 132;
  let exponent = 7;
  for (let mask = 16384; exponent > 0 && !(sample & mask); mask >>= 1) exponent--;
  return ~(sign | exponent << 4 | sample >> exponent + 3 & 15) & 255;
}

// src/twilio.ts
var terminalCallStatuses = ["completed", "busy", "failed", "no-answer", "canceled"];
var callIsActive = (call) => !!call && !terminalCallStatuses.includes(call.status);

// server/twilio.ts
var phone = z2.string().regex(/^\+[1-9]\d{7,14}$/, "Use an international phone number, for example +441234567890.");
var startSchema = z2.object({ revision: z2.string(), customer: z2.string(), human: z2.string().nullable(), to: phone });
var playSchema = z2.object({ callId: z2.string().uuid(), revision: z2.string(), cueId: z2.string(), playbackId: z2.string().uuid() });
var TwilioService = class {
  constructor(studio, env = process.env, api, options = {}) {
    this.studio = studio;
    this.env = env;
    this.api = api;
    this.options = options;
  }
  studio;
  env;
  api;
  options;
  session = null;
  publicOrigin() {
    try {
      const url = new URL(this.env.TWILIO_PUBLIC_URL ?? "");
      if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/" || url.port && url.port !== "443") return "";
      return url.origin;
    } catch {
      return "";
    }
  }
  snapshot() {
    const missing = [];
    if (!/^AC[a-f0-9]{32}$/i.test(this.env.TWILIO_ACCOUNT_SID ?? "")) missing.push("TWILIO_ACCOUNT_SID");
    if (!this.env.TWILIO_AUTH_TOKEN) missing.push("TWILIO_AUTH_TOKEN");
    if (!phone.safeParse(this.env.TWILIO_FROM_NUMBER).success) missing.push("TWILIO_FROM_NUMBER");
    if (!this.publicOrigin()) missing.push("TWILIO_PUBLIC_URL (public HTTPS origin)");
    return { configured: !missing.length, missing, from: this.env.TWILIO_FROM_NUMBER ?? "", defaultTo: this.env.TWILIO_TO_NUMBER ?? "", call: this.session ? structuredClone(this.session.call) : null };
  }
  voiceApi() {
    if (this.api) return this.api;
    const client = twilio(this.env.TWILIO_ACCOUNT_SID, this.env.TWILIO_AUTH_TOKEN, { timeout: 15e3, autoRetry: false });
    return { create: (options) => client.calls.create(options), end: (sid) => client.calls(sid).update({ status: "completed" }) };
  }
  requireSession(id) {
    if (!this.session || this.session.call.id !== id) throw new StudioError("Customer call changed. Refresh the call panel.", 409);
    return this.session;
  }
  async start(input) {
    const data = startSchema.parse(input), settings = this.snapshot();
    if (!settings.configured) throw new StudioError(`Configure ${settings.missing.join(", ")} on the server first.`);
    if (callIsActive(this.session?.call ?? null)) throw new StudioError("End the existing customer call before starting another.", 409);
    const snapshot = await this.studio.snapshot();
    if (snapshot.revision !== data.revision) throw new StudioError("Project changed. Refresh before starting a call.", 409);
    const speakers = new Set(snapshot.cues.filter((c) => c.type === "speech").map((c) => c.speaker));
    if (!speakers.has(data.customer) || data.human !== null && (!speakers.has(data.human) || data.human === data.customer)) throw new StudioError("Choose a customer and a different human participant.");
    if (snapshot.cues.some((c) => c.speaker === data.customer && c.presenterMode.live === "await-live-response")) throw new StudioError("The customer must be a prerecorded participant. Change their live behavior in Demo configuration first.");
    if (callIsActive(this.session?.call ?? null)) throw new StudioError("A customer call is already starting.", 409);
    const session = { call: { id: randomUUID2(), callSid: null, projectId: snapshot.projectId, revision: snapshot.revision, customer: data.customer, human: data.human, to: data.to, status: "starting", connected: false, playback: null }, token: randomBytes(32).toString("hex"), generation: 0, canceled: /* @__PURE__ */ new Set(), callbackSequence: -1 };
    this.session = session;
    const response = new twilio.twiml.VoiceResponse();
    response.connect().stream({ url: this.publicOrigin().replace("https:", "wss:") + (this.options.streamPath ?? "/twilio/media") }).parameter({ name: "session", value: session.token });
    response.hangup();
    try {
      const result = await this.voiceApi().create({
        to: data.to,
        from: settings.from,
        twiml: response.toString(),
        record: false,
        timeout: 45,
        timeLimit: this.options.timeLimit ?? 3600,
        statusCallback: `${this.publicOrigin()}${this.options.statusPath ?? "/twilio/status"}?session=${session.token}`,
        statusCallbackMethod: "POST",
        statusCallbackEvent: ["initiated", "ringing", "answered", "completed"]
      });
      if (session.call.callSid && session.call.callSid !== result.sid) throw new Error("Call identity mismatch");
      session.call.callSid = result.sid;
      if (session.call.status === "starting") session.call.status = result.status;
    } catch (error) {
      const status = error.status;
      if (!session.call.callSid) session.call.status = status && status >= 400 && status < 500 ? "failed" : "unknown";
      throw new StudioError(session.call.status === "unknown" ? "Twilio did not confirm the call request. Check the Twilio console before retrying; the call may exist." : `Twilio could not start the call${status ? ` (HTTP ${status})` : ""}. Check the credentials, caller number and destination in Twilio.`, 502);
    }
    return this.snapshot();
  }
  send(session, value) {
    if (!session.socket || session.socket.readyState !== WebSocket.OPEN || !session.streamSid) throw new StudioError("Customer audio is disconnected. End the call and reconnect.", 409);
    session.socket.send(JSON.stringify({ ...value, streamSid: session.streamSid }), (error) => {
      if (error) this.disconnected(session);
    });
  }
  stop(id, playbackId) {
    const session = this.requireSession(id);
    if (playbackId) {
      session.canceled.add(playbackId);
      if (session.canceled.size > 1e3) session.canceled.delete(session.canceled.values().next().value);
      if (session.call.playback?.id !== playbackId) return this.snapshot();
    }
    session.generation++;
    clearTimeout(session.timer);
    clearTimeout(session.watchdog);
    if (session.call.playback?.status === "playing") session.call.playback.status = "stopped";
    if (session.call.connected) this.send(session, { event: "clear" });
    return this.snapshot();
  }
  async end(id) {
    const session = this.requireSession(id);
    if (!session.call.callSid) throw new StudioError("Call identity is pending. Check Twilio for an unconfirmed call before retrying.", 409);
    this.stop(id);
    try {
      await this.voiceApi().end(session.call.callSid);
    } catch {
      throw new StudioError("Twilio could not confirm hangup. Retry End call or end it in the Twilio console.", 502);
    }
    session.call.status = "completed";
    session.call.connected = false;
    session.socket?.close();
    return this.snapshot();
  }
  async play(input) {
    const data = playSchema.parse(input), session = this.requireSession(data.callId);
    if (!callIsActive(session.call) || !session.call.connected) throw new StudioError("Wait for the customer call to connect before playing.", 409);
    if (data.revision !== session.call.revision) throw new StudioError("Project changed. End the call and start a new one.", 409);
    if (session.canceled.has(data.playbackId)) throw new StudioError("Playback was canceled.", 409);
    if (session.call.playback?.id === data.playbackId) return this.snapshot();
    this.stop(data.callId);
    const generation = session.generation;
    const snapshot = await this.studio.snapshot();
    if (snapshot.projectId !== session.call.projectId || snapshot.revision !== data.revision) throw new StudioError("Project changed. End the call and start a new one.", 409);
    const cue = snapshot.cues.find((c) => c.id === data.cueId), item = snapshot.inventory.find((i) => i.id === data.cueId);
    if (!cue || cue.type !== "speech" || !(this.options.permittedSpeakers ?? [session.call.customer]).includes(cue.speaker ?? "") || cue.presenterMode.live === "await-live-response") throw new StudioError("Only the selected customer can send audio into this call.");
    if (item?.status !== "current" || item.asset?.kind !== "tts") throw new StudioError("Generate a current speech recording before sending this cue to Twilio. Test tones and changed recordings cannot be sent.");
    const bytes = await readFile2(path3.join(projectAudioDir(this.studio.root, snapshot.projectId), item.asset.file));
    const audio = wavToMulaw(bytes);
    if (session !== this.session || generation !== session.generation || session.canceled.has(data.playbackId) || !session.call.connected) throw new StudioError("Playback was canceled.", 409);
    session.call.playback = { id: data.playbackId, cueId: cue.id, status: "playing" };
    let offset = 0;
    const pump = () => {
      if (generation !== session.generation || !session.call.connected || session.call.playback?.status !== "playing") return;
      try {
        if (offset < audio.length) {
          this.send(session, { event: "media", media: { payload: audio.subarray(offset, offset + 160).toString("base64") } });
          offset += 160;
          session.timer = setTimeout(pump, 20);
        } else {
          this.send(session, { event: "mark", mark: { name: data.playbackId } });
          session.watchdog = setTimeout(() => {
            if (session.call.playback?.id === data.playbackId && session.call.playback.status === "playing") {
              this.stop(data.callId);
              session.call.playback.status = "failed";
            }
          }, 3e4);
        }
      } catch {
        this.disconnected(session);
      }
    };
    pump();
    return this.snapshot();
  }
  liveAudio(id, bytes) {
    const session = this.requireSession(id);
    if (!session.call.connected || !bytes.length || bytes.length > 4096) throw new StudioError("Live audio is unavailable.", 409);
    this.send(session, { event: "media", media: { payload: bytes.toString("base64") } });
  }
  validSignature(signature, route, params = {}, websocket = false) {
    if (typeof signature !== "string" || !this.env.TWILIO_AUTH_TOKEN || !this.publicOrigin()) return false;
    const url = this.publicOrigin() + route;
    const candidates = websocket ? [url, url + "/", url.replace("https:", "wss:"), url.replace("https:", "wss:") + "/"] : [url];
    return candidates.some((candidate) => twilio.validateRequest(this.env.TWILIO_AUTH_TOKEN, signature, candidate, params));
  }
  matchesToken(token, session) {
    if (typeof token !== "string") return false;
    const received = Buffer.from(token), expected = Buffer.from(session.token);
    return received.length === expected.length && timingSafeEqual(received, expected);
  }
  callback(route, params) {
    const session = this.session, token = new URL(route, "http://localhost").searchParams.get("session");
    if (!session || !this.matchesToken(token, session) || params.AccountSid !== this.env.TWILIO_ACCOUNT_SID || !/^CA[a-f0-9]{32}$/i.test(String(params.CallSid)) || session.call.callSid && params.CallSid !== session.call.callSid) return;
    session.call.callSid ??= String(params.CallSid);
    const sequence = Number(params.SequenceNumber);
    if (!Number.isInteger(sequence) || sequence < session.callbackSequence || terminalCallStatuses.includes(session.call.status)) return;
    session.callbackSequence = sequence;
    if (typeof params.CallStatus === "string" && ["queued", "initiated", "ringing", "in-progress", ...terminalCallStatuses].includes(params.CallStatus)) {
      if (!session.call.connected || terminalCallStatuses.includes(params.CallStatus)) session.call.status = params.CallStatus;
      if (terminalCallStatuses.includes(params.CallStatus)) {
        this.stop(session.call.id);
        session.call.connected = false;
        session.socket?.close();
      }
    }
  }
  disconnected(session) {
    clearTimeout(session.timer);
    clearTimeout(session.watchdog);
    session.generation++;
    session.call.connected = false;
    if (session.call.playback?.status === "playing") session.call.playback.status = "failed";
    session.socket = void 0;
  }
  accept(socket) {
    console.info("Twilio media socket opened");
    let firstFrame = true;
    socket.on("close", (code) => console.info("Twilio media socket closed", code));
    let bound;
    const startup = setTimeout(() => socket.close(1008, "Start required"), 1e4);
    socket.on("error", () => {
      if (bound) this.disconnected(bound);
    });
    socket.on("close", () => {
      clearTimeout(startup);
      if (bound && bound.socket === socket) this.disconnected(bound);
    });
    socket.on("message", (raw) => {
      if (firstFrame) {
        firstFrame = false;
        console.info("Twilio media first frame received");
      }
      try {
        const message = JSON.parse(raw.toString());
        if (message.event === "start") {
          const session = this.session, start = message.start;
          if (bound || !session || !callIsActive(session.call) || session.socket || !this.matchesToken(start?.customParameters?.session, session) || start?.accountSid !== this.env.TWILIO_ACCOUNT_SID || !/^CA[a-f0-9]{32}$/i.test(start?.callSid ?? "") || session.call.callSid && start.callSid !== session.call.callSid || !/^MZ[a-f0-9]{32}$/i.test(start?.streamSid ?? "") || start.mediaFormat?.encoding !== "audio/x-mulaw" || start.mediaFormat?.sampleRate !== 8e3 || start.mediaFormat?.channels !== 1) {
            socket.close(1008, "Invalid session");
            return;
          }
          clearTimeout(startup);
          bound = session;
          session.socket = socket;
          session.streamSid = start.streamSid;
          session.call.callSid = start.callSid;
          session.call.connected = true;
          session.call.status = "in-progress";
        } else if (bound && message.streamSid === bound.streamSid && message.event === "mark") {
          const playback = bound.call.playback;
          if (playback?.status === "playing" && message.mark?.name === playback.id) {
            playback.status = "finished";
            clearTimeout(bound.watchdog);
          }
        } else if (bound && message.event === "stop") {
          this.disconnected(bound);
          socket.close();
        }
      } catch {
        socket.close(1008, "Invalid message");
      }
    });
  }
};
function attachTwilioStream(server, service) {
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  server.on("upgrade", (req, socket, head) => {
    const mediaPath = service.options.streamPath ?? "/twilio/media";
    if (req.url?.split("?")[0] !== mediaPath) return;
    if (req.url !== mediaPath || !service.validSignature(req.headers["x-twilio-signature"], req.url, {}, true)) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    sockets.handleUpgrade(req, socket, head, (ws) => service.accept(ws));
  });
  server.on("close", () => {
    for (const socket of sockets.clients) socket.terminate();
    sockets.close();
  });
}

// server/public-call.ts
var prefix = "/public-demo";
var hash = (value) => createHash2("sha256").update(value).digest();
var same = (a, b) => timingSafeEqual2(hash(a), hash(b));
var startSchema2 = z3.strictObject({ pin: z3.string().min(1).max(100), to: z3.string().regex(/^\+447(?:[1-5]|[7-9])\d{8}$/, "Enter a UK mobile number in international format (+44\u2026)."), ownNumber: z3.literal(true) });
var PublicCallService = class {
  constructor(root, env = process.env, api) {
    this.root = root;
    this.env = env;
    this.api = api;
  }
  root;
  env;
  api;
  prepared;
  bridge;
  access;
  starting = false;
  attempts = /* @__PURE__ */ new Map();
  requests = /* @__PURE__ */ new Map();
  allowedOrigin(origin) {
    return typeof origin === "string" && [this.env.PUBLIC_DEMO_ORIGIN, "http://127.0.0.1:5173"].includes(origin);
  }
  async ready() {
    this.prepared ??= preparePublicCallStory(this.root);
    const { service } = await this.prepared;
    this.bridge ??= new TwilioService(service, this.env, this.api, { streamPath: prefix + "/twilio/media", statusPath: prefix + "/twilio/status", timeLimit: 240, permittedSpeakers: ["MAYA", "BEN_CARTER"] });
    return this.bridge;
  }
  limited(map, key, max, seconds) {
    for (const [key2, item2] of map) if (item2.expires < Date.now()) map.delete(key2);
    if (map.size > 1e3 && !map.has(key)) throw new StudioError("Please wait before retrying.", 429);
    let item = map.get(key);
    if (!item) {
      item = { count: 0, expires: Date.now() + seconds * 1e3 };
      map.set(key, item);
    }
    if (++item.count > max) throw new StudioError("Please wait before retrying.", 429);
  }
  async reserve(to) {
    const file = path4.join(this.root, ".northstar/public-call-budget.json"), today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    let budget = { day: today, total: 0, numbers: {}, last: 0 };
    try {
      budget = JSON.parse(await readFile3(file, "utf8"));
    } catch (e) {
      if (e.code !== "ENOENT") throw new StudioError("Call testing is temporarily unavailable.", 503);
    }
    if (budget.day !== today) budget = { day: today, total: 0, numbers: {}, last: budget.last };
    const number = hash(to).toString("hex");
    if (budget.total >= 20 || (budget.numbers[number] ?? 0) >= 3) throw new StudioError("The demo call allowance has been reached. Please try another day.", 429);
    if (Date.now() - budget.last < 6e4) throw new StudioError("Please allow one minute between demo calls.", 429);
    budget.total++;
    budget.numbers[number] = (budget.numbers[number] ?? 0) + 1;
    budget.last = Date.now();
    await mkdir2(path4.dirname(file), { recursive: true });
    await writeFile(file + ".tmp", JSON.stringify(budget), { mode: 384 });
    await rename(file + ".tmp", file);
  }
  async start(input, ip) {
    if (!this.env.PUBLIC_DEMO_PIN || !this.env.PUBLIC_DEMO_ORIGIN) throw new StudioError("Live call testing is currently unavailable. You can still explore the walkthrough.", 503);
    this.limited(this.attempts, ip, 8, 900);
    this.limited(this.attempts, "all", 50, 900);
    const value = startSchema2.parse(input);
    if (!same(value.pin, this.env.PUBLIC_DEMO_PIN)) throw new StudioError("The access code was not accepted.", 403);
    if (this.starting || callIsActive(this.bridge?.snapshot().call ?? null)) throw new StudioError("Another tester is on a call. Please try again shortly.", 409);
    this.starting = true;
    try {
      const bridge = await this.ready();
      if (!bridge.snapshot().configured) throw new StudioError("Live call testing is currently unavailable.", 503);
      if (this.env.PUBLIC_DEMO_CALL_LIMITS !== "0") await this.reserve(value.to);
      const snapshot = await bridge.studio.snapshot();
      this.access?.socket?.close();
      clearTimeout(this.access?.timer);
      this.access = void 0;
      const result = await bridge.start({ revision: snapshot.revision, customer: "MAYA", human: "BEN_CARTER", to: value.to });
      const access2 = { token: randomBytes2(32).toString("hex"), callId: result.call.id, expires: Date.now() + 285e3, mode: "recorded" };
      this.access = access2;
      access2.timer = setTimeout(() => {
        void bridge.end(access2.callId).catch(() => {
        });
        access2.socket?.close();
      }, 28e4);
      access2.timer.unref?.();
      return { token: access2.token, ...this.state(access2.token) };
    } finally {
      this.starting = false;
    }
  }
  authorize(token) {
    const access2 = this.access;
    if (typeof token !== "string" || !access2 || access2.expires < Date.now() || !same(token, access2.token)) throw new StudioError("This call session has expired. Start a new call.", 403);
    this.limited(this.requests, access2.token, 120, 60);
    return access2;
  }
  state(token) {
    const access2 = this.authorize(token), call = this.bridge.snapshot().call;
    return { call: call && { id: call.id, to: call.to, status: call.status, connected: call.connected, playback: call.playback }, mode: access2.mode };
  }
  async action(action, token, input) {
    const access2 = this.authorize(token), bridge = this.bridge;
    if (action === "play") {
      const cueId = z3.string().regex(/^(MAYA|BEN_CARTER)-\d{2}$/).parse(input.cueId);
      if (access2.mode === "live" && cueId.startsWith("BEN_CARTER")) throw new StudioError("Delegate Ben\u2019s voice before playing his recording.", 409);
      await bridge.play({ callId: access2.callId, revision: bridge.snapshot().call.revision, cueId, playbackId: z3.string().uuid().parse(input.playbackId) });
    } else if (action === "stop") bridge.stop(access2.callId);
    else if (action === "mode") {
      const mode = z3.enum(["recorded", "live"]).parse(input.mode);
      if (bridge.snapshot().call?.playback?.cueId.startsWith("BEN_CARTER")) bridge.stop(access2.callId);
      access2.mode = mode;
      if (mode === "recorded") {
        access2.socket?.close();
        access2.socket = void 0;
      }
    } else if (action === "end") {
      await bridge.end(access2.callId);
      clearTimeout(access2.timer);
      access2.socket?.close();
    } else throw new StudioError("Not found.", 404);
    return this.state(token);
  }
  async callback(req, data) {
    const bridge = await this.ready(), form = new URLSearchParams(data), params = {};
    for (const name of new Set(form.keys())) {
      const values = form.getAll(name);
      params[name] = values.length === 1 ? values[0] : values;
    }
    if (!bridge.validSignature(req.headers["x-twilio-signature"], req.url, params)) throw new StudioError("Invalid Twilio signature.", 403);
    bridge.callback(req.url, params);
    if (!callIsActive(bridge.snapshot().call)) {
      clearTimeout(this.access?.timer);
      this.access?.socket?.close();
    }
  }
  async attach(server) {
    const bridge = await this.ready();
    attachTwilioStream(server, bridge);
    const sockets = new WebSocketServer2({ noServer: true, maxPayload: 4096 });
    server.on("upgrade", (req, socket, head) => {
      if (req.url?.split("?")[0] !== prefix + "/presenter") return;
      if (req.url !== prefix + "/presenter" || !this.allowedOrigin(req.headers.origin)) {
        socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
        socket.destroy();
        return;
      }
      sockets.handleUpgrade(req, socket, head, (ws) => {
        console.info("Presenter socket opened");
        let firstFrame = true;
        ws.on("close", (code) => console.info("Presenter socket closed", code));
        let bound, received = 0, period = Date.now();
        const timeout = setTimeout(() => ws.close(1008), 5e3);
        ws.on("error", () => {
        });
        ws.on("close", () => {
          clearTimeout(timeout);
          if (bound?.socket === ws) bound.socket = void 0;
        });
        ws.on("message", (raw, binary) => {
          if (firstFrame) {
            firstFrame = false;
            console.info("Presenter first frame received");
          }
          try {
            if (!bound) {
              if (binary) throw new Error();
              const access2 = this.authorize(JSON.parse(raw.toString()).token);
              if (access2.mode !== "live" || access2.socket || !bridge.snapshot().call?.connected) throw new Error();
              clearTimeout(timeout);
              bound = access2;
              access2.socket = ws;
              ws.send(JSON.stringify({ ready: true }));
              return;
            }
            if (!binary || bound !== this.access || bound.mode !== "live" || bound.expires < Date.now()) throw new Error();
            if (Date.now() - period >= 1e3) {
              period = Date.now();
              received = 0;
            }
            received += Buffer.byteLength(raw);
            if (received > 12e3) throw new Error();
            if (bridge.snapshot().call?.playback?.status !== "playing") bridge.liveAudio(bound.callId, Buffer.from(raw));
          } catch {
            ws.close(1008, "Live audio unavailable");
          }
        });
      });
    });
    server.on("close", () => {
      clearTimeout(this.access?.timer);
      for (const socket of sockets.clients) socket.terminate();
      sockets.close();
      void this.prepared?.then(({ directory }) => rm(directory, { recursive: true, force: true })).catch(() => {
      });
    });
  }
};
async function body(req) {
  let result = "";
  for await (const chunk of req) {
    result += chunk;
    if (Buffer.byteLength(result) > 8192) throw new StudioError("Request too large.", 413);
  }
  return result;
}
function publicCallMiddleware(service) {
  return async (req, res, next) => {
    const route = req.url?.split("?")[0];
    if (!route?.startsWith(prefix + "/")) {
      next();
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json");
    try {
      if (route === prefix + "/twilio/status" && req.method === "POST") {
        if (!req.headers["content-type"]?.startsWith("application/x-www-form-urlencoded")) throw new StudioError("Expected form data.", 400);
        await service.callback(req, await body(req));
        res.statusCode = 204;
        res.end();
        return;
      }
      if (!service.allowedOrigin(req.headers.origin)) throw new StudioError("Use the published demo page.", 403);
      res.setHeader("Access-Control-Allow-Origin", String(req.headers.origin));
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, ngrok-skip-browser-warning");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      if (req.method === "OPTIONS") {
        res.statusCode = 204;
        res.end();
        return;
      }
      if (req.method !== "POST" || !req.headers["content-type"]?.startsWith("application/json")) throw new StudioError("Expected JSON.", 405);
      const input = JSON.parse(await body(req));
      if (!input || Array.isArray(input) || typeof input !== "object") throw new Error();
      const token = req.headers.authorization?.replace(/^Bearer /, "");
      const result = route === prefix + "/start" ? await service.start(input, String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress).split(",")[0].trim()) : route === prefix + "/state" ? service.state(token) : await service.action(route.slice(prefix.length + 1), token, input);
      res.end(JSON.stringify(result));
    } catch (e) {
      res.statusCode = e instanceof StudioError ? e.status : 400;
      res.end(JSON.stringify({ error: e instanceof StudioError ? e.message : "Check the mobile number and try again." }));
    }
  };
}

// server/public-host.ts
async function createHostedCallServer(root, environment = process.env, api) {
  const env = { ...environment, TWILIO_PUBLIC_URL: environment.RENDER_EXTERNAL_URL ?? environment.TWILIO_PUBLIC_URL };
  for (const key of ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER", "TWILIO_PUBLIC_URL", "PUBLIC_DEMO_PIN", "PUBLIC_DEMO_ORIGIN"]) if (!env[key]) throw new Error(`Missing server setting: ${key}`);
  const service = new PublicCallService(root, env, api), middleware = publicCallMiddleware(service);
  const server = http.createServer((req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store");
    if (req.url === "/healthz" && ["GET", "HEAD"].includes(req.method ?? "")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(req.method === "HEAD" ? void 0 : '{"status":"ok"}');
      return;
    }
    void middleware(req, res, () => {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end('{"error":"Not found."}');
    });
  });
  server.requestTimeout = 15e3;
  server.headersTimeout = 1e4;
  await service.attach(server);
  server.on("upgrade", (req, socket) => {
    if (!["/public-demo/twilio/media", "/public-demo/presenter"].includes(req.url ?? "")) socket.destroy();
  });
  return { server, service };
}
async function main() {
  const root = path5.dirname(fileURLToPath(import.meta.url));
  await access(path5.join(root, "walkthrough/order-status/story.json"));
  const { server } = await createHostedCallServer(root);
  const port = Number(process.env.PORT ?? 1e4);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  server.listen(port, "0.0.0.0", () => console.log(`Ben and Maya call backend listening on port ${port}`));
  let draining = false;
  const shutdown = () => {
    if (draining) return;
    draining = true;
    server.close(() => process.exit(0));
    server.closeAllConnections();
    const timer = setTimeout(() => process.exit(0), 5e3);
    timer.unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path5.resolve(process.argv[1])).href) void main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
export {
  createHostedCallServer
};
