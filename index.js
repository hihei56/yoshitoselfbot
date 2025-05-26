const http = require('http');
const { Client, SpotifyRPC } = require('discord.js-selfbot-v13');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// HTTPサーバー（Cloud Runのヘルスチェック用）
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot is running');
});
server.listen(process.env.PORT || 8080, () => {
  console.log(`[INFO] HTTP server running on port ${process.env.PORT || 8080}`);
});

// 環境変数の確認
if (!process.env.DISCORD_TOKEN || !process.env.GOOGLE_AI_KEY || !process.env.GUILD_ID || !process.env.ALLOWED_ROLE_ID) {
  console.error('[FATAL] 必要な環境変数が未設定です:', {
    DISCORD_TOKEN: process.env.DISCORD_TOKEN ? '設定済み' : '未設定',
    GOOGLE_AI_KEY: process.env.GOOGLE_AI_KEY ? '設定済み' : '未設定',
    GUILD_ID: process.env.GUILD_ID ? '設定済み' : '未設定',
    ALLOWED_ROLE_ID: process.env.ALLOWED_ROLE_ID ? '設定済み' : '未設定'
  });
  process.exit(1);
}

// デバッグログ：アプリケーション開始
console.log('[INFO] アプリケーション開始');
console.log('[INFO] Node.jsバージョン:', process.version);

// Discordクライアントの初期化
const client = new Client({
  intents: ['GUILDS', 'GUILD_MESSAGES', 'DIRECT_MESSAGES', 'MESSAGE_CONTENT'],
  syncStatus: false
});

// Google Gemini AIの初期化
let genAI, model;
try {
  genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY);
  model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  console.log('[INFO] Google Gemini AI初期化成功');
} catch (error) {
  console.error('[ERROR] Google Gemini AI初期化失敗:', error.message);
}

// Spotifyステータスを設定する関数
function setSpotifyStatus(client) {
  const spotify = new SpotifyRPC(client)
    .setAssetsLargeImage('spotify:ab67706c0000da84c0052dc7fb523a68affdb8f7')
    .setAssetsSmallImage('spotify:ab6761610000f178049d8aeae802c96c8208f3b7')
    .setAssetsLargeText('地方創生☆チクワクティクス')
    .setState('芽兎めう (日向美ビタースイーツ♪)')
    .setDetails('地方創生チクワクティクス')
    .setStartTimestamp(Date.now())
    .setEndTimestamp(Date.now() + 1000 * (3 * 60 + 30)) // 3分30秒
    .setSongId('1234567890abcdef123456')
    .setAlbumId('abcdef1234567890abcdef')
    .setArtistIds(['1234567890abcdef123456']);
  client.user.setActivity(spotify);
  console.log('[INFO] Spotify風ステータスを設定しました');
}

// ステータスをリピートする関数
function startStatusLoop(client) {
  const duration = 1000 * (3 * 60 + 30); // 3分30秒
  setSpotifyStatus(client);
  setInterval(() => {
    setSpotifyStatus(client);
    console.log('[INFO] ステータスをリピートしました');
  }, duration);
}

// クライアント準備完了イベント
client.once('ready', () => {
  console.log(`[DEBUG] セルフボット起動！ ユーザー: ${client.user.tag}`);
  startStatusLoop(client);
});

// メッセージ受信イベント
client.on('messageCreate', async (message) => {
  try {
    console.log(`[DEBUG] メッセージ受信: "${message.content}" from ${message.author.tag} in guild: ${message.guild ? message.guild.name : 'DM'}`);

    // 自分自身またはボットからのメッセージを無視
    if (message.author.id === client.user.id || message.author.bot) return;

    // サーバー内メッセージの場合、許可されたロールをチェック
    if (message.guild && process.env.GUILD_ID && process.env.ALLOWED_ROLE_ID) {
      if (message.guild.id !== process.env.GUILD_ID) return;
      if (!message.member.roles.cache.has(process.env.ALLOWED_ROLE_ID)) {
        console.log(`[INFO] 許可されていないロール: ${message.author.tag}`);
        return;
      }
    }

    // ボットに対するメンション、リプライ、または!chatコマンドをチェック
    const isMention = message.mentions.users.has(client.user.id);
    const isReplyToBot = message.reference && (await message.channel.messages.fetch(message.reference.messageId)).author.id === client.user.id;
    const isChatCommand = message.content.startsWith('!chat');

    if (isChatCommand || isMention || isReplyToBot) {
      // プロンプトの抽出
      let prompt = '';
      if (isChatCommand) {
        prompt = message.content.slice(6).trim(); // !chatを除去
      } else {
        prompt = message.content.replace(/<@!?[0-9]+>/g, '').trim(); // メンションを除去
      }

      // プロンプトが空の場合
      if (!prompt) {
        await message.reply('何かメッセージを入力してください！');
        return;
      }

      // Gemini AIで応答生成
      await message.channel.sendTyping();
      const result = await model.generateContent(prompt);
      const response = result.response.text();
      console.log(`[DEBUG] Gemini応答: ${response}`);

      // 2000文字制限対応
      const maxLength = 2000;
      if (response.length > maxLength) {
        await message.reply(response.slice(0, maxLength - 3) + '...');
      } else {
        await message.reply(response);
      }

      // リアクション追加
      await new Promise(resolve => setTimeout(resolve, 1000));
      await message.react('😺');
    }
  } catch (error) {
    console.error('[ERROR] メッセージ処理エラー:', error.message);
    try {
      await message.reply('エラーが発生しました。後でもう一度試してください。');
    } catch (replyError) {
      console.error('[ERROR] 応答送信失敗:', replyError.message);
    }
  }
});

// エラー処理
client.on('error', (error) => {
  console.error('[ERROR] クライアントエラー:', error.message);
});

// ログイン
console.log('[INFO] Discordログイン開始');
client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error('[FATAL] ログイン失敗:', error.message, error.code);
  process.exit(1);
});

// 予期しないエラーのキャッチ
process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught Exception:', error);
});

// 警告ハンドリング
process.on('warning', (warning) => {
  console.warn('[WARNING]', warning);
});

// プロセスを維持（即時終了防止）
process.on('SIGTERM', () => {
  console.log('[INFO] SIGTERM received. Closing client...');
  client.destroy();
  process.exit(0);
});

// プロセスを維持するためのハートビートログ
setInterval(() => {
  console.log('[INFO] プロセス稼働中:', new Date().toISOString());
}, 60000);
