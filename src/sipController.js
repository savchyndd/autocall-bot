require("dotenv").config();
const https = require("https");
const path = require("path");
const fs = require("fs");
const wav = require("wav");

const wrtc = require("wrtc");
const { nonstandard } = require("wrtc");

const JsSIP = require("jssip");
const NodeWebSocket = require("jssip-node-websocket");

const { JSDOM } = require("jsdom");

// Initialize global objects for WebRTC & window
function initializeGlobalObjects() {
  global.RTCPeerConnection = wrtc.RTCPeerConnection;
  global.RTCSessionDescription = wrtc.RTCSessionDescription;
  global.RTCIceCandidate = wrtc.RTCIceCandidate;
  global.MediaStream = wrtc.MediaStream;
  global.MediaStreamTrack = wrtc.MediaStreamTrack;
  global.navigator = {
    mediaDevices: wrtc.mediaDevices,
    getUserMedia: wrtc.mediaDevices.getUserMedia,
  };

  global.window = new JSDOM().window;
  global.document = window.document;

  global.window.RTCPeerConnection = global.RTCPeerConnection;
  global.window.RTCSessionDescription = global.RTCSessionDescription;
  global.window.RTCIceCandidate = global.RTCIceCandidate;
  global.window.MediaStream = global.MediaStream;
  global.window.MediaStreamTrack = global.MediaStreamTrack;
  global.window.navigator = global.navigator;
}
initializeGlobalObjects();

const audioFilePath = path.join(__dirname, "audio", "audio_8khz_10s.wav");
const telephony = {
  sipInternalNumber: process.env.SIP_INTERNAL_NUMBER,
  login: process.env.SIP_LOGIN,
};
const extraHeaders = [`line: ${telephony.sipInternalNumber}${telephony.login}`];

function createUserAgent() {
  const socket = new NodeWebSocket(process.env.SIP_WS_SERVER, {
    origin: `https://${process.env.SIP_DOMAIN}`,
    requestOptions: {
      agent: new https.Agent({ rejectUnauthorized: false }),
    },
  });

  const configuration = {
    domain: process.env.SIP_DOMAIN,
    sockets: [socket],
    uri: process.env.SIP_URI,
    ws_servers: process.env.SIP_WS_SERVER,
    password: process.env.SIP_PASSWORD,
    display_name: process.env.SIP_DISPLAY_NAME,
    debug: true,
  };

  // Create User Agent
  const userAgent = new JsSIP.UA(configuration);
  userAgent.registrator().setExtraHeaders(extraHeaders);

  // User Agent Events
  userAgent.on("connected", () => {
    console.log("Connected to the SIP server successfully.");
  });

  userAgent.on("disconnected", (error) => {
    console.log(
      "Disconnected from the SIP server. Reconnecting in 3 seconds...",
      error
    );
  });

  userAgent.on("registered", () => {
    console.log("Registered to the SIP server.");
  });

  userAgent.on("unregistered", () => {
    console.log("Unregistered from the SIP server.");
  });

  userAgent.on("registrationFailed", (data) => {
    console.log(`Registration failed: ${data.cause}`);
  });

  userAgent.on("newRTCSession", (data) => {
    console.log("New RTC session initiated.");
  });

  userAgent.on("sipEvent", (data) => {
    console.log(`SIP event: ${data.type}`);
  });

  return userAgent;
}

