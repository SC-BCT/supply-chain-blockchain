// 全局变量
let isLoggedIn = false;
let currentEditData = null;
let currentPaperId = null;
let draggedElement = null;

// DOM元素
const elements = {
    loginBtn: document.getElementById('loginBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    loginModal: document.getElementById('loginModal'),
    loginForm: document.getElementById('loginForm'),
    editModal: document.getElementById('editModal'),
    imageModal: document.getElementById('imageModal'),
    modalImage: document.getElementById('modalImage'),
    homepageInput: document.getElementById('homepageInput'),
    keyInput: document.getElementById('keyInput')
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

// IndexedDB初始化
let db = null;
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

// 保存数据到IndexedDB
async function savePaperDetailsToIndexedDB(paperId, paperDetails) {
    if (!db) {
        try {
            await initIndexedDB();
        } catch (error) {
            console.error('IndexedDB初始化失败:', error);
            return false;
        }
    }
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['paperDetails'], 'readwrite');
        const objectStore = transaction.objectStore('paperDetails');
        
        const data = {
            paperId: paperId,
            backgroundContent: paperDetails.backgroundContent || '暂无研究背景信息',
            mainContent: paperDetails.mainContent || '暂无研究内容信息',
            conclusionContent: paperDetails.conclusionContent || '暂无研究结论信息',
            linkContent: paperDetails.linkContent || '暂无全文链接',
            homepageImages: paperDetails.homepageImages || [],
            keyImages: paperDetails.keyImages || []
        };
        
        const request = objectStore.put(data);
        
        request.onsuccess = function() {
            console.log(`论文${paperId}数据已保存到IndexedDB`);
            resolve(true);
        };
        
        request.onerror = function(event) {
            console.error('保存到IndexedDB失败:', event.target.error);
            reject(event.target.error);
        };
    });
}

// 从IndexedDB获取论文详情
async function getPaperDetailsFromIndexedDB(paperId) {
    if (!db) {
        try {
            await initIndexedDB();
        } catch (error) {
            console.log('IndexedDB初始化失败:', error);
            return null;
        }
    }
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['paperDetails'], 'readonly');
        const objectStore = transaction.objectStore('paperDetails');
        const request = objectStore.get(paperId);
        
        request.onsuccess = function(event) {
            resolve(event.target.result);
        };
        
        request.onerror = function(event) {
            console.error('从IndexedDB获取数据失败:', event.target.error);
            resolve(null);
        };
    });
}

// 页面初始化
async function initializePage() {
    // 检查登录状态
    isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
    
    // 获取URL参数中的论文ID
    const urlParams = new URLSearchParams(window.location.search);
    currentPaperId = parseInt(urlParams.get('id')) || 1;
    
    console.log(`初始化论文详情页，论文ID: ${currentPaperId}`);
    
    try {
        // 初始化IndexedDB
        await initIndexedDB();
        
        // 加载论文基本信息
        await loadPaperData();
        
        // 加载论文详情数据
        await loadPaperDetails();
        
        // 更新UI
        updateUI();
        
    } catch (error) {
        console.error('初始化失败:', error);
        showNotification('加载数据失败，请检查网络连接', 'error');
    }
    
    // 添加动画
    setTimeout(() => {
        anime({
            targets: '.fade-in',
            opacity: [0, 1],
            translateY: [30, 0],
            duration: 800,
            delay: anime.stagger(200),
            easing: 'easeOutQuad'
        });
    }, 100);
}

