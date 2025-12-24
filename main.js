[file name]: main.js
[file content begin]
// 全局变量
let isLoggedIn = false;
let currentEditData = null;
let deleteCallback = null;
let draggedElement = null;
let db = null;

// 默认数据（空白）
const defaultData = {
    projectInfo: {
        name: "",
        number: "",
        leader: "",
        duration: ""
    },
    projectIntro: "",
    papers: [],
    awards: [],
    students: [],
    conferences: []
};

// 数据管理
class DataManager {
    static save(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }
    
    static load(key, defaultValue = null) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
    }
    
    static remove(key) {
        localStorage.removeItem(key);
    }
}

// DOM元素
const elements = {
    loginBtn: document.getElementById('loginBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    exportBtn: document.getElementById('exportBtn'),
    exportSection: document.getElementById('exportSection'),
    exportAllBtn: document.getElementById('exportAllBtn'),
    exportMainBtn: document.getElementById('exportMainBtn'),
    exportPaperDetailsBtn: document.getElementById('exportPaperDetailsBtn'),
    loginModal: document.getElementById('loginModal'),
    loginForm: document.getElementById('loginForm'),
    editModal: document.getElementById('editModal'),
    confirmModal: document.getElementById('confirmModal'),
    editProjectBtn: document.getElementById('editProjectBtn'),
    editIntroBtn: document.getElementById('editIntroBtn'),
    changeBgBtn: document.getElementById('changeBgBtn'),
    bgInput: document.getElementById('bgInput')
};

// 修复模态框bug的变量
let isMouseDownOnModal = false;
let mouseDownTarget = null;

// IndexedDB初始化
function initIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('paperDetailsDB', 1);
        
        request.onerror = function(event) {
            console.error('IndexedDB打开失败:', event.target.error);
            reject(event.target.error);
        };
        
        request.onsuccess = function(event) {
            db = event.target.result;
            console.log('IndexedDB初始化成功');
            resolve(db);
        };
        
        request.onupgradeneeded = function(event) {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('paperDetails')) {
                const objectStore = db.createObjectStore('paperDetails', { keyPath: 'paperId' });
                objectStore.createIndex('paperId', 'paperId', { unique: true });
                console.log('IndexedDB对象存储创建成功');
            }
        };
    });
}

// 从IndexedDB获取所有论文详情数据
async function getAllPaperDetailsFromIndexedDB() {
    if (!db) {
        await initIndexedDB();
    }
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['paperDetails'], 'readonly');
        const objectStore = transaction.objectStore('paperDetails');
        const request = objectStore.getAll();
        
        request.onsuccess = function(event) {
            const allPaperDetails = {};
            event.target.result.forEach(item => {
                allPaperDetails[item.paperId] = item;
            });
            resolve(allPaperDetails);
        };
        
        request.onerror = function(event) {
            reject('从IndexedDB获取数据失败: ' + event.target.error);
        };
    });
}

// 从localStorage获取论文详情数据（兼容旧版本）
function getPaperDetailsFromLocalStorage() {
    const paperDetails = DataManager.load('paperDetails', {});
    return paperDetails;
}

// 获取所有论文详情数据（优先从IndexedDB，如果没有则从localStorage）
async function getAllPaperDetails() {
    try {
        // 先尝试从IndexedDB获取
        const indexedDBData = await getAllPaperDetailsFromIndexedDB();
        if (indexedDBData && Object.keys(indexedDBData).length > 0) {
            return indexedDBData;
        }
    } catch (error) {
        console.log('从IndexedDB获取数据失败，尝试从localStorage获取:', error);
    }
    
    // 如果IndexedDB没有数据，从localStorage获取
    return getPaperDetailsFromLocalStorage();
}

