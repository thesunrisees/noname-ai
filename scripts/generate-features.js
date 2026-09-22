#!/usr/bin/env node
/**
 * 自动扫描 score/ 目录下的模块，提取文件头注释，生成功能列表
 * 用法：node scripts/generate-features.js
 * 输出：直接打印到控制台，可以重定向到文件
 */

const fs = require('fs');
const path = require('path');

const SCORE_DIR = path.join(__dirname, '..', 'score');

function extractModuleHeader(filepath) {
    const content = fs.readFileSync(filepath, 'utf-8');
    const lines = content.split('\n');
    
    // 找文件头注释块
    let inComment = false;
    const commentLines = [];
    let moduleName = '';
    let description = '';
    
    for (let i = 0; i < Math.min(lines.length, 30); i++) {
        const line = lines[i];
        
        // 开始注释
        if (line.includes('/**') || line.includes('/* ===')) {
            inComment = true;
            continue;
        }
        
        // 结束注释
        if (inComment && line.includes('*/')) {
            inComment = false;
            break;
        }
        
        // 收集注释内容
        if (inComment) {
            const cleaned = line.replace(/^\s*\*\s?/, '').replace(/^\s*\/\/\s?/, '').trim();
            if (cleaned) commentLines.push(cleaned);
        }
        
        // 找 export 行确定模块名
        if (!moduleName && line.includes('export') && line.includes('function')) {
            const match = line.match(/export\s+function\s+(\w+)/);
            if (match) moduleName = match[1];
        }
    }
    
    if (commentLines.length > 0) {
        description = commentLines.join(' ');
    }
    
    return { moduleName, description, file: path.basename(filepath) };
}

function main() {
    const files = fs.readdirSync(SCORE_DIR)
        .filter(f => f.endsWith('.js') && !f.endsWith('.bak'))
        .sort();
    
    const modules = [];
    
    files.forEach(file => {
        const filepath = path.join(SCORE_DIR, file);
        const info = extractModuleHeader(filepath);
        if (info.description) {
            modules.push(info);
        }
    });
    
    // 按功能分类
    const categories = {
        '核心引擎': [],
        '特征与权重': [],
        '学习与校准': [],
        '决策与仲裁': [],
        '进化与协同': [],
        '观测与面板': [],
        '其他': [],
    };
    
    modules.forEach(m => {
        const desc = m.description.toLowerCase();
        const file = m.file.toLowerCase();
        
        if (file.includes('engine') || file.includes('index') || file.includes('logger') || file.includes('util')) {
            categories['核心引擎'].push(m);
        } else if (file.includes('feature') || file.includes('weight') || file.includes('mini-model')) {
            categories['特征与权重'].push(m);
        } else if (file.includes('meta') || file.includes('calibrat') || file.includes('element') || file.includes('feedback') || file.includes('cross') || file.includes('learning')) {
            categories['学习与校准'].push(m);
        } else if (file.includes('strategy') || file.includes('guard') || file.includes('confidence') || file.includes('conflict') || file.includes('planner') || file.includes('tree')) {
            categories['决策与仲裁'].push(m);
        } else if (file.includes('evolution') || file.includes('hotswap') || file.includes('shared') || file.includes('multi') || file.includes('compare')) {
            categories['进化与协同'].push(m);
        } else if (file.includes('panel') || file.includes('dashboard') || file.includes('replay') || file.includes('selfcheck') || file.includes('chart')) {
            categories['观测与面板'].push(m);
        } else {
            categories['其他'].push(m);
        }
    });
    
    // 生成 Markdown
    let output = '# 功能模块列表（自动生成）\n\n';
    output += `> 共 ${modules.length} 个模块，自动从 score/ 目录扫描生成\n\n`;
    
    Object.keys(categories).forEach(cat => {
        if (categories[cat].length === 0) return;
        output += `## ${cat}\n\n`;
        categories[cat].forEach(m => {
            output += `- **${m.file}**：${m.description}\n`;
        });
        output += '\n';
    });
    
    console.log(output);
}

main();