// 加载论文基本信息
async function loadPaperData() {
    try {
        // 首先尝试从data.json加载
        let paperData = null;
        
        try {
            const response = await fetch('data.json');
            if (response.ok) {
                const data = await response.json();
                console.log('从data.json加载的数据:', data);
                
                // 查找论文
                if (data.papers && Array.isArray(data.papers)) {
                    paperData = data.papers.find(p => p.id === currentPaperId);
                }
                
                if (!paperData && data.projectData) {
                    const projectData = typeof data.projectData === 'string' ? 
                        JSON.parse(data.projectData) : data.projectData;
                    if (projectData.papers && Array.isArray(projectData.papers)) {
                        paperData = projectData.papers.find(p => p.id === currentPaperId);
                    }
                }
            }
        } catch (error) {
            console.log('从data.json加载失败，使用localStorage:', error);
        }
        
        // 如果从data.json没找到，从localStorage找
        if (!paperData) {
            const projectData = DataManager.load('projectData', { papers: [] });
            paperData = projectData.papers.find(p => p.id === currentPaperId);
        }
        
        // 渲染论文基本信息
        if (paperData) {
            document.getElementById('paperTitle').textContent = paperData.title || '未命名论文';
            document.getElementById('paperJournal').textContent = paperData.journal || '';
            document.getElementById('paperTime').textContent = paperData.time || '';
            document.getElementById('paperAuthors').textContent = paperData.authors || '';
        } else {
            console.warn(`未找到论文ID为${currentPaperId}的论文数据`);
            document.getElementById('paperTitle').textContent = `论文 #${currentPaperId}`;
        }
        
    } catch (error) {
        console.error('加载论文数据失败:', error);
    }
}

// 加载论文详情数据
async function loadPaperDetails() {
    console.log(`开始加载论文${currentPaperId}的详情数据`);
    
    // 1. 首先尝试从IndexedDB加载
    let paperDetails = null;
    
    try {
        const indexedDBData = await getPaperDetailsFromIndexedDB(currentPaperId);
        if (indexedDBData) {
            console.log(`从IndexedDB获取到论文${currentPaperId}的详情数据`);
            paperDetails = {
                backgroundContent: indexedDBData.backgroundContent || '暂无研究背景信息',
                mainContent: indexedDBData.mainContent || '暂无研究内容信息',
                conclusionContent: indexedDBData.conclusionContent || '暂无研究结论信息',
                linkContent: indexedDBData.linkContent || '暂无全文链接',
                homepageImages: indexedDBData.homepageImages || [],
                keyImages: indexedDBData.keyImages || []
            };
        }
    } catch (error) {
        console.log('从IndexedDB加载失败:', error);
    }
    
    // 2. 如果IndexedDB没有，尝试从paperDetails.json加载
    if (!paperDetails) {
        try {
            const response = await fetch('paperDetails.json');
            if (response.ok) {
                const jsonData = await response.json();
                console.log('从paperDetails.json加载的数据:', jsonData);
                
                // 解析数据格式
                let paperDetailsData = jsonData;
                
                // 如果数据是字符串，尝试解析
                if (typeof jsonData === 'string') {
                    try {
                        paperDetailsData = JSON.parse(jsonData);
                    } catch (e) {
                        console.error('解析paperDetails.json失败:', e);
                    }
                }
                
                // 根据不同的数据结构查找论文详情
                if (paperDetailsData[currentPaperId]) {
                    // 格式1: { "1": {...}, "2": {...} }
                    paperDetails = paperDetailsData[currentPaperId];
                } else if (Array.isArray(paperDetailsData)) {
                    // 格式2: [{paperId: 1, ...}, {paperId: 2, ...}]
                    const item = paperDetailsData.find(item => 
                        item.paperId === currentPaperId || item.id === currentPaperId
                    );
                    if (item) {
                        paperDetails = item;
                    }
                }
                
                if (paperDetails) {
                    console.log(`从paperDetails.json找到论文${currentPaperId}的详情数据`);
                }
            }
        } catch (error) {
            console.log('从paperDetails.json加载失败:', error);
        }
    }
    
    // 3. 如果还是没有，尝试从localStorage加载
    if (!paperDetails) {
        const localPaperDetails = DataManager.load('paperDetails', {});
        if (localPaperDetails[currentPaperId]) {
            console.log(`从localStorage获取到论文${currentPaperId}的详情数据`);
            paperDetails = localPaperDetails[currentPaperId];
        }
    }
    
    // 4. 如果都没有，创建默认数据
    if (!paperDetails) {
        console.log(`为论文${currentPaperId}创建默认详情数据`);
        paperDetails = {
            backgroundContent: '暂无研究背景信息',
            mainContent: '暂无研究内容信息',
            conclusionContent: '暂无研究结论信息',
            linkContent: '暂无全文链接',
            homepageImages: [],
            keyImages: []
        };
        
        // 保存默认数据
        const localPaperDetails = DataManager.load('paperDetails', {});
        localPaperDetails[currentPaperId] = paperDetails;
        DataManager.save('paperDetails', localPaperDetails);
        
        // 保存到IndexedDB
        try {
            await savePaperDetailsToIndexedDB(currentPaperId, paperDetails);
        } catch (error) {
            console.error('保存默认数据到IndexedDB失败:', error);
        }
    }
    
    // 确保数据结构完整
    paperDetails = {
        backgroundContent: paperDetails.backgroundContent || '暂无研究背景信息',
        mainContent: paperDetails.mainContent || '暂无研究内容信息',
        conclusionContent: paperDetails.conclusionContent || '暂无研究结论信息',
        linkContent: paperDetails.linkContent || '暂无全文链接',
        homepageImages: Array.isArray(paperDetails.homepageImages) ? paperDetails.homepageImages : [],
        keyImages: Array.isArray(paperDetails.keyImages) ? paperDetails.keyImages : []
    };
    
    console.log(`最终使用的论文详情数据:`, paperDetails);
    
    // 渲染数据
    renderPaperDetails(paperDetails);
}

