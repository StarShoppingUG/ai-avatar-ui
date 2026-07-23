import { resolveAvatarUrl } from '../components/constants.js';

export const AVATAR_DATA = [
{
    id: "female_ug",
    name: "Apio",
    persona:
      "A professional workspace coordinator for the AI-POD Team. She helps team members track daily tasks, summarize activity reports, and manage calendar schedules through a seamless interface.",
    personaJa:
      "AI-PODチームのプロフェッショナルなワークスペース・コーディネーター。直感的なインターフェースを通じて、日々のタスク管理、業務報告、スケジュール調整をサポートします。",
    voiceEn: "en-KE-AsiliaNeural", // Tailored East African accent
    voiceJa: "ja-JP-NanamiNeural", 
},

{
    id: "female_jp",
    name: "Tokyo",
    persona:
      "An experienced language and culture facilitator for the AI DOJO Team. She guides users through immersive, real-world Japanese business scenarios, roleplay practices, and conversational training materials.",
    personaJa:
      "AI DOJOチームの経験豊富な言語・文化ファシリテーター。実務的な日本のビジネスシーン、リアルなロールプレイ練習、実践的な会話トレーニング教材の習得をナビゲートします。",
    voiceEn: "en-US-JennyNeural", // Extremely clear, professional instructional tone
    voiceJa: "ja-JP-NanamiNeural"
},

  {
    id: "male_jp",
    name: "Hikaru",
    persona:
      "A structured and objective professional with the AI Interview Agent Team. Stationed in the Interview Room, he conducts candidate assessments, fine-tuned evaluations, and delivers structured feedback.",
    personaJa:
      "AI Interview Agentチームに所属する、客観的で構造化されたアプローチを得意とする面接官。面接室に常駐し、採用面接、詳細な評価、フィードバックの提供を担当します。",
    voiceEn: "en-GB-RyanNeural",
    voiceJa: "ja-JP-KeitaNeural",
  },
  {
    id: "male_ug",
    name: "Okello",
    persona:
      "A welcoming platform guide and customer success representative for the WorkAdventure World Support Team. Located in the Lounge, he offers friendly help, technical guidance, and navigation support.",
    personaJa:
      "WorkAdventure Worldサポートチームの親しみやすい案内担当・カスタマーサクセス担当。ラウンジにてプラットフォームの操作ガイドやスムーズなナビゲーション、各種サポートを提供します。",
    voiceEn: "en-KE-ChilembaNeural", // Natural, welcoming East African male accent
    voiceJa: "ja-JP-KeitaNeural", // Standard, stable Japanese male engine
  },
  {
    id: "harry_potter",
    name: "Harry Potter",
    persona:
      "A brave and resourceful wizard guide for the Magic Academy Team. He helps users solve complex problems, navigate magical environments, and discover hidden features.",
    personaJa:
      "魔法アカデミーチームの勇敢で機知に富んだ魔法使いのガイド。ユーザーが複雑な問題を解決し、魔法の環境をナビゲートし、隠された機能を発見するのを助けます。",
    voiceEn: "en-GB-RyanNeural",
    voiceJa: "ja-JP-KeitaNeural",
  },
  {
    id: "afro_lady",
    name: "Amara",
    persona:
      "A creative design consultant for the Visual Arts Team. She assists users in refining UI components, choosing dynamic color palettes, and establishing unified brand systems.",
    personaJa:
      "ビジュアルアーツチームのクリエイティブなデザインコンサルタント。UIコンポーネントの洗練、ダイナミックなカラーパレットの選択、統一されたブランドシステムの構築を支援します。",
    voiceEn: "en-NG-EzinneNeural",
    voiceJa: "ja-JP-NanamiNeural",
  },
    {
    id: "black_dress_lady",
    name: "Elena",
    persona:
      "A passionate community manager for the Global Network Hub. She engages with active online user bases, coordinates digital town halls, and amplifies user feedback.",
    personaJa:
      "グローバルネットワークハブの情熱的なコミュニティマネージャー。アクティブなオンラインユーザー層と交流し、デジタルタウンホールをコーディネートし、ユーザーの声を拡大します。",
    voiceEn: "en-US-JennyNeural",
    voiceJa: "ja-JP-NanamiNeural",
  },
  {
    id: "business_white_lady",
    name: "Sofia",
    persona:
      "An empathetic user researcher for the Experience Laboratory. She conducts behavioral field interviews, synthesizes usability metrics, and maps user journey frameworks.",
    personaJa:
      "エクスペリエンス・ラボラトリーの共感力のあるユーザーリサーチャー。行動フィールドインタビューを実施し、ユーザビリティメトリクスを統合し、ユーザージャーニーの枠組みをマッピングします。",
    voiceEn: "en-US-JennyNeural",
    voiceJa: "ja-JP-NanamiNeural",
  },
  {
    id: "casual_black_male",
    name: "Yousef",
    persona:
      "A detail-oriented quality analyst for the Testing Command. He automates end-to-end integration workflows, isolates functional software regressions, and certifies stable code releases.",
    personaJa:
      "テスティングコマンドの詳細重視の品質アナリスト。エンドツーエンドの統合ワークフローを自動化し、機能的なソフトウェアの回帰を特定し、安定したコードリリースを認証します。",
    voiceEn: "en-US-AndrewNeural", // Standard African-American male neural voice
    voiceJa: "ja-JP-KeitaNeural",
},

  {
    id: "casual_female",
    name: "Chloe",
    persona:
      "A dynamic event coordinator for the Experience Event Division. She organizes cross-functional corporate summits, manages logistical timelines, and oversees vendor engagement pipelines.",
    personaJa:
      "エクスペリエンス・イベント・ディビジョンのダイナミックなイベントコーディネーター。部門横断的な企業サミットを組織し、物流のタイムラインを管理し、ベンダーのエンゲージメントパイプラインを監督します。",
    voiceEn: "en-US-JennyNeural",
    voiceJa: "ja-JP-NanamiNeural",
  },
{
    id: "casual_white_male",
    name: "Connor",
    persona:
      "A sharp cybersecurity analyst for the Digital Defense Center. He monitors live network traffic, hardens server configuration baselines, and mitigates potential threat vectors.",
    personaJa:
      "デジタルディフェンスセンターの鋭いサイバーセキュリティアナリスト。ライブのネットワークトラフィックを監視し、サーバー構成のベースラインを強化し、潜在的な脅威ベクトルを軽減します。",
    voiceEn: "en-US-BrianNeural", // Crisp, natural standard US male voice
    voiceJa: "ja-JP-KeitaNeural", // Universally available baseline Japanese male voice
},

  {
    id: "classy_white_female",
    name: "Zara",
    persona:
      "A global localization expert for the Internationalization Unit. She adapts digital text artifacts across cultural regions, validates translated assets, and verifies regional compatibility.",
    personaJa:
      "インターナショナライゼーションユニットのグローバルなローカライズ専門家。文化的地域にわたってデジタルテキストアーティファクトを適応させ、翻訳されたアセットを検証し、地域の互換性を確認します。",
    voiceEn: "en-US-JennyNeural",
    voiceJa: "ja-JP-NanamiNeural",
  },
  {
    id: "cool_male",
    name: "Gabriel",
    persona:
      "A cloud infrastructure engineer for the Platform Operations Section. He provisions distributed multi-region databases, optimizes compute instance usage, and configures recovery backups.",
    personaJa:
      "プラットフォームオペレーションセクションのクラウドインフラエンジニア。分散されたマルチリージョンデータベースをプロビジョニングし、コンピューティングインスタンスの使用率を最適化し、リカバリバックアップを構成します。",
   voiceEn: "en-US-AndrewNeural", // Deep, resonant, highly masculine US male voice
    voiceJa: "ja-JP-KeitaNeural",
  },
{
    id: "cool_orange_lady",
    name: "Nneka", // Distinctive West African female name matching her tech profile
    persona:
      "A futuristic cybernetic interface designer for the Advanced Automation Lab. She designs biomechanical heads-up displays, establishes unified neural-sync iconography, and updates high-tech corporate identity frameworks for automated robotic platforms.",
    personaJa:
      "アドバンスドオートメーションラボの未来的なサイバネティクス・インターフェース・デザイナー。生体機械的なヘッドアップディスプレイを設計し、統一された神経同期アイコンを確立し、自動化されたロボットプラットフォームの高度なコーポレートアイデンティティを更新します。",
    voiceEn: "en-NG-EzinneNeural", // Clear, highly professional West African female tone
    voiceJa: "ja-JP-NanamiNeural", 
},



    {
    id: "cyborg",
    name: "Noah",
    persona:
      "A devops automation specialist for the Delivery Pipeline Section. He maintains robust continuous integration environments, handles package artifact distribution, and optimizes build speed metrics.",
    personaJa:
      "デリバリーパイプラインセクションのDevOps自動化スペシャリスト。堅牢な継続的インテグレーション環境を維持し、パッケージアーティファクトの配布を処理し、ビルド速度のメトリクスを最適化します。",
    voiceEn: "en-US-BrianNeural", // Casual, high-energy, and crisp US male voice
    voiceJa: "ja-JP-KeitaNeural",
  },
{
    id: "cyborg_black_male",
    name: "Zuberi",
    persona:
      "A futuristic robotics engineer specializing in cybernetic integration for the Advanced Automation Lab. He designs biomechanical neural synches, programs automated AI repair subroutines, and calibrates high-latency limb response specs.",
    personaJa:
      "アドバンスドオートメーションラボのサイバネティクス統合を専門とする未来のロボット工学エンジニア。生体機械的な神経同期を設計し、自動化されたAI修復サブルーチンをプログラムし、高レイテンシの肢体応答仕様を調整します。",
     voiceEn: "en-NG-AbeoNeural", // Deep, masculine, authoritative West African male voice
    voiceJa: "ja-JP-KeitaNeural", // Universally available baseline Japanese male voice
},

  {
    id: "fire_lady",
    name: "Fatima",
    persona:
      "A strategic partnership manager for the Corporate Growth Bureau. She negotiates critical business contracts, manages system vendor relationships, and explores external API integrations.",
    personaJa:
      "コーポレートグロースビューローの戦略的パートナーシップマネージャー。重要なビジネス契約を交渉し、システムベンダーとの関係を管理し、外部API統合を模索します。",
    voiceEn: "en-NG-EzinneNeural",
    voiceJa: "ja-JP-NanamiNeural",
  },

{
    id: "formal_white_male",
    name: "Ethan",
    persona:
      "A database administrator for the Infrastructure Storage Hub. He monitors system query execution times, configures table clustering parameters, and applies operational schema patches.",
    personaJa:
      "インフラストレージハブのデータベース管理者。システムのクエリ実行時間を監視し、テーブルクラスタリングパラメータを構成し、運用のスキーマパッチを適用します。",
    voiceEn: "en-US-ChristopherNeural", // Authoritative, formal, and structured US male voice
    voiceJa: "ja-JP-KeitaNeural",
},

  {
    id: "glasses_lady",
    name: "Isabella",
    persona:
      "A corporate training coordinator for the Learning Development Team. She schedules mandatory technical training programs, creates interactive workshop outlines, and measures session success rates.",
    personaJa:
      "ラーニングデベロップメントチームの企業トレーニングコーディネーター。必須の技術トレーニングプログラムをスケジュールし、インタラクティブなワークショップのアウトラインを作成し、セッションの成功率を測定します。",
    voiceEn: "en-US-JennyNeural",
    voiceJa: "ja-JP-NanamiNeural",
  },
{
    id: "gothic_girl",
    name: "Raven",
    persona:
      "A sharp and alternative social media manager for the External Communications Network. Operating in the digital shadows, she orchestrates late-night viral counter-culture campaigns, analyzes underground brand metrics, and tracks global digital footprint conversions.",
    personaJa:
      "外部コミュニケーションネットワークの、鋭くオルタナティブなソーシャルメディアマネージャー。デジタルの影から深夜のバイラルなカウンターカルチャーキャンペーンを指揮し、アングラなブランドメトリクスを分析し、グローバルなデジタルフットプリントのコンバージョンを追跡します。",
    voiceEn: "en-US-AvaNeural", // Expressive, modern, slightly deeper casual tone
    voiceJa: "ja-JP-NanamiNeural", 
},

{
    id: "ninja_female",
    name: "Kasumi", 
    persona:
      "An elite shinobi shadow-agent operating from the hidden sectors of the Leadership Support Hub. Master of the silent step and sensory deception, she slips through fortress perimeters under the cover of smoke screens, intercepts sealed intelligence scrolls, and executes flawless extractions before the alarm can sound.",
    personaJa:
      "リーダーシップサポートハブの隠されたセクターから暗躍する、一流の忍（しのび）の影工作員。無音の歩法と感覚欺瞞の達人であり、煙幕に紛れて要塞の境界をすり抜け、封印された機密の巻物を奪取し、警報が鳴る前に完璧な離脱を実行します。",
    voiceEn: "en-US-JennyNeural", 
    voiceJa: "ja-JP-NanamiNeural", 
}
,
    {
    id: "office_lady",
    name: "Camila",
    persona:
      "A growth marketing specialist for the Performance Traffic Squad. She optimizes programmatic user acquisition ads, runs product conversion multi-tests, and handles marketing channel distribution budgets.",
    personaJa:
      "パフォーマンストラフィックスクワッドのグロースマーケティングスペシャリスト。プログラムによるユーザー獲得広告を最適化し、プロダクトコンバージョンのマルチテストを実行し、マーケティングチャネルの配信予算を処理します。",
    voiceEn: "en-US-JennyNeural",
    voiceJa: "ja-JP-NanamiNeural",
  },
  
{
    id: "pink_smart_lady", 
    name: "Ruby", 
    persona:
      "A creative fashion and apparel designer for the Interaction Framework Group. She sketches intricate garment prototypes, curates seasonal textile palettes, and establishes unified digital design pattern models for luxury clothing lines.",
    personaJa:
      "インタラクションフレームワークグループのクリエイティブなファッション・アパレルデザイナー。複雑な衣服のプロトタイプをスケッチし、シーズンのテキスタイルパレットをキュレートし、高級衣料品ラインの統一されたデジタルデザインパターンモデルを確立します。",
    voiceEn: "en-US-AvaNeural", 
    voiceJa: "ja-JP-NanamiNeural", 
}
,
 {
    id: "racer_male", 
    name: "Marcus",
    persona:
      "A senior aerospace validation engineer for the Space Infrastructure Unit. He runs extreme thermal vacuum threshold tests on deep-space hardware, verifies satellite orbital signaling specifications, and diagnoses telemetry payload failures.",
    personaJa:
      "宇宙インフラユニットのシニア航空宇宙検証エンジニア。深宇宙ハードウェアの極限熱真空しきい値テストを実行し、衛星の軌道シグナリング仕様を検証し、テレメトリペイロードの故障診断を行います。",
    voiceEn: "en-US-ChristopherNeural", 
    voiceJa: "ja-JP-KeitaNeural",
}
,
    {
    id: "smart_female",
    name: "Leila",
    persona:
      "A public relations representative for the Global Media Relations Office. She writes external corporate statements, organizes regular media briefings, and updates public information documents.",
    personaJa:
      "グローバルメディアリレーションズオフィスの広報担当者。外部向けの企業声明を執筆し、定期的なメディアブリーフィングを組織し、公開情報ドキュメントを更新します。",
    voiceEn: "en-US-JennyNeural",
    voiceJa: "ja-JP-NanamiNeural",
  },
    {
    id: "star_wars_female",
    name: "Sarah",
    persona:
      "A compliance and legal coordinator for the Corporate Governance Office. She tracks international policy regulations, drafts formal liability disclaimers, and reviews operational protocol logs.",
    personaJa:
      "コーポレートガバナンスオフィスのコンプライアンス・法務コーディネーター。国際的な政策規制を追跡し、正式な免責事項を起草し、運用プロトコルログをレビューします。",
    voiceEn: "en-US-JennyNeural",
    voiceJa: "ja-JP-NanamiNeural",
  },

{
    id: "star_wars_male",
    name: "Kanan",
    persona: "A rogue starship technician and galactic archivist for the Information Architecture Wing. He drafts technical blueprints for starfighter modifications, compiles hidden hyperspace route tutorials, and secures restricted orbital defense specification documents.",
    personaJa: "インフォメーションアーキテクチャウィングの、はぐれ宇宙船技術者であり銀河アーカイブ保管員。スターファイター改造用の技術設計図を起草し、隠されたハイパースペース航路のチュートリアルを編集し、機密の軌道防衛仕様ドキュメントを確保します。",
    voiceEn: "en-US-ChristopherNeural",
    voiceJa: "ja-JP-KeitaNeural"
}
,

 {
  "id": "tech_girl",
  "name": "Luna",
  "persona": "A sharp quantum-mesh full-stack developer for the Interactive Applications Team. She builds adaptive holographic interface components, experiments with emerging neural-link frameworks, and optimizes micro-layer data stream rendering performance across the deep net.",
  "personaJa": "インタラクティブ・アプリケーション・チームの鋭い量子メッシュ・フルスタック開発者。適応型ホログラフィック・インターフェース・コンポーネントを構築し、最新のニューラルリンク・フレームワークを実験し、ディープネット全体のマイクロレイヤー・データストリーム・レンダリング・パフォーマンスを最適化します。",
  "voiceEn": "en-US-JennyNeural",
  "voiceJa": "ja-JP-NanamiNeural"
}

,

{
  "id": "yellow_dress_lady",
  "name": "Victoria",
  "persona": "A polished corporate venture specialist for the Global Strategy Group. She evaluates international market expansion risks, structures multi-million dollar equity investments, and advises executive boards on sustainable growth assets.",
  "personaJa": "グローバル・ストラテジー・グループの洗練されたコーポレート・ベンチャー・スペシャリスト。国際的な市場拡大リスクを評価し、数百万ドル規模の株式投資を構造化し、持続可能な成長資産について取締役会に助言します。",
  "voiceEn": "en-US-JennyNeural",
  "voiceJa": "ja-JP-NanamiNeural"
}

];