// Initiate call
const initiateCall = async (userAgent, target, res) => {
  console.log(`Attempting to call ${target}...`);
  console.log(`SIP status:`, {
    connected: userAgent.isConnected(),
    registered: userAgent.isRegistered(),
  });

  // const audioStream = await createAudioStreamFromWav(audioFilePath);
  // console.log("Audio Stream:", audioStream.getTracks());
  const callOptions = {
    extraHeaders,
    mediaConstraints: { audio: true, video: false },
    // mediaStream: audioStream,
  };

  try {
    const session = await userAgent.call(
      `sip:${target}@sipavtocall.com.ua`,
      callOptions
    );

    session.on("accepted", () => {
      console.log(`Call to ${target} has been accepted!`);
    });

    session.on("confirmed", async () => {
      console.log(`Call to ${target} has been confirmed!`);

      const audioStream = await createAudioStreamFromWav(audioFilePath);
      const trackToAdd = audioStream.getTracks()[0];
      console.log("trackToAdd", {
        id: trackToAdd.id,
        kind: trackToAdd.kind,
        label: trackToAdd.label,
        muted: trackToAdd.muted,
        readyState: trackToAdd.readyState,
      });

      if (trackToAdd) {
        session.connection.addTrack(trackToAdd);
        console.log("Audio stream added to connection.");
      } else {
        console.error("No valid audio track found to add.");
      }

      session.connection.oniceconnectionstatechange = () => {
        console.log("Connection established, ready to send audio.");
      };
      session.connection.ontrack = (event) => {
        console.log("Track received:", event.track);
      };
    });

    session.on("ended", () => {
      console.log(`Call to ${target} ended successfully.`);
      res.json({ message: `Call to ${target} ended.` });
    });

    session.on("failed", (data) => {
      console.log(`Call to ${target} failed: ${data.cause}`);
      res.status(500).json({ error: `Call failed: ${data.cause}` });
    });
  } catch (error) {
    console.error("Error during call initiation:", error);
    res.status(500).json({ error: "Call initiation failed." });
  }
};
async function createAudioStreamFromWav(filePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`Audio file not found at path: ${filePath}`));
    }

    const audioSource = new nonstandard.RTCAudioSource();
    const mediaStream = new wrtc.MediaStream();
    const track = audioSource.createTrack();
    console.log("Track before creating MediaStream id:", track.id);

    if (!track) {
      return reject(new Error("Failed to create audio track."));
    }

    if (!(track instanceof wrtc.MediaStreamTrack)) {
      return reject(
        new Error("Created track is not an instance of MediaStreamTrack.")
      );
    }
    mediaStream.addTrack(track);
    console.log(
      "MediaStream tracks length:",
      mediaStream.getAudioTracks().length
    );

    const fileStream = fs.createReadStream(filePath);
    const reader = new wav.Reader();

    reader.on("format", (format) => {
      console.log("format", format);

      if (format.audioFormat !== 1 || format.bitDepth !== 16) {
        return reject(
          new Error("Unsupported audio format. Only 16-bit PCM is supported.")
        );
      }

      let buffer = Buffer.alloc(0);
      const chunkSize = 160; // 10 ms at 8000 Hz

      fileStream.on("data", (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);

        while (buffer.length >= chunkSize) {
          const audioChunk = buffer.subarray(0, chunkSize);
          buffer = buffer.subarray(chunkSize);

          const samples = new Int16Array(
            chunkSize / Int16Array.BYTES_PER_ELEMENT
          );
          for (let i = 0; i < samples.length; i++) {
            samples[i] = audioChunk.readInt16LE(i * 2);
          }

          // console.log("Sending audio data to audioSource:", samples);
          // console.log("Sending byte length:", samples.byteLength);

          // Sending data to RTCAudioSource
          audioSource.onData({
            samples,
            sampleRate: format.sampleRate,
            bitsPerSample: format.bitDepth,
            channelCount: format.channels,
          });
        }

        if (buffer.length > 0 && buffer.length < chunkSize) {
          const paddedBuffer = Buffer.alloc(chunkSize, 0);
          buffer.copy(paddedBuffer);
          const samples = new Int16Array(
            chunkSize / Int16Array.BYTES_PER_ELEMENT
          );
          for (let i = 0; i < samples.length; i++) {
            samples[i] = paddedBuffer.readInt16LE(i * 2);
          }

          audioSource.onData({
            samples,
            sampleRate: format.sampleRate,
            bitsPerSample: format.bitDepth,
            channelCount: format.channels,
          });
        }
      });

      fileStream.destroy();
      // Finished reading audio file
      fileStream.on("close", () => {
        console.log("Audio file fully read and streamed.");

        resolve(mediaStream);
      });

      fileStream.on("error", (err) => {
        console.error("Error reading audio file:", err);
        reject(err);
      });
    });

    fileStream.pipe(reader);
  });
}

const createAndRegister = () => {
  const userAgent = createUserAgent();
  userAgent.start();

  return userAgent;
};

module.exports = { createAndRegister, initiateCall };