// 渲染论文详情
function renderPaperDetails(paperDetails) {
    // 渲染研究背景
    document.getElementById('backgroundContent').innerHTML = formatTextWithParagraphs(paperDetails.backgroundContent);
    
    // 渲染研究内容
    document.getElementById('mainContent').innerHTML = formatTextWithParagraphs(paperDetails.mainContent);
    
    // 渲染研究结论
    document.getElementById('conclusionContent').innerHTML = formatTextWithParagraphs(paperDetails.conclusionContent);
    
    // 渲染全文链接
    document.getElementById('linkContent').innerHTML = formatLinkContent(paperDetails.linkContent);
    
    // 渲染论文首页图片
    renderImages('homepageImages', paperDetails.homepageImages);
    
    // 渲染关键内容图片
    renderImages('keyImages', paperDetails.keyImages);
    
    // 重新绑定拖拽事件
    if (isLoggedIn) {
        setTimeout(() => {
            initDragAndDrop();
        }, 100);
    }
}

// 格式化文本
function formatTextWithParagraphs(text) {
    if (!text || text.trim() === '') {
        return '<p>暂无内容</p>';
    }
    
    const paragraphs = text.split('\n').filter(p => p.trim() !== '');
    
    if (paragraphs.length === 0) {
        return '<p>暂无内容</p>';
    }
    
    return paragraphs.map(paragraph => 
        `<p style="text-indent: 2em; margin-bottom: 1em; line-height: 1.8;">${paragraph.trim()}</p>`
    ).join('');
}

// 格式化链接
function formatLinkContent(content) {
    if (content && (content.startsWith('http://') || content.startsWith('https://'))) {
        return `<a href="${content}" target="_blank" class="text-blue-600 hover:text-blue-800 underline break-all">${content}</a>`;
    }
    return content || '暂无全文链接';
}

// 渲染图片
function renderImages(containerId, images) {
    const container = document.getElementById(containerId);
    
    if (!images || images.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-8">暂无图片</p>';
        return;
    }
    
    container.innerHTML = images.map((image, index) => `
        <div class="image-item bg-gray-100 rounded-lg overflow-hidden relative group" 
             data-id="${index}" 
             draggable="${isLoggedIn ? 'true' : 'false'}"
             data-image="${image}">
            <div class="relative" style="padding-bottom: 75%;">
                <img src="${image}" alt="论文图片" 
                     class="absolute w-full h-full object-contain cursor-pointer"
                     onclick="openImageModal('${image}')">
            </div>
            ${isLoggedIn ? `
            <div class="image-overlay absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button onclick="deleteImage('${containerId}', ${index})" 
                        class="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-lg">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
            ` : ''}
        </div>
    `).join('');
    
    // 初始化拖拽
    if (isLoggedIn) {
        initDragAndDropForContainer(container, containerId);
    }
}

// 初始化拖拽功能
function initDragAndDrop() {
    const homepageContainer = document.getElementById('homepageImages');
    const keyContainer = document.getElementById('keyImages');
    
    if (homepageContainer) {
        initDragAndDropForContainer(homepageContainer, 'homepageImages');
    }
    
    if (keyContainer) {
        initDragAndDropForContainer(keyContainer, 'keyImages');
    }
}

