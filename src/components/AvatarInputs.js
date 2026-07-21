import { emitAvatarEvent } from './events.js';
import { getStoredUiLanguage, getUiText } from './i18n.js';
import { BACKEND } from './constants.js';

class AvatarInputs extends HTMLElement {
  connectedCallback() {
    this.classList.add('avatar-inputs');
    this.innerHTML = `
  <div class="chat-composer">
    <textarea class="chat-input" rows="1" placeholder="Type a message..." aria-label="Type a message..."></textarea>
    <div class="composer-actions">

      <!-- Microphone Button -->
      <button type="button" id="mic-btn" title="Toggle microphone" aria-label="Toggle microphone">
        <svg xmlns="http://w3.org" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
          <path d="M19 10v1a7 7 0 0 1-14 0v-1"/>
          <line x1="12" x2="12" y1="19" y2="22"/>
        </svg>
      </button>

      <!-- Send Button -->
<!-- Paper Airplane Send Button (Pointing Directly Right/East) -->
<button type="button" id="send-btn" title="Send message" aria-label="Send message">
  <svg xmlns="http://w3.org" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 12 2 21l3-9-3-9Z"></path>
    <path d="M5 12h17"></path>
  </svg>
</button>




    </div>
  </div>

    `;
    this.cacheNodes();
    this.bindEvents();
    this.applyUiLanguage(getStoredUiLanguage());
    this.recognizer = null;
    this.isListening = false;
    this.finalTranscript = '';
    this.recognitionLanguage = 'en-US';
    // MediaRecorder captures the raw audio in parallel with SpeechRecognition
    // above. SpeechRecognition still drives the live interim captions (it's
    // instant and free), but the recorded audio is what actually gets
    // transcribed via the backend's Whisper endpoint once listening stops —
    // Whisper is meaningfully more accurate than the browser API.
    this.mediaRecorder = null;
    this.mediaStream = null;
    this.audioChunks = [];
    this.isTranscribing = false;
    this.isSpeaking = false;
    this.isThinking = false;
    this.isLoadingAvatar = false;
    this._typingActive = false;
    window.addEventListener('avatar:set-response-language', (event) => {
      const language = event.detail?.language;
      this.recognitionLanguage = language === 'ja' ? 'ja-JP' : 'en-US';
    });
    window.addEventListener('avatar:speaking', (event) => {
      this.isSpeaking = Boolean(event.detail?.active);
      this.refreshInputAvailability();
    });
    window.addEventListener('avatar:thinking', (event) => {
      this.isThinking = Boolean(event.detail?.active);
      this.refreshInputAvailability();
    });
    window.addEventListener('avatar:avatar-loading', (event) => {
      this.isLoadingAvatar = Boolean(event.detail?.active);
      this.refreshInputAvailability();
    });
  }

  cacheNodes() {
    this.input = this.querySelector('.chat-input');
    this.sendBtn = this.querySelector('#send-btn');
    this.micBtn = this.querySelector('#mic-btn');
    this._restoreStatusOnEnd = true;
  }

  bindEvents() {
    this.input?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.submitMessage();
      }
    });

    this.input?.addEventListener('input', () => {
      this.input.style.height = '38px';
      this.input.style.height = `${Math.min(this.input.scrollHeight, 160)}px`;
      this.updateTypingState();
    });

    this.sendBtn?.addEventListener('click', () => this.submitMessage());
    this.micBtn?.addEventListener('click', () => this.toggleMic());
  }

  applyUiLanguage(language = 'en') {
    const text = getUiText(language);
    if (this.input) {
      this.input.placeholder = text.placeholder;
    }
    if (this.sendBtn) {
      this.sendBtn.textContent = text.send;
      this.sendBtn.setAttribute('title', text.send);
    }
    if (this.micBtn) {
      this.micBtn.setAttribute('title', text.micTitle);
    }
  }

  submitMessage() {
    if (this.isTranscribing || this.isSpeaking || this.isThinking || this.isLoadingAvatar) return;
    const text = String(this.input?.value || '').trim();
    if (!text) return;
    this.input.value = '';
    this.input.style.height = '38px';
    // Clearing .value programmatically doesn't fire a native 'input' event,
    // so the typing-detection listener above never sees this transition —
    // drop the listening pose explicitly here instead.
    this.updateTypingState();
    emitAvatarEvent('ask', { text });
  }

  // Fires avatar:listening only on actual start/stop transitions (not every
  // keystroke) so the pose doesn't restart mid-typing. Also updates the
  // status pill the same way the mic path already does ("Listening…" while
  // recording) — typing gets its own "Typing…" text for the same reason.
  updateTypingState() {
    const hasText = Boolean(this.input?.value.trim());
    if (hasText && !this._typingActive) {
      this._typingActive = true;
      emitAvatarEvent('listening', { active: true });

      if (!this.isTranscribing) {
        emitAvatarEvent('update-status', { text: 'Listening…', color: 'yellow' });
      }
    } else if (!hasText && this._typingActive) {
      this._typingActive = false;
      emitAvatarEvent('listening', { active: false });
      if (!this.isTranscribing) {
        emitAvatarEvent('update-status', { text: 'Ready', color: 'green' });
      }
    }
  }

  // Locks the send button + Enter-to-send while a mic recording or the
  // /stt request is in flight, so the user can't submit before the
  // transcript has actually landed in the input. Also drives the
  // "listening" avatar pose for the same window (recording → transcribing).
