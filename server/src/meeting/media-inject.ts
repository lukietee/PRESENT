import type { BrowserContext, Page } from "playwright";
import {
  EXPOSE_PUSH_MEETING_PCM,
  WINDOW_AUDIO_DESTINATION,
  WINDOW_AVATAR_CANVAS,
  WINDOW_AVATAR_CTX,
  WINDOW_MEETING_MIC_SOURCES,
} from "./page-contract.js";

export function meetingMediaInitScriptPayload(): {
  windowAvatarCanvas: string;
  windowAvatarCtx: string;
  windowAudioDestination: string;
} {
  return {
    windowAvatarCanvas: WINDOW_AVATAR_CANVAS,
    windowAvatarCtx: WINDOW_AVATAR_CTX,
    windowAudioDestination: WINDOW_AUDIO_DESTINATION,
  };
}

function buildMeetingMediaInitScript(): string {
  const kCanvas = WINDOW_AVATAR_CANVAS;
  const kCtx = WINDOW_AVATAR_CTX;
  const kDest = WINDOW_AUDIO_DESTINATION;
  const kMicSources = WINDOW_MEETING_MIC_SOURCES;
  const kPush = EXPOSE_PUSH_MEETING_PCM;

  return `(() => {
  const CANVAS_KEY = ${JSON.stringify(kCanvas)};
  const CTX_KEY = ${JSON.stringify(kCtx)};
  const DEST_KEY = ${JSON.stringify(kDest)};
  const MIC_SOURCES_KEY = ${JSON.stringify(kMicSources)};
  const PUSH_NAME = ${JSON.stringify(kPush)};

  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const ctx2d = canvas.getContext("2d");
  if (ctx2d) {
    ctx2d.fillStyle = "#222222";
    ctx2d.fillRect(0, 0, 1280, 720);
  }
  canvas.style.position = "fixed";
  canvas.style.left = "-9999px";
  canvas.style.top = "0";
  canvas.style.width = "1px";
  canvas.style.height = "1px";
  canvas.style.opacity = "0.01";
  canvas.style.pointerEvents = "none";
  if (document.documentElement) {
    document.documentElement.appendChild(canvas);
  }

  window[CANVAS_KEY] = canvas;
  window[CTX_KEY] = ctx2d;

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioCtx({ sampleRate: 48000 });
  const destination = audioCtx.createMediaStreamDestination();
  window[DEST_KEY] = destination;
  window[MIC_SOURCES_KEY] = [];

  const origGetUserMedia = navigator.mediaDevices.getUserMedia.bind(
    navigator.mediaDevices
  );
  navigator.mediaDevices.getUserMedia = async function (constraints) {
    const c =
      constraints && typeof constraints === "object" ? constraints : {};
    const wantVideo = !!c.video;
    const wantAudio = !!c.audio;
    if (!wantVideo && !wantAudio) {
      return origGetUserMedia(constraints);
    }
    const stream = new MediaStream();
    if (wantVideo) {
      const cnv = window[CANVAS_KEY];
      const vStream = cnv.captureStream(30);
      vStream.getVideoTracks().forEach(function (t) {
        stream.addTrack(t);
      });
    }
    if (wantAudio) {
      const dest = window[DEST_KEY];
      dest.stream.getAudioTracks().forEach(function (t) {
        stream.addTrack(t);
      });
    }
    return stream;
  };

  window.__presentAttachRemoteAudio = function (track) {
    if (!track || track.kind !== "audio") return;
    const ctx16 = new AudioCtx({ sampleRate: 16000 });
    const src = ctx16.createMediaStreamSource(new MediaStream([track]));
    const proc = ctx16.createScriptProcessor(4096, 1, 1);
    const gain = ctx16.createGain();
    gain.gain.value = 0;
    src.connect(proc);
    proc.connect(gain);
    gain.connect(ctx16.destination);
    proc.onaudioprocess = function (e) {
      var input = e.inputBuffer.getChannelData(0);
      var n = input.length;
      var out = new Int16Array(n);
      for (var i = 0; i < n; i++) {
        var s = input[i];
        if (s > 1) s = 1;
        else if (s < -1) s = -1;
        out[i] = s < 0 ? s * 32768 : s * 32767;
      }
      var fn = window[PUSH_NAME];
      if (typeof fn === "function") {
        fn(Array.prototype.slice.call(out));
      }
    };
  };

  const OrigRTC = window.RTCPeerConnection;
  if (typeof OrigRTC === "function") {
    window.RTCPeerConnection = new Proxy(OrigRTC, {
      construct: function (Target, args, newTarget) {
        var pc = Reflect.construct(Target, args, newTarget);
        pc.addEventListener("track", function (ev) {
          if (
            ev.track &&
            ev.track.kind === "audio" &&
            typeof window.__presentAttachRemoteAudio === "function"
          ) {
            window.__presentAttachRemoteAudio(ev.track);
          }
        });
        return pc;
      },
    });
  }
})();`;
}