// 导出首页数据为JSON文件
function exportMainData() {
    const projectData = DataManager.load('projectData', defaultData);
    const jsonStr = JSON.stringify(projectData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('首页数据已导出为 data.json', 'success');
}

// 导出论文详情数据为JSON文件
async function exportPaperDetailsData() {
    try {
        showNotification('正在获取论文详情数据...', 'info');
        
        // 获取所有论文详情数据
        const paperDetails = await getAllPaperDetails();
        
        if (!paperDetails || Object.keys(paperDetails).length === 0) {
            showNotification('没有找到论文详情数据', 'warning');
            return;
        }
        
        const jsonStr = JSON.stringify(paperDetails, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'paperDetails.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification(`论文详情数据已导出，包含 ${Object.keys(paperDetails).length} 篇论文的数据`, 'success');
    } catch (error) {
        console.error('导出论文详情数据失败:', error);
        showNotification('导出失败: ' + error, 'error');
    }
}

// 一键导出所有数据
async function exportAllData() {
    try {
        showNotification('正在准备导出所有数据...', 'info');
        
        // 导出首页数据
        exportMainData();
        
        // 导出论文详情数据
        await exportPaperDetailsData();
        
        showNotification('所有数据导出完成！', 'success');
    } catch (error) {
        console.error('导出所有数据失败:', error);
        showNotification('导出失败: ' + error, 'error');
    }
}

// 主初始化函数
async function initializePage() {
    // 检查登录状态
    isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
    
    try {
        // 从data.json加载数据
        const response = await fetch('data.json');
        if (!response.ok) {
            throw new Error('无法加载数据文件');
        }
        
        const jsonData = await response.json();
        
        // 直接使用data.json中的数据，不需要解析字符串
        const projectData = jsonData;
        
        // 保存到localStorage（以便离线使用）
        DataManager.save('projectData', projectData);
        
        // 初始化IndexedDB
        await initIndexedDB();
        
        // 渲染所有内容
        renderAllContent(projectData);
    } catch (error) {
        console.error('加载数据失败:', error);
        
        // 如果加载失败，尝试从localStorage加载
        let projectData = DataManager.load('projectData');
        if (!projectData) {
            // 如果localStorage也没有，使用空白数据
            projectData = defaultData;
            DataManager.save('projectData', projectData);
        }
        
        // 初始化IndexedDB
        await initIndexedDB();
        
        // 渲染内容
        renderAllContent(projectData);
    }
    
    // 加载自定义背景
    loadCustomBackground();
    
    // 添加动画
    anime({
        targets: '.fade-in',
        opacity: [0, 1],
        translateY: [30, 0],
        duration: 800,
        delay: anime.stagger(200),
        easing: 'easeOutQuad'
    });
}

// 统一渲染函数
function renderAllContent(projectData) {
    renderProjectInfo(projectData);
    renderProjectIntro(projectData);
    renderPapers(projectData);
    renderAwards(projectData);
    renderStudents(projectData);
    renderConferences(projectData);
    updateUI();
}

// 获取当前数据
function getCurrentData() {
    return DataManager.load('projectData', defaultData);
}

// 渲染项目信息
function renderProjectInfo(projectData) {
    const data = projectData || getCurrentData();
    const container = document.getElementById('projectInfo');
    container.innerHTML = `
        <div class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">项目名称</label>
                <p class="text-gray-900">${data.projectInfo.name || '暂无数据'}</p>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">项目编号</label>
                <p class="text-gray-900">${data.projectInfo.number || '暂无数据'}</p>
            </div>
        </div>
        <div class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">项目负责人</label>
                <p class="text-gray-900">${data.projectInfo.leader || '暂无数据'}</p>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">执行期限</label>
                <p class="text-gray-900">${data.projectInfo.duration || '暂无数据'}</p>
            </div>
        </div>
    `;
}

// 渲染项目简介
function renderProjectIntro(projectData) {
    const data = projectData || getCurrentData();
    document.getElementById('projectIntro').textContent = data.projectIntro || '暂无项目简介';
}

// 渲染论文成果
function renderPapers(projectData) {
    const data = projectData || getCurrentData();
    const container = document.querySelector('.papers-container');
    
    if (data.papers.length === 0) {
        container.innerHTML = '<p class="text-blue-100 text-center py-4">暂无论文数据</p>';
        return;
    }
    
    container.innerHTML = data.papers.map(paper => `
        <div class="paper-item bg-white bg-opacity-10 rounded-lg p-4 border border-white border-opacity-20" data-id="${paper.id}" draggable="true">
            <div class="flex justify-between items-start mb-3">
                <div class="flex-1">
                    <div class="flex items-start justify-between mb-2">
                        <h4 class="text-lg font-semibold text-white flex-1 mr-4">${paper.title}</h4>
                        <div class="flex space-x-2">
                            <button onclick="viewPaperDetails(${paper.id})" class="bg-blue-400 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm whitespace-nowrap">查看详情</button>
                        </div>
                    </div>
                    <div class="flex flex-wrap gap-4 text-sm text-blue-100 mb-2">
                        <span><strong>发表时间：</strong>${paper.time || '暂无'}</span>
                        <span><strong>发表期刊：</strong>${paper.journal || '暂无'}</span>
                        <span><strong>论文作者：</strong>${paper.authors || '暂无'}</span>
                    </div>
                </div>
                <div class="edit-btn ${isLoggedIn ? '' : 'hidden'} space-x-2 ml-4">
                    <button onclick="editPaper(${paper.id})" class="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm">编辑</button>
                    <button onclick="deletePaper(${paper.id})" class="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-sm">删除</button>
                </div>
            </div>
            <div class="abstract-section">
                <button onclick="toggleAbstract(this)" class="text-yellow-300 hover:text-yellow-200 font-medium text-sm">
                    查看摘要
                </button>
                <div class="abstract-content hidden mt-3 p-3 bg-white bg-opacity-10 rounded-lg text-blue-100 text-sm">
                    ${paper.abstract || '暂无摘要'}
                </div>
            </div>
        </div>
    `).join('');
    
    // 添加拖拽事件
    if (isLoggedIn) {
        addDragAndDropListeners(container, 'papers');
    }
}

// 渲染荣誉奖项
function renderAwards(projectData) {
    const data = projectData || getCurrentData();
    const container = document.querySelector('.awards-container');
    
    if (data.awards.length === 0) {
        container.innerHTML = '<p class="text-blue-100 text-center py-4">暂无奖项数据</p>';
        return;
    }
    
    container.innerHTML = data.awards.map(award => `
        <div class="award-item bg-white bg-opacity-10 rounded-lg p-4 border border-white border-opacity-20" data-id="${award.id}" draggable="true">
            <div class="flex justify-between items-center">
                <div class="flex-1">
                    <h4 class="text-lg font-semibold text-white">${award.name}</h4>
                    <p class="text-sm text-blue-100">获奖年份：${award.year || '暂无'}</p>
                </div>
                <div class="edit-btn ${isLoggedIn ? '' : 'hidden'} space-x-2">
                    <button onclick="editAward(${award.id})" class="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm">编辑</button>
                    <button onclick="deleteAward(${award.id})" class="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-sm">删除</button>
                </div>
            </div>
        </div>
    `).join('');
    
    // 添加拖拽事件
    if (isLoggedIn) {
        addDragAndDropListeners(container, 'awards');
    }
}

// 渲染优秀学生
function renderStudents(projectData) {
    const data = projectData || getCurrentData();
    const container = document.querySelector('.students-container');
    
    if (data.students.length === 0) {
        container.innerHTML = '<p class="text-blue-100 text-center py-4">暂无学生数据</p>';
        return;
    }
    
    container.innerHTML = data.students.map(student => `
        <div class="student-item bg-white bg-opacity-10 rounded-lg p-4 border border-white border-opacity-20" data-id="${student.id}" draggable="true">
            <div class="flex justify-between items-start">
                <div class="grid grid-cols-3 gap-4 flex-1 items-start">
                    <div class="flex flex-col items-start">
                        <label class="block text-xs font-medium text-blue-200 mb-1">学生姓名</label>
                        <p class="text-white font-semibold align-top">${student.name}</p>
                    </div>
                    <div class="col-span-2 flex flex-col items-start">
                        <label class="block text-xs font-medium text-blue-200 mb-1">获奖名称</label>
                        <div class="text-blue-100 whitespace-pre-wrap align-top">${formatMultilineText(student.achievements) || '暂无'}</div>
                    </div>
                </div>
                <div class="edit-btn ${isLoggedIn ? '' : 'hidden'} space-x-2 ml-4 mt-6">
                    <button onclick="editStudent(${student.id})" class="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm">编辑</button>
                    <button onclick="deleteStudent(${student.id})" class="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-sm">删除</button>
                </div>
            </div>
        </div>
    `).join('');
    
    // 添加拖拽事件
    if (isLoggedIn) {
        addDragAndDropListeners(container, 'students');
    }
}

// 辅助函数：处理多行文本显示
function formatMultilineText(text) {
    return text ? text.replace(/\\n/g, '\n') : '';
}

// 渲染学术会议
function renderConferences(projectData) {
    const data = projectData || getCurrentData();
    const container = document.querySelector('.conferences-container');
    
    if (data.conferences.length === 0) {
        container.innerHTML = '<p class="text-blue-100 text-center py-4">暂无会议数据</p>';
        return;
    }
    
    container.innerHTML = data.conferences.map(conference => `
        <div class="conference-item bg-white bg-opacity-10 rounded-lg p-4 border border-white border-opacity-20" data-id="${conference.id}" draggable="true">
            <div class="flex justify-between items-center">
                <div class="flex-1">
                    <h4 class="text-lg font-semibold text-white">${conference.name}</h4>
                    <div class="flex gap-4 text-sm text-blue-100">
                        <span><strong>举办地点：</strong>${conference.location || '暂无'}</span>
                        <span><strong>状态：</strong>${conference.status || '参会'}</span>
                    </div>
                </div>
                <div class="edit-btn ${isLoggedIn ? '' : 'hidden'} space-x-2">
                    <button onclick="editConference(${conference.id})" class="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm">编辑</button>
                    <button onclick="deleteConference(${conference.id})" class="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-sm">删除</button>
                </div>
            </div>
        </div>
    `).join('');
    
    // 添加拖拽事件
    if (isLoggedIn) {
        addDragAndDropListeners(container, 'conferences');
    }
}

// 添加拖拽排序功能
function addDragAndDropListeners(container, dataType) {
    const items = container.querySelectorAll('[draggable="true"]');
    
    items.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragend', handleDragEnd);
    });
}

