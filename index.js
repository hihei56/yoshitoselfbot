console.log('[INFO] アプリケーション開始');
console.log('[INFO] Node.jsバージョン:', process.version);
console.log('[INFO] 環境変数:', {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN ? '設定済み' : '未設定',
  GOOGLE_AI_KEY: process.env.GOOGLE_AI_KEY ? '設定済み' : '未設定',
  GUILD_ID: process.env.GUILD_ID ? '設定済み' : '未設定',
  ALLOWED_ROLE_ID: process.env.ALLOWED_ROLE_ID ? '設定済み' : '未設定'
});
client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error('[FATAL] ログイン失敗:', error.message, error.code);
  process.exit(1);
});
const fs = require('fs');
const dotenvPath = __dirname + '/.env';
console.log('[DEBUG] .envファイル存在:', fs.existsSync(dotenvPath));
require('dotenv').config({ path: dotenvPath });
console.log('[DEBUG] DISCORD_TOKEN:', process.env.DISCORD_TOKEN);

// 環境変数の読み込み確認ログ（デバッグ用）
console.log('[DEBUG] カレントディレクトリ:', process.cwd());
console.log('[DEBUG] .envファイル存在:', fs.existsSync('./.env'));
console.log('[DEBUG] DISCORD_TOKEN:', process.env.DISCORD_TOKEN ? '読み込み成功' : 'undefined');
console.log('[DEBUG] GOOGLE_AI_KEY:', process.env.GOOGLE_AI_KEY ? '読み込み成功' : 'undefined');
console.log('[DEBUG] GUILD_ID:', process.env.GUILD_ID ? '読み込み成功' : 'undefined');
console.log('[DEBUG] ALLOWED_ROLE_ID:', process.env.ALLOWED_ROLE_ID ? '読み込み成功' : 'undefined');

const { Client } = require('discord.js-selfbot-v13');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Discordセルフボットクライアント
const client = new Client({ checkUpdate: false });

// Gemini APIのセットアップ
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// 会話履歴管理
const chatHistories = new Map();

// 応答を20行以内に要約する関数
function summarizeResponse(response) {
  const lines = response.split('\n').filter(line => line.trim());
  if (lines.length > 20) {
    console.log('[DEBUG] 応答を20行以内に要約');
    return lines.slice(0, 19).join('\n') + '\n…続きは省略いたします';
  }
  return response;
}

// ロールプレイ要素を適用する関数（絵文字機能を削除）
function applyRoleplay(response, userInput) {
  console.log('[DEBUG] ロールプレイ適用後の応答:', response);
  return response; // 絵文字追加を削除し、元の応答をそのまま返す
}

// ボット準備完了
client.once('ready', () => {
  try {
    console.log(`セルフボット起動！ ユーザー: ${client.user.tag} (ID: ${client.user.id})`);
    console.log(`対象サーバーID: ${process.env.GUILD_ID || '未設定（DM対応）'}`);
  } catch (error) {
    console.error('READYイベントでエラー:', error);
  }
});

// メッセージ受信
client.on('messageCreate', async (message) => {
  console.log(`メッセージ受信: "${message.content}" from ${message.author.tag} (ID: ${message.author.id}) in guild: ${message.guild?.id || 'DM'}`);

  // サーバーIDチェック（DMも許可）
  if (message.guild && message.guild.id !== process.env.GUILD_ID) {
    console.log(`サーバーID不一致（${message.guild.id} != ${process.env.GUILD_ID}）、無視`);
    return;
  }

  // サーバー内でのみロールチェック（DMではスキップ）
  if (message.guild) {
    const allowedRoleId = process.env.ALLOWED_ROLE_ID || '1091087092362260651';
    if (!allowedRoleId) {
      console.log('ALLOWED_ROLE_IDが設定されていません、終了');
      return;
    }

    const member = message.member;
    if (!member) {
      console.log('メンバーデータが取得できません、終了');
      return;
    }

    const hasRole = member.roles.cache.has(allowedRoleId);
    if (!hasRole) {
      console.log(`ユーザー ${message.author.id} は許可されたロール（ID: ${allowedRoleId}）を持っていません、無視`);
      return;
    }
    console.log(`ユーザー ${message.author.id} は許可されたロール（ID: ${allowedRoleId}）を持っています、処理を続行`);
  } else {
    console.log('DMメッセージ、ロールチェックをスキップ');
  }

  // コマンド、メンション、リプライのチェック
  let userInput = '';
  let isChatCommand = message.content.toLowerCase().startsWith('!chat');
  let isMention = message.mentions.has(client.user);
  let isReplyToBot = false;

  // リプライの場合、参照メッセージの送信者がボットか確認
  if (message.reference && message.reference.messageId) {
    try {
      const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
      if (referencedMessage.author.id === client.user.id) {
        isReplyToBot = true;
      }
    } catch (error) {
      console.error('[DEBUG] リプライメッセージの取得エラー:', error);
    }
  }

  if (!isChatCommand && !isMention && !isReplyToBot) {
    console.log('[DEBUG] !chatコマンド、メンション、リプライでないため無視');
    return;
  }

  try {
    await message.react('😺');
    console.log('ユーザーメッセージにリアクション😺を追加');
  } catch (error) {
    console.error('ユーザーメッセージへのリアクション追加エラー:', error);
  }

  // 入力内容の取得
  if (isChatCommand) {
    userInput = message.content.slice(5).trim();
    console.log('[DEBUG] !chatコマンド検出、入力:', userInput);
  } else if (isMention || isReplyToBot) {
    userInput = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
    console.log(`[DEBUG] ${isMention ? 'メンション' : 'リプライ'}検出、入力:`, userInput);
  }

  if (!userInput) {
    await message.channel.send('何かお話ししてください！');
    return;
  }

  try {
    await message.channel.sendTyping();
    console.log('入力中表示を開始');

    const userId = message.author.id;
    if (!chatHistories.has(userId)) {
      chatHistories.set(userId, []);
    }
    const history = chatHistories.get(userId);

    // 日本語応答を強制するプロンプト
    const prompt = `以下の指示に従ってください：
1. 必ず日本語で応答してください。
2. 応答内容を15行以内にしてください。
ユーザーの入力: ${userInput}`;

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(prompt);
    let response = await result.response.text();
    console.log(`Gemini応答: ${response}`);

    // 応答を20行以内に要約
    response = summarizeResponse(response);

    // ロールプレイ要素を適用（絵文字なし）
    response = applyRoleplay(response, userInput);

    const chunks = response.match(/.{1,2000}/g) || [response];
    for (const chunk of chunks) {
      await message.channel.send(chunk);
    }

    history.push(
      { role: 'user', parts: [{ text: userInput }] },
      { role: 'model', parts: [{ text: response }] }
    );

    if (history.length > 20) {
      history.splice(0, 2);
    }
  } catch (error) {
    console.error('エラー:', error);
    await message.channel.send('エラーが発生しました！ 詳細: ' + error.message);
  }
});

// エラーハンドリング
client.on('error', (error) => {
  console.error('クライアントエラー:', error);
});

// ログイン処理
client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error('ログイン失敗:', error);
  console.error('エラー詳細:', JSON.stringify(error, null, 2));
  console.error('使用されたトークン:', process.env.DISCORD_TOKEN ? '設定済み' : '未設定');
  if (error.httpStatus) {
    console.error('HTTPステータス:', error.httpStatus);
  }
  if (error.code) {
    console.error('エラーコード:', error.code);
  }
});
