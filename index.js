const { Client } = require('discord.js-selfbot-v13');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// デバッグログ：アプリケーション開始
console.log('[INFO] アプリケーション開始');
console.log('[INFO] Node.jsバージョン:', process.version);
console.log('[INFO] 環境変数:', {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN ? '設定済み' : '未設定',
  GOOGLE_AI_KEY: process.env.GOOGLE_AI_KEY ? '設定済み' : '未設定',
  GUILD_ID: process.env.GUILD_ID ? '設定済み' : '未設定',
  ALLOWED_ROLE_ID: process.env.ALLOWED_ROLE_ID ? '設定済み' : '未設定'
});

// Discordクライアントの初期化
const client = new Client({
  intents: ['GUILDS', 'GUILD_MESSAGES', 'DIRECT_MESSAGES', 'MESSAGE_CONTENT']
});

// Google Gemini AIの初期化
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// クライアント準備完了イベント
client.once('ready', () => {
  console.log(`[DEBUG] セルフボット起動！ ユーザー: ${client.user.tag}`);
});

// メッセージ受信イベント
client.on('messageCreate', async (message) => {
  try {
    // 自分自身またはボットからのメッセージを無視
    if (message.author.id === client.user.id || message.author.bot) return;

    console.log(`[DEBUG] メッセージ受信: "${message.content}" from ${message.author.tag} in guild: ${message.guild ? message.guild.name : 'DM'}`);

    // サーバー内メッセージの場合、許可されたロールをチェック
    if (message.guild && process.env.GUILD_ID && process.env.ALLOWED_ROLE_ID) {
      if (message.guild.id !== process.env.GUILD_ID) return;
      if (!message.member.roles.cache.has(process.env.ALLOWED_ROLE_ID)) {
        console.log(`[INFO] 許可されていないロール: ${message.author.tag}`);
        return;
      }
    }

    // コマンド処理（例：!chat）
    if (message.content.startsWith('!chat')) {
      const prompt = message.content.slice(6).trim();
      if (!prompt) {
        await message.reply('プロンプトを指定してください。例: !chat こんにちは');
        return;
      }

      // タイピングインジケータ
      await message.channel.sendTyping();

      // Gemini APIで応答生成
      const result = await model.generateContent(prompt);
      const response = result.response.text();

      console.log(`[DEBUG] Gemini応答: ${response}`);

      // 応答を送信（2000文字以内に制限）
      const maxLength = 2000;
      if (response.length > maxLength) {
        await message.reply(response.slice(0, maxLength - 3) + '...');
      } else {
        await message.reply(response);
      }

      // リアクション追加（レート制限対策で遅延）
      await new Promise(resolve => setTimeout(resolve, 1000));
      await message.react('😺');
    }
  } catch (error) {
    console.error('[ERROR] メッセージ処理エラー:', error.message);
    await message.reply('エラーが発生しました。後でもう一度試してください。');
  }
});

// ログイン
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