function handleDragStart(e) {
    draggedElement = this;
    this.style.opacity = '0.5';
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    return false;
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    if (draggedElement !== this) {
        const container = this.parentNode;
        const draggedIndex = Array.from(container.children).indexOf(draggedElement);
        const targetIndex = Array.from(container.children).indexOf(this);
        
        if (draggedIndex < targetIndex) {
            container.insertBefore(draggedElement, this.nextSibling);
        } else {
            container.insertBefore(draggedElement, this);
        }
        
        // 更新数据顺序
        updateDataOrder(container);
    }
    
    return false;
}

function handleDragEnd(e) {
    this.style.opacity = '1';
    
    const items = this.parentNode.querySelectorAll('[draggable="true"]');
    items.forEach(item => {
        item.style.opacity = '1';
    });
}

function updateDataOrder(container) {
    const data = getCurrentData();
    const items = container.querySelectorAll('[data-id]');
    const itemIds = Array.from(items).map(item => parseInt(item.dataset.id));
    
    // 确定数据类型
    let dataType;
    if (container.classList.contains('papers-container')) {
        dataType = 'papers';
    } else if (container.classList.contains('awards-container')) {
        dataType = 'awards';
    } else if (container.classList.contains('students-container')) {
        dataType = 'students';
    } else if (container.classList.contains('conferences-container')) {
        dataType = 'conferences';
    }
    
    if (dataType) {
        // 重新排序数据
        const originalData = [...data[dataType]];
        data[dataType] = itemIds.map(id => originalData.find(item => item.id === id));
        
        // 保存到localStorage
        DataManager.save('projectData', data);
        showNotification('排序已更新', 'success');
    }
}