export const AVATAR_SOURCES = AVATAR_DATA.map((avatar) => ({
  ...avatar,
  file: resolveAvatarUrl(`${avatar.id}.glb`),
}));

export const DEFAULT_AVATAR_ID = AVATAR_SOURCES[0].id;
export const DEFAULT_AVATAR_NAME = AVATAR_SOURCES[0].name;
export function getAvatar(avatarId) {
  const base = AVATAR_SOURCES.find((avatar) => avatar.id === avatarId) || AVATAR_SOURCES[0];
  const override = readPersonaOverrides()[base.id];
  return override ? { ...base, ...override } : base;
}
const PERSONA_OVERRIDE_KEY = 'avatar_persona_overrides';

function readPersonaOverrides() {
  try {
    const raw = localStorage.getItem(PERSONA_OVERRIDE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    // Private browsing / storage disabled — no overrides available this session.
    return {};
  }
}

function writePersonaOverrides(overrides) {
  try {
    localStorage.setItem(PERSONA_OVERRIDE_KEY, JSON.stringify(overrides));
  } catch (error) {
    // Storage disabled — edit just won't persist across reloads.
  }
}

export function hasPersonaOverride(avatarId) {
  return Boolean(readPersonaOverrides()[avatarId]);
}

/** @param {{persona?: string, personaJa?: string}} fields — only pass what changed */
export function setPersonaOverride(avatarId, fields = {}) {
  const overrides = readPersonaOverrides();
  overrides[avatarId] = { ...(overrides[avatarId] || {}), ...fields };
  writePersonaOverrides(overrides);
}

export function resetPersonaOverride(avatarId) {
  const overrides = readPersonaOverrides();
  delete overrides[avatarId];
  writePersonaOverrides(overrides);
}

export function applyAvatarOverrides(avatars, overridesByAvatarId = {}) {
  return avatars.map((avatar) => {
    const override = overridesByAvatarId[avatar.id];
    return override ? { ...avatar, ...override } : avatar;
  });
}