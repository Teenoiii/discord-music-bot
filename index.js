require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    NoSubscriberBehavior
} = require('@discordjs/voice');
const play = require('play-dl');

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

    if (!play.yt_validate(url)) {
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

        const stream = await play.stream(url);
        const resource = createAudioResource(stream.stream, { inputType: stream.type });
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


// ป้องกัน Render ปิดโปรเซส
setInterval(() => { }, 1000 * 60 * 5);