// 查看论文详情 - 在新标签页打开
function viewPaperDetails(paperId) {
    window.open(`paper-detail.html?id=${paperId}`, '_blank');
}

// 切换摘要显示
function toggleAbstract(button) {
    const content = button.nextElementSibling;
    const isHidden = content.classList.contains('hidden');
    
    if (isHidden) {
        content.classList.remove('hidden');
        button.textContent = '收起摘要';
        anime({
            targets: content,
            opacity: [0, 1],
            translateY: [-10, 0],
            duration: 300,
            easing: 'easeOutQuad'
        });
    } else {
        anime({
            targets: content,
            opacity: [1, 0],
            translateY: [0, -10],
            duration: 300,
            easing: 'easeInQuad',
            complete: () => {
                content.classList.add('hidden');
                button.textContent = '查看摘要';
            }
        });
    }
}

// 独立控制每个板块的展开状态
function toggleSection(button, sectionId) {
    const sectionCard = button.closest('.section-card');
    const content = sectionCard.querySelector('.section-content');
    const isHidden = !content.classList.contains('show');
    
    if (isHidden) {
        content.classList.add('show');
        button.textContent = '收起';
        sectionCard.classList.add('active');
        
        anime({
            targets: content,
            opacity: [0, 1],
            translateY: [-10, 0],
            duration: 300,
            easing: 'easeOutQuad'
        });
    } else {
        anime({
            targets: content,
            opacity: [1, 0],
            translateY: [0, -10],
            duration: 300,
            easing: 'easeInQuad',
            complete: () => {
                content.classList.remove('show');
                button.textContent = '展开查看';
                sectionCard.classList.remove('active');
            }
        });
    }
}

// 登录功能
function showLoginModal() {
    elements.loginModal.classList.add('show');
    document.getElementById('username').focus();
}

function hideLoginModal() {
    elements.loginModal.classList.remove('show');
    elements.loginForm.reset();
}

function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    
    // 修改管理员账号和密码为123和123
    if (username === '123' && password === '123') {
        isLoggedIn = true;
        sessionStorage.setItem('isLoggedIn', 'true');
        hideLoginModal();
        updateUI();
        showNotification('登录成功！', 'success');
        
        // 重新渲染以启用拖拽功能和显示编辑按钮
        const projectData = getCurrentData();
        renderPapers(projectData);
        renderAwards(projectData);
        renderStudents(projectData);
        renderConferences(projectData);
    } else {
        showNotification('用户名或密码错误！', 'error');
    }
}