export async function addMeetingMediaInitScript(
  context: BrowserContext
): Promise<void> {
  await context.addInitScript({ content: buildMeetingMediaInitScript() });
}

export async function exposeMeetingPcmBridge(
  page: Page,
  onPcm: (buf: Buffer) => void
): Promise<void> {
  await page.exposeFunction(EXPOSE_PUSH_MEETING_PCM, (samples: number[]) => {
    const buf = Buffer.allocUnsafe(samples.length * 2);
    for (let i = 0; i < samples.length; i++) {
      let x = Math.trunc(samples[i]);
      if (x > 32767) x = 32767;
      if (x < -32768) x = -32768;
      buf.writeInt16LE(x, i * 2);
    }
    onPcm(buf);
  });
}

export async function registerMeetingMediaOnContext(
  context: BrowserContext,
  onPcm16k?: (buf: Buffer) => void
): Promise<void> {
  await addMeetingMediaInitScript(context);
  if (!onPcm16k) return;
  const attach = async (page: Page) => {
    await exposeMeetingPcmBridge(page, onPcm16k);
  };
  for (const page of context.pages()) {
    await attach(page);
  }
  context.on("page", (page) => {
    void attach(page);
  });
}

export async function playPcm48kToMeetingMic(
  page: Page,
  pcmInt16LE: Buffer,
  sampleRate: number
): Promise<void> {
  const destKey = WINDOW_AUDIO_DESTINATION;
  const micSourcesKey = WINDOW_MEETING_MIC_SOURCES;
  const b64 = pcmInt16LE.toString("base64");
  await page.evaluate(
    ({ destKey: dk, micSourcesKey: msk, pcmBase64, inRate }) => {
      const dest = Reflect.get(window, dk) as MediaStreamAudioDestinationNode | undefined;
      if (!dest || !dest.context) {
        throw new Error("Meeting audio destination not ready");
      }
      const ctx = dest.context;
      const binary = atob(pcmBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const n = bytes.length >> 1;
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const pcm = new Int16Array(n);
      for (let i = 0; i < n; i++) {
        pcm[i] = view.getInt16(i * 2, true);
      }
      const float = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        float[i] = pcm[i] / 32768;
      }
      const outRate = ctx.sampleRate;
      let samples: Float32Array = float;
      if (inRate !== outRate) {
        const ratio = outRate / inRate;
        const outLen = Math.max(1, Math.floor(n * ratio));
        const out = new Float32Array(outLen);
        for (let i = 0; i < outLen; i++) {
          const x = i / ratio;
          const j = Math.floor(x);
          const f = x - j;
          const a = float[j] ?? 0;
          const b = float[j + 1] ?? a;
          out[i] = a + (b - a) * f;
        }
        samples = out;
      }
      const buffer = ctx.createBuffer(1, samples.length, outRate);
      buffer.getChannelData(0).set(samples);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(dest);
      const micSources = Reflect.get(window, msk);
      if (Array.isArray(micSources)) {
        micSources.push(src);
        src.onended = function () {
          const arr = Reflect.get(window, msk);
          if (!Array.isArray(arr)) return;
          const idx = arr.indexOf(src);
          if (idx >= 0) arr.splice(idx, 1);
        };
      }
      src.start();
    },
    { destKey, micSourcesKey, pcmBase64: b64, inRate: sampleRate }
  );
}

export async function stopAllMeetingMicPlayback(page: Page): Promise<void> {
  const micSourcesKey = WINDOW_MEETING_MIC_SOURCES;
  await page.evaluate((k) => {
    const arr = Reflect.get(window, k);
    if (!Array.isArray(arr)) return;
    for (let i = 0; i < arr.length; i++) {
      const node = arr[i];
      if (node && typeof node.stop === "function") {
        try {
          node.stop();
        } catch (_e) {
          /* already stopped */
        }
      }
    }
    arr.length = 0;
  }, micSourcesKey);
}