// 为容器初始化拖拽
function initDragAndDropForContainer(container, containerId) {
    if (!container) return;
    
    const items = container.querySelectorAll('.image-item');
    
    items.forEach(item => {
        // 移除旧的事件监听器
        item.removeEventListener('dragstart', handleDragStart);
        item.removeEventListener('dragover', handleDragOver);
        item.removeEventListener('drop', handleDrop);
        item.removeEventListener('dragend', handleDragEnd);
        
        // 添加新的事件监听器
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', (e) => handleDrop(e, containerId));
        item.addEventListener('dragend', handleDragEnd);
        
        // 设置可拖拽
        item.setAttribute('draggable', 'true');
    });
}

function handleDragStart(e) {
    draggedElement = this;
    this.style.opacity = '0.5';
}

function handleDragOver(e) {
    e.preventDefault();
}

function handleDrop(e, containerId) {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedElement || draggedElement === this) return false;
    
    const draggedIndex = parseInt(draggedElement.dataset.id);
    const targetIndex = parseInt(this.dataset.id);
    
    // 获取当前数据
    const paperDetails = DataManager.load('paperDetails', {});
    if (!paperDetails[currentPaperId]) {
        paperDetails[currentPaperId] = {
            backgroundContent: '暂无研究背景信息',
            mainContent: '暂无研究内容信息',
            conclusionContent: '暂无研究结论信息',
            linkContent: '暂无全文链接',
            homepageImages: [],
            keyImages: []
        };
    }
    
    const imageArray = containerId === 'homepageImages' 
        ? paperDetails[currentPaperId].homepageImages 
        : paperDetails[currentPaperId].keyImages;
    
    // 检查索引有效性
    if (draggedIndex >= 0 && draggedIndex < imageArray.length && 
        targetIndex >= 0 && targetIndex < imageArray.length) {
        
        // 交换位置
        const temp = imageArray[draggedIndex];
        imageArray[draggedIndex] = imageArray[targetIndex];
        imageArray[targetIndex] = temp;
        
        // 保存数据
        savePaperDetails(paperDetails);
        
        // 重新渲染
        renderImages(containerId, imageArray);
        
        showNotification('图片顺序已更新', 'success');
    }
    
    return false;
}

function handleDragEnd() {
    if (draggedElement) {
        draggedElement.style.opacity = '1';
        draggedElement = null;
    }
}

// 保存论文详情数据
async function savePaperDetails(paperDetails) {
    // 保存到localStorage
    DataManager.save('paperDetails', paperDetails);
    
    // 保存到IndexedDB
    try {
        await savePaperDetailsToIndexedDB(currentPaperId, paperDetails[currentPaperId]);
    } catch (error) {
        console.error('保存到IndexedDB失败:', error);
    }
}

// 打开图片模态框
function openImageModal(imageSrc) {
    elements.modalImage.src = imageSrc;
    elements.imageModal.classList.add('show');
}

// 关闭图片模态框
function closeImageModal() {
    elements.imageModal.classList.remove('show');
}

// 删除图片
function deleteImage(containerId, index) {
    showConfirmModal('确定要删除这张图片吗？', async () => {
        const paperDetails = DataManager.load('paperDetails', {});
        if (!paperDetails[currentPaperId]) {
            paperDetails[currentPaperId] = {
                backgroundContent: '暂无研究背景信息',
                mainContent: '暂无研究内容信息',
                conclusionContent: '暂无研究结论信息',
                linkContent: '暂无全文链接',
                homepageImages: [],
                keyImages: []
            };
        }
        
        // 删除图片
        if (containerId === 'homepageImages') {
            paperDetails[currentPaperId].homepageImages.splice(index, 1);
        } else {
            paperDetails[currentPaperId].keyImages.splice(index, 1);
        }
        
        // 保存数据
        await savePaperDetails(paperDetails);
        
        // 重新渲染
        renderImages(containerId, paperDetails[currentPaperId][containerId === 'homepageImages' ? 'homepageImages' : 'keyImages']);
        
        showNotification('图片已删除', 'success');
    });
}