// 退出登录
function logout() {
    isLoggedIn = false;
    sessionStorage.removeItem('isLoggedIn');
    updateUI();
    showNotification('已退出登录！', 'info');
    
    // 重新渲染以隐藏编辑按钮
    const projectData = getCurrentData();
    renderPapers(projectData);
    renderAwards(projectData);
    renderStudents(projectData);
    renderConferences(projectData);
}

// 更新UI
function updateUI() {
    const editBtns = document.querySelectorAll('.edit-btn');
    
    if (isLoggedIn) {
        elements.loginBtn.classList.add('hidden');
        elements.logoutBtn.classList.remove('hidden');
        elements.exportBtn.classList.remove('hidden');
        elements.exportSection.classList.remove('hidden');
        editBtns.forEach(btn => btn.classList.remove('hidden'));
    } else {
        elements.loginBtn.classList.remove('hidden');
        elements.logoutBtn.classList.add('hidden');
        elements.exportBtn.classList.add('hidden');
        elements.exportSection.classList.add('hidden');
        editBtns.forEach(btn => btn.classList.add('hidden'));
    }
}

// 通知系统
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-20 right-4 z-50 p-4 rounded-lg shadow-lg text-white max-w-sm ${type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    anime({
        targets: notification,
        translateX: [300, 0],
        opacity: [0, 1],
        duration: 300,
        easing: 'easeOutQuad'
    });
    
    setTimeout(() => {
        anime({
            targets: notification,
            translateX: [0, 300],
            opacity: [1, 0],
            duration: 300,
            easing: 'easeInQuad',
            complete: () => notification.remove()
        });
    }, 3000);
}

// 项目信息编辑
function editProjectInfo() {
    const data = getCurrentData();
    showEditModal('编辑项目信息', `
        <div class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">项目名称</label>
                <input type="text" id="projectName" value="${data.projectInfo.name}" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">项目编号</label>
                <input type="text" id="projectNumber" value="${data.projectInfo.number}" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">项目负责人</label>
                <input type="text" id="projectLeader" value="${data.projectInfo.leader}" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">执行期限</label>
                <input type="text" id="projectDuration" value="${data.projectInfo.duration}" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            </div>
        </div>
    `, () => {
        const data = getCurrentData();
        const newData = { ...data };
        newData.projectInfo = {
            name: document.getElementById('projectName').value,
            number: document.getElementById('projectNumber').value,
            leader: document.getElementById('projectLeader').value,
            duration: document.getElementById('projectDuration').value
        };
        DataManager.save('projectData', newData);
        renderProjectInfo(newData);
        showNotification('项目信息已更新！', 'success');
    });
}

// 项目简介编辑
function editProjectIntro() {
    const data = getCurrentData();
    showEditModal('编辑项目简介', `
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">项目简介</label>
            <textarea id="projectIntroText" rows="6" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">${data.projectIntro}</textarea>
        </div>
    `, () => {
        const data = getCurrentData();
        const newData = { ...data };
        newData.projectIntro = document.getElementById('projectIntroText').value;
        DataManager.save('projectData', newData);
        renderProjectIntro(newData);
        showNotification('项目简介已更新！', 'success');
    });
}

// 显示编辑模态框
function showEditModal(title, content, saveCallback) {
    document.getElementById('editModalTitle').textContent = title;
    document.getElementById('editModalContent').innerHTML = content;
    elements.editModal.classList.add('show');
    
    currentEditData = { saveCallback };
}

// 隐藏编辑模态框
function hideEditModal() {
    elements.editModal.classList.remove('show');
    currentEditData = null;
}

// 保存编辑内容
function saveEditContent() {
    if (currentEditData && currentEditData.saveCallback) {
        try {
            currentEditData.saveCallback();
            hideEditModal();
        } catch (error) {
            console.error('保存出错:', error);
            showNotification('保存失败，请重试！', 'error');
        }
    }
}

// 显示确认对话框
function showConfirmModal(message, callback) {
    document.getElementById('confirmMessage').textContent = message;
    elements.confirmModal.classList.add('show');
    deleteCallback = callback;
}

// 隐藏确认对话框
function hideConfirmModal() {
    elements.confirmModal.classList.remove('show');
    deleteCallback = null;
}

// 确认删除
function confirmDelete() {
    if (deleteCallback) {
        deleteCallback();
        hideConfirmModal();
    }
}

