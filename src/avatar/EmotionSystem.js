/**
 * EmotionSystem — maps AI behavior JSON to face, body clips, and lip sync.
 */
export class EmotionSystem {
    constructor({ expression, animation, lipSync }) {
        this.expression = expression;
        this.animation = animation;
        this.lipSync = lipSync;
    }

    /**
     * Call this when the UI button enters the pending/loading state.
     * Forces the avatar into a looped thinking pose while waiting for the server response.
     */
    startThinking() {
        this.lipSync?.stop();
        this.expression?.setExpression('neutral');
        if (this.animation) {
            this.animation.play('think', { loop: true, fade: 0.7 });
        }
    }

    /**
     * Stop thinking and clear visual overrides.
     */
    stopThinking() {
        if (this.animation && this.animation.current === this.animation.actions['think']) {
            this.animation.play('idle', { loop: true, fade: 0.7 });
        }
    }

    /**
     * Call when the user starts typing, or the mic starts recording — stays
     * active through STT transcription too, since both are "the avatar is
     * paying attention to input" states. Distinct from startThinking(),
     * which is for waiting on the LLM's reply after a message is sent.
     */
    startListening() {
        this.lipSync?.stop();
        this.expression?.setExpression('neutral');
        if (this.animation) {
            this.animation.play('listening', { loop: true, fade: 0.7 });
        }
    }

    /**
     * Return to idle, but only if we're still actually in the listening
     * pose — avoids stomping on some other animation (e.g. a gesture) that
     * may have taken over in the meantime.
     */
    stopListening() {
        if (this.animation && this.animation.current === this.animation.actions['listening']) {
            this.animation.play('idle', { loop: true, fade: 0.7 });
        }
    }

    /**
     * @param {object} data — backend behavior payload
     * @param {string} backendUrl — prefix for audio paths
     * @returns {Promise<object|null>} lastAudio for replay
     */
    apply(data, backendUrl = '', onComplete = null) {
        // Silence frequent payload logging for cleaner runtime output.
        const en = data.reply || data.text_en || '';
        const emotion = data.expression || data.emotion || 'neutral';
        const hasAudio = !!(data.audio_url || data.audio_url_en || data.audio_url_ja);
        
        // Read the direct modern animation parameter token and normalize it.
        const bodyKey = String(data.animation || 'talk').trim().toLowerCase();
        const isDefaultIdle = bodyKey === 'idle' || bodyKey === 'talk';

        if (this.expression) {
            this.expression.setExpression(emotion);
        }

        // Quiet expression payload logging unless explicitly needed.
        const isOneShotGesture = (bodyKey === 'thankful' || bodyKey === 'greeting' || bodyKey === 'nod');
        const isThinkingStance = (bodyKey === 'think');
        // A named clip like 'offline' that isn't talk/idle/think/gesture but does exist as
        // its own loaded animation — play it as itself instead of defaulting to 'talk'.
        const isStandaloneClip = !isThinkingStance && !isOneShotGesture
            && bodyKey !== 'talk' && bodyKey !== 'idle'
            && Boolean(this.animation?.hasClip?.(bodyKey));
        const shouldLoop = isOneShotGesture ? false : (isStandaloneClip ? true : (isDefaultIdle || hasAudio));

        let usedClip = false;
        if (this.animation) {
            const trackToPlay = isThinkingStance ? bodyKey
                : (isOneShotGesture || isStandaloneClip) ? bodyKey
                : (hasAudio ? 'talk' : 'idle');

            // Preserve one-shot voice context so the avatar can return to talk after the clip finishes.
            if (hasAudio && isOneShotGesture) {
                this.animation.isTalking = true;
            }
            if (hasAudio && trackToPlay === 'talk') {
                this.animation.isTalking = true;
            }
            if (isStandaloneClip) {
                this.animation.isTalking = hasAudio;
            }

            usedClip = this.animation.play(trackToPlay, { loop: shouldLoop });

            // Fallback safety to default explanation if the specific one-shot action misses
            if (!usedClip && bodyKey !== 'talk') {
                usedClip = this.animation.play(bodyKey, { loop: shouldLoop });
            }
            if (!usedClip && hasAudio && trackToPlay !== 'explain') {
                usedClip = this.animation.play('explain', { loop: true });
            }
        }

        const primary = data.primary || 'en';
        const audioUrl = primary === 'ja'
            ? (data.audio_url_ja || data.audio_url)
            : (data.audio_url_en || data.audio_url);
        const visemes = primary === 'ja'
            ? (data.visemes_ja || data.visemes)
            : (data.visemes_en || data.visemes);

        if (this.lipSync && audioUrl) {
            const full = audioUrl.startsWith('http') || audioUrl.startsWith('/')
                ? backendUrl + audioUrl
                : backendUrl + '/' + audioUrl;

            // Rely entirely on your audio completion hook to pull the avatar home safely
            this.lipSync.play(full, visemes || [], () => {
                
                // Reset the speaker presence track loops cleanly upon finish while preserving the current face mood.
                if (this.animation) {
                    this.animation.isTalking = false;
                    this.animation.play('idle', { loop: true, fade: 0.7 });
                }
                this.expression?.setTalkingState(false);
                onComplete?.();
            });

            return { url: audioUrl, visemes: visemes || [] };
        }
        onComplete?.();
        return null;
    }

    reset() {
        this.animation?.playIdle();
        this.expression?.setExpression('neutral');
        this.lipSync?.stop();
    }

    replayExplain(lastAudio, backendUrl) {
        if (!lastAudio) return;

        this.animation?.play('talk', { loop: true });
        if (this.lipSync) {
            this.lipSync.play(backendUrl + lastAudio.url, lastAudio.visemes, () => {
                this.animation?.play('idle', { loop: true, fade: 0.7 });
                this.expression?.setTalkingState(false);
            });
        }
    }
}