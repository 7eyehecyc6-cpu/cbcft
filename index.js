require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    SlashCommandBuilder, 
    REST, 
    Routes,
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    EmbedBuilder, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require('discord.js');
const { Octokit } = require('@octokit/rest');
const axios = require('axios');

const CONFIG_REPO_NAME = 'bot-config-storage'; 
const userTokens = new Map();
const userSession = new Map();

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// --- 1. KHAI BÁO CÁC SLASH COMMANDS ---
const commands = [
    new SlashCommandBuilder()
        .setName('stk')
        .setDescription('Khởi tạo kho lưu trữ bí mật và nạp Token lần đầu')
        .addStringOption(option =>
            option.setName('git_token').setDescription('GitHub Personal Access Token (PAT)').setRequired(true)
        )
        .addStringOption(option =>
            option.setName('railway_token').setDescription('Railway API Token (Tuỳ chọn)').setRequired(false)
        )
        .addStringOption(option =>
            option.setName('render_token').setDescription('Render API Key (Tuỳ chọn)').setRequired(false)
        ),
    new SlashCommandBuilder()
        .setName('kho')
        .setDescription('Nhập Git Token để đồng bộ & xem lại toàn bộ Token đã lưu trong kho')
        .addStringOption(option =>
            option.setName('git_token').setDescription('Mã GitHub Token của bạn').setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('rgit')
        .setDescription('Đổi GitHub Token trong kho lưu trữ')
        .addStringOption(option =>
            option.setName('token').setDescription('Mã GitHub Token mới').setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('rra')
        .setDescription('Đổi Railway Token trong kho lưu trữ')
        .addStringOption(option =>
            option.setName('token').setDescription('Mã Railway Token mới').setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('rren')
        .setDescription('Đổi Render API Key trong kho lưu trữ')
        .addStringOption(option =>
            option.setName('token').setDescription('Mã Render API Key mới').setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('new')
        .setDescription('Mở bảng nhập để tạo Bot/Repo mới trên GitHub'),
    new SlashCommandBuilder()
        .setName('vo')
        .setDescription('Tương tác UI để chọn Server/Kênh và Deploy Selfbot Voice 24/7 (Kèm Anti-Sleep Ping)')
].map(cmd => cmd.toJSON());

// --- 2. CÁC HÀM XỬ LÝ KHO LƯU TRỮ GITHUB PRIVATE ---
async function saveToPrivateStorage(userId, gitToken, railwayToken, renderToken) {
    const octokit = new Octokit({ auth: gitToken });
    const { data: user } = await octokit.rest.users.getAuthenticated();
    const owner = user.login;

    try {
        await octokit.rest.repos.get({ owner, repo: CONFIG_REPO_NAME });
    } catch (e) {
        await octokit.rest.repos.createForAuthenticatedUser({
            name: CONFIG_REPO_NAME,
            private: true,
            auto_init: true,
            description: 'Kho lưu trữ Token bảo mật cá nhân'
        });
        await new Promise(r => setTimeout(r, 2000));
    }

    const path = `tokens_${userId}.json`;
    let sha = null;
    let existingData = { gitToken: '', railwayToken: '', renderToken: '' };

    try {
        const res = await octokit.rest.repos.getContent({ owner, repo: CONFIG_REPO_NAME, path });
        sha = res.data.sha;
        const oldContent = Buffer.from(res.data.content, 'base64').toString('utf-8');
        existingData = JSON.parse(oldContent);
    } catch (e) {}

    const dataToSave = {
        gitToken: gitToken || existingData.gitToken,
        railwayToken: railwayToken !== undefined ? railwayToken : existingData.railwayToken,
        renderToken: renderToken !== undefined