// 编辑论文
function editPaper(id) {
    const data = getCurrentData();
    const paper = data.papers.find(p => p.id === id);
    if (!paper) return;
    
    showEditModal('编辑论文', `
        <div class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">论文标题</label>
                <input type="text" id="paperTitle" value="${paper.title}" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">发表期刊</label>
                <input type="text" id="paperJournal" value="${paper.journal}" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">发表时间</label>
                <input type="text" id="paperTime" value="${paper.time}" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">论文作者</label>
                <input type="text" id="paperAuthors" value="${paper.authors}" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">摘要</label>
                <textarea id="paperAbstract" rows="4" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">${paper.abstract || ''}</textarea>
            </div>
        </div>
    `, () => {
        const data = getCurrentData();
        const paperIndex = data.papers.findIndex(p => p.id === id);
        if (paperIndex !== -1) {
            data.papers[paperIndex] = {
                ...data.papers[paperIndex],
                title: document.getElementById('paperTitle').value,
                journal: document.getElementById('paperJournal').value,
                time: document.getElementById('paperTime').value,
                authors: document.getElementById('paperAuthors').value,
                abstract: document.getElementById('paperAbstract').value
            };
            
            DataManager.save('projectData', data);
            renderPapers(data);
            updateUI(); // 确保编辑按钮保持可见
            showNotification('论文信息已更新！', 'success');
        }
    });
}

// 删除论文
function deletePaper(id) {
    showConfirmModal('确定要删除这篇论文吗？', () => {
        const data = getCurrentData();
        data.papers = data.papers.filter(p => p.id !== id);
        DataManager.save('projectData', data);
        renderPapers(data);
        updateUI(); // 确保编辑按钮保持可见
        showNotification('论文已删除！', 'success');
    });
}

// 编辑奖项
function editAward(id) {
    const data = getCurrentData();
    const award = data.awards.find(a => a.id === id);
    if (!award) return;
    
    showEditModal('编辑奖项', `
        <div class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">奖项名称</label>
                <input type="text" id="awardName" value="${award.name}" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">获奖年份</label>
                <input type="text" id="awardYear" value="${award.year}" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            </div>
        </div>
    `, () => {
        const data = getCurrentData();
        const awardIndex = data.awards.findIndex(a => a.id === id);
        if (awardIndex !== -1) {
            data.awards[awardIndex] = {
                ...data.awards[awardIndex],
                name: document.getElementById('awardName').value,
                year: document.getElementById('awardYear').value
            };
            
            DataManager.save('projectData', data);
            renderAwards(data);
            updateUI(); // 确保编辑按钮保持可见
            showNotification('奖项信息已更新！', 'success');
        }
    });
}

// 删除奖项
function deleteAward(id) {
    showConfirmModal('确定要删除这个奖项吗？', () => {
        const data = getCurrentData();
        data.awards = data.awards.filter(a => a.id !== id);
        DataManager.save('projectData', data);
        renderAwards(data);
        updateUI(); // 确保编辑按钮保持可见
        showNotification('奖项已删除！', 'success');
    });
}

// 编辑学生
function editStudent(id) {
    const data = getCurrentData();
    const student = data.students.find(s => s.id === id);
    if (!student) return;
    
    showEditModal('编辑学生信息', `
        <div class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">学生姓名</label>
                <input type="text" id="studentName" value="${student.name}" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">获奖名称（每行一个）</label>
                <textarea id="studentAchievements" rows="4" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">${student.achievements || ''}</textarea>
            </div>
        </div>
    `, () => {
        const data = getCurrentData();
        const studentIndex = data.students.findIndex(s => s.id === id);
        if (studentIndex !== -1) {
            data.students[studentIndex] = {
                ...data.students[studentIndex],
                name: document.getElementById('studentName').value,
                achievements: document.getElementById('studentAchievements').value
            };
            
            DataManager.save('projectData', data);
            renderStudents(data);
            updateUI(); // 确保编辑按钮保持可见
            showNotification('学生信息已更新！', 'success');
        }
    });
}

// 删除学生
function deleteStudent(id) {
    showConfirmModal('确定要删除这个学生吗？', () => {
        const data = getCurrentData();
        data.students = data.students.filter(s => s.id !== id);
        DataManager.save('projectData', data);
        renderStudents(data);
        updateUI(); // 确保编辑按钮保持可见
        showNotification('学生已删除！', 'success');
    });
}