// 处理图片上传
async function handleImageUpload(event, type) {
    const files = Array.from(event.target.files);
    
    if (files.length === 0) return;
    
    // 清空文件输入，以便可以再次选择相同文件
    event.target.value = '';
    
    // 获取当前数据
    const paperDetails = DataManager.load('paperDetails', {});
    if (!paperDetails[currentPaperId]) {
        paperDetails[currentPaperId] = {
            backgroundContent: '暂无研究背景信息',
            mainContent: '暂无研究内容信息',
            conclusionContent: '暂无研究结论信息',
            linkContent: '暂无全文链接',
            homepageImages: [],
            keyImages: []
        };
    }
    
    const targetArray = type === 'homepage' 
        ? paperDetails[currentPaperId].homepageImages 
        : paperDetails[currentPaperId].keyImages;
    
    // 处理所有图片文件
    const processFile = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                targetArray.push(e.target.result);
                resolve();
            };
            reader.readAsDataURL(file);
        });
    };
    
    // 按顺序处理所有文件
    for (const file of files) {
        await processFile(file);
    }
    
    // 保存数据
    await savePaperDetails(paperDetails);
    
    // 重新渲染
    renderImages(type === 'homepage' ? 'homepageImages' : 'keyImages', targetArray);
    
    // 更新UI
    updateUI();
    
    showNotification(`成功上传 ${files.length} 张图片`, 'success');
}

// 编辑研究背景
function editBackgroundContent() {
    const paperDetails = DataManager.load('paperDetails', {});
    const currentPaperDetails = paperDetails[currentPaperId] || { 
        backgroundContent: '暂无研究背景信息',
        mainContent: '暂无研究内容信息',
        conclusionContent: '暂无研究结论信息',
        linkContent: '暂无全文链接',
        homepageImages: [],
        keyImages: []
    };
    
    showEditModal('编辑研究背景', `
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">研究背景</label>
            <textarea id="backgroundContentText" rows="6" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">${currentPaperDetails.backgroundContent}</textarea>
        </div>
    `, async () => {
        const paperDetails = DataManager.load('paperDetails', {});
        if (!paperDetails[currentPaperId]) {
            paperDetails[currentPaperId] = {
                backgroundContent: '暂无研究背景信息',
                mainContent: '暂无研究内容信息',
                conclusionContent: '暂无研究结论信息',
                linkContent: '暂无全文链接',
                homepageImages: [],
                keyImages: []
            };
        }
        
        paperDetails[currentPaperId].backgroundContent = document.getElementById('backgroundContentText').value;
        
        await savePaperDetails(paperDetails);
        
        document.getElementById('backgroundContent').innerHTML = formatTextWithParagraphs(paperDetails[currentPaperId].backgroundContent);
        showNotification('研究背景已更新', 'success');
    });
}

// 编辑研究内容
function editMainContent() {
    const paperDetails = DataManager.load('paperDetails', {});
    const currentPaperDetails = paperDetails[currentPaperId] || { 
        backgroundContent: '暂无研究背景信息',
        mainContent: '暂无研究内容信息',
        conclusionContent: '暂无研究结论信息',
        linkContent: '暂无全文链接',
        homepageImages: [],
        keyImages: []
    };
    
    showEditModal('编辑研究内容', `
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">研究内容</label>
            <textarea id="mainContentText" rows="8" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">${currentPaperDetails.mainContent}</textarea>
        </div>
    `, async () => {
        const paperDetails = DataManager.load('paperDetails', {});
        if (!paperDetails[currentPaperId]) {
            paperDetails[currentPaperId] = {
                backgroundContent: '暂无研究背景信息',
                mainContent: '暂无研究内容信息',
                conclusionContent: '暂无研究结论信息',
                linkContent: '暂无全文链接',
                homepageImages: [],
                keyImages: []
            };
        }
        
        paperDetails[currentPaperId].mainContent = document.getElementById('mainContentText').value;
        
        await savePaperDetails(paperDetails);
        
        document.getElementById('mainContent').innerHTML = formatTextWithParagraphs(paperDetails[currentPaperId].mainContent);
        showNotification('研究内容已更新', 'success');
    });
}