setTranscribing(active) {
  this.isTranscribing = active;
  emitAvatarEvent('listening', { active });
  if (this.input) {
    if (active) {
      this._prevPlaceholder = this.input.placeholder;
      this.input.placeholder = 'Transcribing…';
    } else if (this._prevPlaceholder !== undefined) {
      this.input.placeholder = this._prevPlaceholder;
    }
  }
  this.refreshInputAvailability();
}

  // Disables text entry, the mic button, and send while the character is
  // talking (speaking), thinking (waiting on the backend), or loading a
  // newly-selected avatar — i.e. any state where a new message shouldn't
  // be queued up yet. Voice recording (isTranscribing) already locked the
  // send button on its own; it's folded into the same check here.
  refreshInputAvailability() {
  const busy = this.isSpeaking || this.isThinking || this.isLoadingAvatar;
  const inputBusy = busy || this.isTranscribing;

  if (this.input) {
    this.input.disabled = inputBusy;
    this.input.classList.toggle('is-disabled', inputBusy);
  }
  if (this.micBtn) {
    this.micBtn.disabled = busy;
    this.micBtn.classList.toggle('is-disabled', busy);
  }
  if (this.sendBtn) {
    const sendDisabled = busy || this.isTranscribing;
    this.sendBtn.disabled = sendDisabled;
    this.sendBtn.classList.toggle('is-disabled', sendDisabled);
  }
}

  initRecognizer() {
    const Engine = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Engine) {
      emitAvatarEvent('update-status', { text: 'Speech recognition not supported.', color: 'red' });
      return null;
    }

    const recognizer = new Engine();
    recognizer.continuous = true;
    recognizer.interimResults = true;
    recognizer.maxAlternatives = 1;

    recognizer.onstart = () => {
      this.isListening = true;
      this.micBtn?.classList.add('active');
      this.micBtn?.setAttribute('aria-pressed', 'true');
      emitAvatarEvent('update-status', { text: 'Listening…', color: 'yellow' });
    };

    recognizer.onresult = (event) => {
      let interimText = '';
      let finalText = '';

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript || '';
        if (result.isFinal) {
          finalText += transcript;
        } else {
          interimText += transcript;
        }
      }

      if (finalText) {
        this.finalTranscript += finalText;
      }

      const nextValue = `${this.finalTranscript} ${interimText}`.trim();
      if (this.input) {
        this.input.value = nextValue;
        this.input.style.height = '38px';
        this.input.style.height = `${Math.min(this.input.scrollHeight, 160)}px`;
      }
    };

    recognizer.onerror = (event) => {
      emitAvatarEvent('update-status', { text: `Mic error: ${event.error || 'unknown'}`, color: 'red' });
      this.stopListening(false);
    };

    recognizer.onend = () => {
      this.isListening = false;
      this.micBtn?.classList.remove('active');
      this.micBtn?.setAttribute('aria-pressed', 'false');
      if (this._restoreStatusOnEnd) {
        emitAvatarEvent('update-status', { text: 'Ready', color: 'green' });
      }
      this._restoreStatusOnEnd = true;
    };

    return recognizer;
  }

  async toggleMic() {
    if (this.isSpeaking || this.isThinking || this.isLoadingAvatar) return;
    if (this.isListening) {
      this.stopListening();
      return;
    }

    if (!this.recognizer) {
      this.recognizer = this.initRecognizer();
    }

    if (!this.recognizer) return;

    let stream;
    try {
      // Explicit constraints (rather than a bare `{ audio: true }`) so we
      // don't rely on the browser's defaults for these — noise suppression
      // in particular matters a lot for transcription accuracy.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (error) {
      emitAvatarEvent('update-status', { text: 'Microphone blocked — allow it in browser settings', color: 'red' });
      return;
    }

    this.mediaStream = stream;
    this.audioChunks = [];
    this.mediaRecorder = this.initMediaRecorder(stream);
    this.mediaRecorder?.start();

    this.finalTranscript = '';
    this.recognizer.lang = this.recognitionLanguage;
    try {
      this.recognizer.start();
      // Locked from the moment listening starts (not just during the
      // backend request) — otherwise the send button/Enter stays clickable
      // for the entire recording, which is the whole point of the lock.
      this.setTranscribing(true);
    } catch (error) {
      emitAvatarEvent('update-status', { text: 'Could not start microphone', color: 'red' });
      this.mediaRecorder?.stop();
      stream.getTracks().forEach((track) => track.stop());
    }
  }

  initMediaRecorder(stream) {
    if (typeof window === 'undefined' || !window.MediaRecorder) return null;
    const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
    const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported?.(type));

    let recorder;
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch (error) {
      return null;
    }

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) this.audioChunks.push(event.data);
    };

    return recorder;
  }

  stopListening(restoreStatus = true) {
    if (!this.recognizer) return;
    try {
      this.recognizer.stop();
    } catch (error) {
      // ignore
    }
    this.isListening = false;
    this.micBtn?.classList.remove('active');
    this.micBtn?.setAttribute('aria-pressed', 'false');
    this._restoreStatusOnEnd = restoreStatus;

    if (restoreStatus) {
      this._restoreStatusOnEnd = false;
      this.finishRecordingAndTranscribe();
    } else {
      // Error path (e.g. recognizer.onerror already set a "Mic error…"
      // status) — just release the recorder/stream without transcribing,
      // so we don't overwrite that message with "Transcribing…".
      this.cleanupRecording();
    }
  }

  cleanupRecording() {
    const recorder = this.mediaRecorder;
    const stream = this.mediaStream;
    this.mediaRecorder = null;
    this.mediaStream = null;
    this.audioChunks = [];
    try { recorder?.stop(); } catch (error) { /* ignore */ }
    stream?.getTracks().forEach((track) => track.stop());
    this.setTranscribing(false);
  }

  // Stops the parallel MediaRecorder capture, ships the recorded audio to
  // the backend's Whisper endpoint, and — if that succeeds — overwrites
  // whatever SpeechRecognition put in the input with the more accurate
  // server-side transcript. Falls back silently to the browser's own
  // transcript (already in the input) if Whisper is unavailable or errors.
  finishRecordingAndTranscribe() {
    const recorder = this.mediaRecorder;
    const stream = this.mediaStream;
    this.mediaRecorder = null;
    this.mediaStream = null;

    if (!recorder || recorder.state === 'inactive') {
      stream?.getTracks().forEach((track) => track.stop());
      emitAvatarEvent('update-status', { text: 'Ready', color: 'green' });
      this.setTranscribing(false);
      return;
    }

    recorder.onstop = async () => {
      stream?.getTracks().forEach((track) => track.stop());

      const blob = new Blob(this.audioChunks, { type: recorder.mimeType || 'audio/webm' });
      this.audioChunks = [];

      if (!blob.size) {
        emitAvatarEvent('update-status', { text: 'Ready', color: 'green' });
        this.setTranscribing(false);
        return;
      }

      emitAvatarEvent('update-status', { text: 'Transcribing…', color: 'yellow' });

      try {
        const extension = (blob.type.split('/')[1] || 'webm').split(';')[0];
        const formData = new FormData();
        formData.append('audio', blob, `speech.${extension}`);
        formData.append('language', this.recognitionLanguage.startsWith('ja') ? 'ja' : 'en');

        const response = await fetch(`${BACKEND}/stt`, { method: 'POST', body: formData });
        if (response.ok) {
          const { text } = await response.json();
          if (text && this.input) {
            this.input.value = text;
            this.input.style.height = '38px';
            this.input.style.height = `${Math.min(this.input.scrollHeight, 160)}px`;
          }
        }
      } catch (error) {
        // Backend/Whisper unreachable — the SpeechRecognition transcript
        // already in the input stands as the fallback, so just move on.
      } finally {
        this.setTranscribing(false);
      }

      emitAvatarEvent('update-status', { text: 'Ready', color: 'green' });
    };

    try {
      recorder.stop();
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      emitAvatarEvent('update-status', { text: 'Ready', color: 'green' });
      this.setTranscribing(false);
    }
  }

}


export { AvatarInputs };