// 编辑会议
function editConference(id) {
    const data = getCurrentData();
    const conference = data.conferences.find(c => c.id === id);
    if (!conference) return;
    
    showEditModal('编辑会议信息', `
        <div class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">会议名称</label>
                <input type="text" id="conferenceName" value="${conference.name}" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">举办地点</label>
                <input type="text" id="conferenceLocation" value="${conference.location}" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">状态</label>
                <input type="text" id="conferenceStatus" value="${conference.status || '参会'}" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            </div>
        </div>
    `, () => {
        const data = getCurrentData();
        const conferenceIndex = data.conferences.findIndex(c => c.id === id);
        if (conferenceIndex !== -1) {
            data.conferences[conferenceIndex] = {
                ...data.conferences[conferenceIndex],
                name: document.getElementById('conferenceName').value,
                location: document.getElementById('conferenceLocation').value,
                status: document.getElementById('conferenceStatus').value
            };
            
            DataManager.save('projectData', data);
            renderConferences(data);
            updateUI(); // 确保编辑按钮保持可见
            showNotification('会议信息已更新！', 'success');
        }
    });
}

// 删除会议
function deleteConference(id) {
    showConfirmModal('确定要删除这个会议吗？', () => {
        const data = getCurrentData();
        data.conferences = data.conferences.filter(c => c.id !== id);
        DataManager.save('projectData', data);
        renderConferences(data);
        updateUI(); // 确保编辑按钮保持可见
        showNotification('会议已删除！', 'success');
    });
}

// 新增功能
function addPaper() {
    const data = getCurrentData();
    const newId = Math.max(...data.papers.map(p => p.id), 0) + 1;
    
    showEditModal('新增论文', `
        <div class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">论文标题</label>
                <input type="text" id="paperTitle" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">发表期刊</label>
                <input type="text" id="paperJournal" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">发表时间</label>
                <input type="text" id="paperTime" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">论文作者</label>
                <input type="text" id="paperAuthors" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">摘要</label>
                <textarea id="paperAbstract" rows="4" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"></textarea>
            </div>
        </div>
    `, () => {
        const data = getCurrentData();
        const newPaper = {
            id: newId,
            title: document.getElementById('paperTitle').value,
            journal: document.getElementById('paperJournal').value,
            time: document.getElementById('paperTime').value,
            authors: document.getElementById('paperAuthors').value,
            abstract: document.getElementById('paperAbstract').value
        };
        
        data.papers.push(newPaper);
        DataManager.save('projectData', data);
        
        // 为新论文创建默认详情页数据
        const paperDetails = DataManager.load('paperDetails', {});
        if (!paperDetails[newId]) {
            paperDetails[newId] = {
                backgroundContent: '请添加研究背景信息',
                mainContent: '请添加主要内容信息',
                conclusionContent: '请添加主要结论信息',
                linkContent: '请添加全文链接',
                homepageImages: [],
                keyImages: []
            };
            DataManager.save('paperDetails', paperDetails);
        }
        
        renderPapers(data);
        updateUI(); // 确保编辑按钮保持可见
        showNotification('论文已添加！', 'success');
    });
}

function addAward() {
    const data = getCurrentData();
    const newId = Math.max(...data.awards.map(a => a.id), 0) + 1;
    
    showEditModal('新增奖项', `
        <div class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">奖项名称</label>
                <input type="text" id="awardName" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">获奖年份</label>
                <input type="text" id="awardYear" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            </div>
        </div>
    `, () => {
        const data = getCurrentData();
        const newAward = {
            id: newId,
            name: document.getElementById('awardName').value,
            year: document.getElementById('awardYear').value
        };
        
        data.awards.push(newAward);
        DataManager.save('projectData', data);
        renderAwards(data);
        updateUI(); // 确保编辑按钮保持可见
        showNotification('奖项已添加！', 'success');
    });
}

function addStudent() {
    const data = getCurrentData();
    const newId = Math.max(...data.students.map(s => s.id), 0) + 1;
    
    showEditModal('新增学生', `
        <div class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">学生姓名</label>
                <input type="text" id="studentName" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">获奖名称（每行一个）</label>
                <textarea id="studentAchievements" rows="4" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"></textarea>
            </div>
        </div>
    `, () => {
        const data = getCurrentData();
        const newStudent = {
            id: newId,
            name: document.getElementById('studentName').value,
            achievements: document.getElementById('studentAchievements').value
        };
        
        data.students.push(newStudent);
        DataManager.save('projectData', data);
        renderStudents(data);
        updateUI(); // 确保编辑按钮保持可见
        showNotification('学生已添加！', 'success');
    });
}

