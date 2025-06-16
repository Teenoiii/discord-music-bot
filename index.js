require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior } = require('@discordjs/voice');
const ytdl = require('@distube/ytdl-core');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', () => {
    console.log(`✅ บอทออนไลน์แล้วในชื่อ ${client.user.tag}`);
});

client.on('messageCreate', async message => {
    console.log(`[LOG] รับข้อความ: ${message.content}`);

    if (!message.content.startsWith('!play') || message.author.bot) return;

    const args = message.content.split(' ');
    const url = args[1];

    if (!ytdl.validateURL(url)) {
        return message.channel.send('❌ กรุณาใส่ลิงก์ YouTube ที่ถูกต้อง');
    }

    try {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.channel.send('🔊 กรุณาเข้าห้องเสียงก่อน');

        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator,
        });

        const stream = ytdl(url, { filter: 'audioonly', highWaterMark: 1 << 25 });
        stream.on('error', err => {
            console.error('[STREAM ERROR]', err.message || err);
            message.channel.send(`❌ ไม่สามารถโหลดเสียง: ${err.message || err}`);
        });


        const resource = createAudioResource(stream, { inlineVolume: true });
        const player = createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Pause
            }
        });

        player.play(resource);
        connection.subscribe(player);

        player.on(AudioPlayerStatus.Idle, () => {
            connection.destroy();
        });

        message.channel.send(`🎶 กำลังเล่น: ${url}`);
    } catch (err) {
        console.error(`[ERROR] ${err}`);
        message.channel.send('❌ เกิดข้อผิดพลาดในการเล่นเพลง');
    }
});

client.login(process.env.DISCORD_TOKEN);
// ..........................................................................................................................................................................