// 编辑研究结论
function editConclusionContent() {
    const paperDetails = DataManager.load('paperDetails', {});
    const currentPaperDetails = paperDetails[currentPaperId] || { 
        backgroundContent: '暂无研究背景信息',
        mainContent: '暂无研究内容信息',
        conclusionContent: '暂无研究结论信息',
        linkContent: '暂无全文链接',
        homepageImages: [],
        keyImages: []
    };
    
    showEditModal('编辑研究结论', `
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">研究结论</label>
            <textarea id="conclusionContentText" rows="6" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">${currentPaperDetails.conclusionContent}</textarea>
        </div>
    `, async () => {
        const paperDetails = DataManager.load('paperDetails', {});
        if (!paperDetails[currentPaperId]) {
            paperDetails[currentPaperId] = {
                backgroundContent: '暂无研究背景信息',
                mainContent: '暂无研究内容信息',
                conclusionContent: '暂无研究结论信息',
                linkContent: '暂无全文链接',
                homepageImages: [],
                keyImages: []
            };
        }
        
        paperDetails[currentPaperId].conclusionContent = document.getElementById('conclusionContentText').value;
        
        await savePaperDetails(paperDetails);
        
        document.getElementById('conclusionContent').innerHTML = formatTextWithParagraphs(paperDetails[currentPaperId].conclusionContent);
        showNotification('研究结论已更新', 'success');
    });
}