function addConference() {
    const data = getCurrentData();
    const newId = Math.max(...data.conferences.map(c => c.id), 0) + 1;
    
    showEditModal('新增会议', `
        <div class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">会议名称</label>
                <input type="text" id="conferenceName" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">举办地点</label>
                <input type="text" id="conferenceLocation" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">状态</label>
                <input type="text" id="conferenceStatus" value="参会" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            </div>
        </div>
    `, () => {
        const data = getCurrentData();
        const newConference = {
            id: newId,
            name: document.getElementById('conferenceName').value,
            location: document.getElementById('conferenceLocation').value,
            status: document.getElementById('conferenceStatus').value
        };
        
        data.conferences.push(newConference);
        DataManager.save('projectData', data);
        renderConferences(data);
        updateUI(); // 确保编辑按钮保持可见
        showNotification('会议已添加！', 'success');
    });
}

// 背景更换功能
function changeBackground() {
    elements.bgInput.click();
}

function handleBackgroundChange(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const headerBg = document.querySelector('.header-bg');
            headerBg.style.backgroundImage = `url('${e.target.result}')`;
            showNotification('背景图片已更换！', 'success');
            
            // 保存到localStorage
            DataManager.save('customBackground', e.target.result);
        };
        reader.readAsDataURL(file);
    }
}

// 加载自定义背景
function loadCustomBackground() {
    const customBg = DataManager.load('customBackground');
    if (customBg) {
        const headerBg = document.querySelector('.header-bg');
        headerBg.style.backgroundImage = `url('${customBg}')`;
    }
}

// 修复模态框bug的函数
function setupModalBugFix() {
    // 为所有模态框添加mousedown事件监听
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('mousedown', function(e) {
            isMouseDownOnModal = true;
            mouseDownTarget = e.target;
        });
        
        modal.addEventListener('mouseup', function(e) {
            // 只有当鼠标按下和释放都在同一个模态框背景上时，才关闭模态框
            if (isMouseDownOnModal && mouseDownTarget === e.target && e.target.classList.contains('modal')) {
                e.target.classList.remove('show');
            }
            isMouseDownOnModal = false;
            mouseDownTarget = null;
        });
    });
}

// 页面初始化
document.addEventListener('DOMContentLoaded', function() {
    // 启动页面
    initializePage();
    
    // 设置模态框bug修复
    setupModalBugFix();
    
    // 登录相关
    elements.loginBtn.addEventListener('click', showLoginModal);
    elements.logoutBtn.addEventListener('click', logout);
    elements.loginForm.addEventListener('submit', handleLogin);
    document.getElementById('cancelLogin').addEventListener('click', hideLoginModal);
    
    // 导出相关
    elements.exportBtn.addEventListener('click', exportAllData);
    elements.exportAllBtn.addEventListener('click', exportAllData);
    elements.exportMainBtn.addEventListener('click', exportMainData);
    elements.exportPaperDetailsBtn.addEventListener('click', exportPaperDetailsData);
    
    // 编辑相关
    elements.editProjectBtn.addEventListener('click', editProjectInfo);
    elements.editIntroBtn.addEventListener('click', editProjectIntro);
    document.getElementById('saveEdit').addEventListener('click', saveEditContent);
    document.getElementById('cancelEdit').addEventListener('click', hideEditModal);
    
    // 确认对话框
    document.getElementById('confirmDelete').addEventListener('click', confirmDelete);
    document.getElementById('cancelDelete').addEventListener('click', hideConfirmModal);
    
    // 背景更换
    elements.changeBgBtn.addEventListener('click', changeBackground);
    elements.bgInput.addEventListener('change', handleBackgroundChange);
    
    // 板块切换事件委托
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('toggle-btn') && e.target.hasAttribute('data-section')) {
            const sectionId = e.target.getAttribute('data-section');
            toggleSection(e.target, sectionId);
        } else if (e.target.classList.contains('add-paper-btn')) {
            addPaper();
        } else if (e.target.classList.contains('add-award-btn')) {
            addAward();
        } else if (e.target.classList.contains('add-student-btn')) {
            addStudent();
        } else if (e.target.classList.contains('add-conference-btn')) {
            addConference();
        }
    });
    
    // ESC键关闭模态框
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            
            // 关闭所有打开的模态框
            if (elements.loginModal.classList.contains('show')) {
                hideLoginModal();
            }
            if (elements.editModal.classList.contains('show')) {
                hideEditModal();
            }
            if (elements.confirmModal.classList.contains('show')) {
                hideConfirmModal();
            }
        }
    });
});

// 导出函数到全局作用域，供HTML中的onclick使用
window.viewPaperDetails = viewPaperDetails;
window.toggleAbstract = toggleAbstract;
window.editPaper = editPaper;
window.deletePaper = deletePaper;
window.editAward = editAward;
window.deleteAward = deleteAward;
window.editStudent = editStudent;
window.deleteStudent = deleteStudent;
window.editConference = editConference;
window.deleteConference = deleteConference;
[file content end]