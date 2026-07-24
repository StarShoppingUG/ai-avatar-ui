// UI copy (English/Japanese) and language-related helpers shared by every
// avatar-* custom element. Kept separate from constants.js since this is
// specifically about rendered text, not app configuration.
import { UI_LANGUAGES } from './constants.js';

export const UI_TEXT = {
  en: {
    settingsTitle: 'Avatar Settings',
    settingsSubtitle: 'Switch avatar, Interface and response language, Chat history.',
    avatarLabel: 'Change avatar',
    replyLabel: 'Reply language',
    interfaceLabel: 'Interface',
    historyButton: 'View chat history',
    historyTitle: 'Chat history',
    historySubtitle: 'Review and clear your conversation log.',
    clearHistory: 'Clear history',
    close: 'Close',
    settingsLabel: 'Settings',
    openSettings: 'Open settings',
    closeSettings: 'Close settings',
    chatTitle: 'Chat',
    replay: 'Replay',
    placeholder: 'Type a message...',
    send: 'Send',
    micTitle: 'Toggle microphone',
    statusInitializing: 'Initializing',
    statusLoadingAvatar: 'Loading avatar…',
    statusReady: 'Ready',
    statusReadyWithoutModel: 'Ready (no model)',
    statusVoiceUpdated: 'Voice updated.',
    statusListening: 'Listening…',
    statusTranscribing: 'Transcribing…',
    statusThinking: 'Thinking…',
    conversationCleared: 'No chat history. Your recent messages will appear here.',
    chatHistoryCleared: 'Chat history cleared. You recent messages will appear here.',
  },
  ja: {
    settingsTitle: 'アバター設定',
    settingsSubtitle: 'アバター、返信言語、表示言語を切り替えます。',
    avatarLabel: 'アバターを変更',
    replyLabel: '返信言語',
    interfaceLabel: '表示言語',
    historyButton: 'チャット履歴を見る',
    historyTitle: 'チャット履歴',
    historySubtitle: '会話ログを確認して削除できます。',
    clearHistory: '履歴を消去',
    close: '閉じる',
    settingsLabel: '設定',
    openSettings: '設定を開く',
    closeSettings: '設定を閉じる',
    chatTitle: 'チャット',
    replay: '再生',
    placeholder: 'メッセージを入力...',
    send: '送信',
    micTitle: 'マイクを切り替える',
    statusInitializing: '初期化中',
    statusLoadingAvatar: 'アバターを読み込み中…',
    statusReady: '準備完了',
    statusReadyWithoutModel: '準備完了（モデルなし）',
    statusVoiceUpdated: '声を更新しました。',
    statusListening: '聞いています…',
    statusTranscribing: '文字起こし中…',
    statusThinking: '考え中…',
    conversationCleared: '会話をクリアしました。メッセージを送信して始めましょう。',
    chatHistoryCleared: 'チャット履歴をクリアしました。オーバーレイを開いて会話を続けてください。',
  },
};

export function getStoredUiLanguage(defaultLanguage = 'en') {
  try {
    const saved = localStorage.getItem('avatar_ui_lang');
    return UI_LANGUAGES.includes(saved) ? saved : defaultLanguage;
  } catch (error) {
    return defaultLanguage;
  }
}

export function getUiText(language = 'en') {
  const lang = UI_LANGUAGES.includes(language) ? language : 'en';
  return UI_TEXT[lang] || UI_TEXT.en;
}

// Dynamic "Loading <avatar name>…" status (built per-avatar in
// AvatarController.selectAvatar() / AvatarModel.loadAvatar() as
// `Loading ${avatar.name}…`) can't live in the exact-string map below,
// since the avatar name changes every time and isn't a fixed key. The
// avatar name is a proper noun and must never be translated — only the
// "Loading"/"…" wrapper around it should flip with the UI language.
// Matches either direction so re-translating an already-Japanese status
// (see AvatarStatus.applyUiLanguage, which re-translates whatever's
// currently displayed) back to English also works.
const LOADING_EN_PATTERN = /^Loading (.+)…$/;
const LOADING_JA_PATTERN = /^(.+)を読み込み中…$/;

export function translateStatusText(text, language = 'en') {
  const value = String(text || '').trim();

  const avatarName = value.match(LOADING_EN_PATTERN)?.[1] || value.match(LOADING_JA_PATTERN)?.[1];
  if (avatarName) {
    return language === 'ja' ? `${avatarName}を読み込み中…` : `Loading ${avatarName}…`;
  }

  const uiText = getUiText(language);
  const sourceText = getUiText(language === 'ja' ? 'en' : 'ja');
  const map = {
    [uiText.statusInitializing]: uiText.statusInitializing,
    [sourceText.statusInitializing]: uiText.statusInitializing,
    Initializing: uiText.statusInitializing,
    'Loading avatar…': uiText.statusLoadingAvatar,
    [uiText.statusLoadingAvatar]: uiText.statusLoadingAvatar,
    [sourceText.statusLoadingAvatar]: uiText.statusLoadingAvatar,
    'Loading …': uiText.statusLoadingAvatar,
    'Loading ...': uiText.statusLoadingAvatar,
    Ready: uiText.statusReady,
    [uiText.statusReady]: uiText.statusReady,
    [sourceText.statusReady]: uiText.statusReady,
    'Ready (no model)': uiText.statusReadyWithoutModel,
    [uiText.statusReadyWithoutModel]: uiText.statusReadyWithoutModel,
    [sourceText.statusReadyWithoutModel]: uiText.statusReadyWithoutModel,
    'Voice updated.': uiText.statusVoiceUpdated,
    [uiText.statusVoiceUpdated]: uiText.statusVoiceUpdated,
    [sourceText.statusVoiceUpdated]: uiText.statusVoiceUpdated,
    'Listening…': uiText.statusListening,
    [uiText.statusListening]: uiText.statusListening,
    [sourceText.statusListening]: uiText.statusListening,
    'Transcribing…': uiText.statusTranscribing,
    [uiText.statusTranscribing]: uiText.statusTranscribing,
    [sourceText.statusTranscribing]: uiText.statusTranscribing,
    'Thinking…': uiText.statusThinking,
    [uiText.statusThinking]: uiText.statusThinking,
    [sourceText.statusThinking]: uiText.statusThinking,
  };
  return map[value] || value;
}

export function applyUiLanguageToApp(language = 'en') {
  const lang = UI_LANGUAGES.includes(language) ? language : 'en';
  document.documentElement.lang = lang;
  localStorage.setItem('avatar_ui_lang', lang);

  const settings = document.querySelector('avatar-settings');
  settings?.applyUiLanguage?.(lang);

  const inputs = document.querySelector('avatar-inputs');
  inputs?.applyUiLanguage?.(lang);

  const status = document.querySelector('avatar-status');
  status?.applyUiLanguage?.(lang);
}