// 编辑全文链接
function editLinkContent() {
    const paperDetails = DataManager.load('paperDetails', {});
    const currentPaperDetails = paperDetails[currentPaperId] || { 
        backgroundContent: '暂无研究背景信息',
        mainContent: '暂无研究内容信息',
        conclusionContent: '暂无研究结论信息',
        linkContent: '暂无全文链接',
        homepageImages: [],
        keyImages: []
    };
    
    showEditModal('编辑全文链接', `
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">全文链接</label>
            <input type="text" id="linkContentText" value="${currentPaperDetails.linkContent}" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="请输入完整的URL链接">
        </div>
    `, async () => {
        const paperDetails = DataManager.load('paperDetails', {});
        if (!paperDetails[currentPaperId]) {
            paperDetails[currentPaperId] = {
                backgroundContent: '暂无研究背景信息',
                mainContent: '暂无研究内容信息',
                conclusionContent: '暂无研究结论信息',
                linkContent: '暂无全文链接',
                homepageImages: [],
                keyImages: []
            };
        }
        
        const linkValue = document.getElementById('linkContentText').value;
        paperDetails[currentPaperId].linkContent = linkValue;
        
        await savePaperDetails(paperDetails);
        
        document.getElementById('linkContent').innerHTML = formatLinkContent(linkValue);
        showNotification('全文链接已更新', 'success');
    });
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
    
    if (username === '123' && password === '123') {
        isLoggedIn = true;
        sessionStorage.setItem('isLoggedIn', 'true');
        hideLoginModal();
        updateUI();
        showNotification('登录成功！', 'success');
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
}

// 更新UI
function updateUI() {
    console.log('更新UI，登录状态:', isLoggedIn);
    
    const editBtns = document.querySelectorAll('.edit-btn');
    const addHomepageBtn = document.getElementById('addHomepageBtn');
    const addKeyBtn = document.getElementById('addKeyBtn');
    const homepageUpload = document.getElementById('homepageUpload');
    const keyUpload = document.getElementById('keyUpload');
    
    if (isLoggedIn) {
        elements.loginBtn.classList.add('hidden');
        elements.logoutBtn.classList.remove('hidden');
        editBtns.forEach(btn => btn.classList.remove('hidden'));
        
        // 显示添加图片按钮和上传区域
        if (addHomepageBtn) addHomepageBtn.classList.remove('hidden');
        if (addKeyBtn) addKeyBtn.classList.remove('hidden');
        if (homepageUpload) homepageUpload.classList.remove('hidden');
        if (keyUpload) keyUpload.classList.remove('hidden');
        
        // 重新初始化拖拽
        setTimeout(() => {
            initDragAndDrop();
        }, 100);
        
    } else {
        elements.loginBtn.classList.remove('hidden');
        elements.logoutBtn.classList.add('hidden');
        editBtns.forEach(btn => btn.classList.add('hidden'));
        
        // 隐藏添加图片按钮和上传区域
        if (addHomepageBtn) addHomepageBtn.classList.add('hidden');
        if (addKeyBtn) addKeyBtn.classList.add('hidden');
        if (homepageUpload) homepageUpload.classList.add('hidden');
        if (keyUpload) keyUpload.classList.add('hidden');
        
        // 禁用拖拽
        const imageItems = document.querySelectorAll('.image-item');
        imageItems.forEach(item => item.setAttribute('draggable', 'false'));
    }
}

// 通知系统
function showNotification(message, type = 'info') {
    // 移除现有的通知
    const existingNotifications = document.querySelectorAll('.custom-notification');
    existingNotifications.forEach(notification => notification.remove());
    
    const notification = document.createElement('div');
    notification.className = `custom-notification fixed top-20 right-4 z-50 p-4 rounded-lg shadow-lg text-white max-w-sm ${
        type === 'success' ? 'bg-green-500' : 
        type === 'error' ? 'bg-red-500' : 
        type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
    }`;
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
    const confirmModal = document.getElementById('confirmModal');
    if (!confirmModal) {
        // 创建确认对话框
        const modal = document.createElement('div');
        modal.id = 'confirmModal';
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="glass-effect rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
                <h3 class="title-font text-xl font-bold text-gray-800 mb-4">确认删除</h3>
                <p class="text-gray-600 mb-6">${message}</p>
                <div class="flex space-x-4">
                    <button id="confirmDeleteBtn" class="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg font-medium">
                        确认删除
                    </button>
                    <button id="cancelDeleteBtn" class="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 rounded-lg font-medium">
                        取消
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 绑定事件
        modal.querySelector('#confirmDeleteBtn').addEventListener('click', () => {
            callback();
            modal.remove();
        });
        
        modal.querySelector('#cancelDeleteBtn').addEventListener('click', () => {
            modal.remove();
        });
        
        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    } else {
        // 使用现有的确认对话框
        confirmModal.querySelector('p').textContent = message;
        confirmModal.classList.add('show');
        
        // 更新事件监听器
        const confirmBtn = confirmModal.querySelector('#confirmDeleteBtn');
        const cancelBtn = confirmModal.querySelector('#cancelDeleteBtn');
        
        // 移除旧的事件监听器
        const newConfirmBtn = confirmBtn.cloneNode(true);
        const newCancelBtn = cancelBtn.cloneNode(true);
        
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        
        // 添加新的事件监听器
        newConfirmBtn.addEventListener('click', () => {
            callback();
            confirmModal.classList.remove('show');
        });
        
        newCancelBtn.addEventListener('click', () => {
            confirmModal.classList.remove('show');
        });
    }
}

// 触发图片上传
function triggerImageUpload(type) {
    if (type === 'homepage') {
        elements.homepageInput.click();
    } else if (type === 'key') {
        elements.keyInput.click();
    }
}

// 页面初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM加载完成，开始初始化论文详情页...');
    
    // 启动页面
    initializePage();
    
    // 登录相关
    elements.loginBtn.addEventListener('click', showLoginModal);
    elements.logoutBtn.addEventListener('click', logout);
    elements.loginForm.addEventListener('submit', handleLogin);
    document.getElementById('cancelLogin')?.addEventListener('click', hideLoginModal);
    
    // 编辑相关
    document.getElementById('editBackgroundBtn')?.addEventListener('click', editBackgroundContent);
    document.getElementById('editMainContentBtn')?.addEventListener('click', editMainContent);
    document.getElementById('editConclusionBtn')?.addEventListener('click', editConclusionContent);
    document.getElementById('editLinkBtn')?.addEventListener('click', editLinkContent);
    
    document.getElementById('saveEdit')?.addEventListener('click', saveEditContent);
    document.getElementById('cancelEdit')?.addEventListener('click', hideEditModal);
    
    // 图片上传
    elements.homepageInput?.addEventListener('change', (e) => handleImageUpload(e, 'homepage'));
    elements.keyInput?.addEventListener('change', (e) => handleImageUpload(e, 'key'));
    
    // 添加图片按钮事件
    document.getElementById('addHomepageBtn')?.addEventListener('click', () => triggerImageUpload('homepage'));
    document.getElementById('addKeyBtn')?.addEventListener('click', () => triggerImageUpload('key'));
    
    // ESC键关闭模态框
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            
            // 关闭所有打开的模态框
            const modals = document.querySelectorAll('.modal.show, .image-modal.show');
            modals.forEach(modal => modal.classList.remove('show'));
        }
    });
    
    // 点击背景关闭模态框
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('show');
        }
    });
});

// 导出函数到全局作用域
window.openImageModal = openImageModal;
window.closeImageModal = closeImageModal;
window.deleteImage = deleteImage;
window.triggerImageUpload = triggerImageUpload;
