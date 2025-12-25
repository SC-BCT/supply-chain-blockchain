// paper-detail.js - 完整修复版
// 全局变量
let isLoggedIn = false;
let currentEditData = null;
let currentPaperId = null;
let draggedElement = null;
let currentScale = 1;

// DOM元素引用
let elements = {};

// 初始化DOM元素引用
function initElements() {
    elements = {
        loginBtn: document.getElementById('loginBtn'),
        logoutBtn: document.getElementById('logoutBtn'),
        loginModal: document.getElementById('loginModal'),
        loginForm: document.getElementById('loginForm'),
        editModal: document.getElementById('editModal'),
        imageModal: document.getElementById('imageModal'),
        modalImage: document.getElementById('modalImage'),
        homepageInput: document.getElementById('homepageInput'),
        keyInput: document.getElementById('keyInput'),
        imageLoading: document.getElementById('imageLoading'),
        zoomInBtn: document.getElementById('zoomInBtn'),
        zoomOutBtn: document.getElementById('zoomOutBtn'),
        resetZoomBtn: document.getElementById('resetZoomBtn')
    };
}

// 数据管理类
class DataManager {
    static save(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            console.log(`数据保存到localStorage: ${key}`);
        } catch (error) {
            console.error(`保存到localStorage失败: ${error}`);
        }
    }
    
    static load(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (error) {
            console.error(`从localStorage加载失败: ${error}`);
            return defaultValue;
        }
    }
}

// IndexedDB管理类
class IndexedDBManager {
    static db = null;
    static dbName = 'paperDetailsDB';
    static version = 1;
    static storeName = 'paperDetails';

    // 初始化数据库
    static async init() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                resolve(this.db);
                return;
            }

            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = (event) => {
                console.error('IndexedDB打开失败:', event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('IndexedDB初始化成功');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const objectStore = db.createObjectStore(this.storeName, { keyPath: 'paperId' });
                    objectStore.createIndex('paperId', 'paperId', { unique: true });
                    console.log('IndexedDB对象存储创建成功');
                }
            };
        });
    }

    // 保存论文详情
    static async savePaperDetails(paperId, data) {
        try {
            await this.init();
            
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const objectStore = transaction.objectStore(this.storeName);
                
                const completeData = {
                    paperId: paperId,
                    backgroundContent: data.backgroundContent || '请添加研究背景信息',
                    mainContent: data.mainContent || '请添加研究内容信息',
                    conclusionContent: data.conclusionContent || '请添加研究结论信息',
                    linkContent: data.linkContent || '暂无全文链接',
                    homepageImages: data.homepageImages || [],
                    keyImages: data.keyImages || []
                };
                
                const request = objectStore.put(completeData);
                
                request.onsuccess = () => {
                    console.log(`论文${paperId}详情保存到IndexedDB成功`);
                    resolve(true);
                };
                
                request.onerror = (event) => {
                    console.error('保存到IndexedDB失败:', event.target.error);
                    reject(event.target.error);
                };
            });
        } catch (error) {
            console.error('IndexedDB操作失败:', error);
            return false;
        }
    }

    // 获取论文详情
    static async getPaperDetails(paperId) {
        try {
            await this.init();
            
            return new Promise((resolve) => {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const objectStore = transaction.objectStore(this.storeName);
                const request = objectStore.get(paperId);
                
                request.onsuccess = (event) => {
                    resolve(event.target.result);
                };
                
                request.onerror = (event) => {
                    console.error('从IndexedDB获取数据失败:', event.target.error);
                    resolve(null);
                };
            });
        } catch (error) {
            console.error('IndexedDB操作失败:', error);
            return null;
        }
    }
}

// 页面初始化
async function initializePage() {
    console.log('开始初始化论文详情页');
    
    // 初始化DOM元素引用
    initElements();
    
    // 检查登录状态
    isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
    console.log('登录状态:', isLoggedIn);
    
    // 获取URL参数中的论文ID
    const urlParams = new URLSearchParams(window.location.search);
    currentPaperId = parseInt(urlParams.get('id')) || 1;
    console.log('当前论文ID:', currentPaperId);
    
    try {
        // 加载论文基本信息
        await loadPaperBasicInfo();
        
        // 加载论文详情数据
        await loadPaperDetails();
        
        // 更新UI
        updateUI();
        
        // 初始化拖拽功能
        if (isLoggedIn) {
            setTimeout(initDragAndDrop, 500);
        }
        
    } catch (error) {
        console.error('初始化失败:', error);
        showNotification('页面初始化失败，请刷新重试', 'error');
    }
    
    // 添加动画效果
    setTimeout(() => {
        const fadeElements = document.querySelectorAll('.fade-in');
        if (fadeElements.length > 0) {
            anime({
                targets: '.fade-in',
                opacity: [0, 1],
                translateY: [30, 0],
                duration: 800,
                delay: anime.stagger(200),
                easing: 'easeOutQuad'
            });
        }
    }, 100);
}

// 加载论文基本信息
async function loadPaperBasicInfo() {
    console.log('开始加载论文基本信息');
    
    try {
        // 先尝试从localStorage加载
        const projectData = DataManager.load('projectData');
        
        if (projectData && projectData.papers) {
            const paper = projectData.papers.find(p => p.id === currentPaperId);
            if (paper) {
                console.log('从localStorage找到论文基本信息:', paper);
                renderPaperBasicInfo(paper);
                return;
            }
        }
        
        // 如果没有，尝试从data.json加载
        try {
            const response = await fetch('data.json');
            if (response.ok) {
                const jsonData = await response.json();
                console.log('从data.json加载的数据:', jsonData);
                
                let papers = [];
                if (jsonData.papers) {
                    papers = jsonData.papers;
                } else if (jsonData.projectData) {
                    papers = jsonData.projectData.papers || [];
                }
                
                const paper = papers.find(p => p.id === currentPaperId);
                if (paper) {
                    console.log('从data.json找到论文基本信息:', paper);
                    renderPaperBasicInfo(paper);
                    
                    // 保存到localStorage
                    if (projectData) {
                        projectData.papers = papers;
                        DataManager.save('projectData', projectData);
                    }
                    return;
                }
            }
        } catch (fetchError) {
            console.log('从data.json加载失败:', fetchError);
        }
        
        // 如果都没找到，显示默认信息
        console.warn('未找到论文基本信息');
        renderPaperBasicInfo({
            title: `论文 #${currentPaperId}`,
            journal: '',
            time: '',
            authors: ''
        });
        
    } catch (error) {
        console.error('加载论文基本信息失败:', error);
        renderPaperBasicInfo({
            title: `论文 #${currentPaperId}`,
            journal: '',
            time: '',
            authors: ''
        });
    }
}

// 渲染论文基本信息
function renderPaperBasicInfo(paper) {
    const titleElement = document.getElementById('paperTitle');
    const journalElement = document.getElementById('paperJournal');
    const timeElement = document.getElementById('paperTime');
    const authorsElement = document.getElementById('paperAuthors');
    
    if (titleElement) titleElement.textContent = paper.title || `论文 #${currentPaperId}`;
    if (journalElement) journalElement.textContent = paper.journal || '';
    if (timeElement) timeElement.textContent = paper.time || '';
    if (authorsElement) authorsElement.textContent = paper.authors || '';
}

// 加载论文详情数据 - 修复版
async function loadPaperDetails() {
    console.log(`开始加载论文${currentPaperId}的详情数据`);
    
    let paperDetails = null;
    
    // 尝试顺序：1. IndexedDB, 2. localStorage, 3. paperDetails.json
    try {
        // 1. 从IndexedDB加载
        const indexedDBData = await IndexedDBManager.getPaperDetails(currentPaperId);
        if (indexedDBData) {
            console.log(`从IndexedDB获取到论文${currentPaperId}的详情`, indexedDBData);
            paperDetails = indexedDBData;
        }
    } catch (error) {
        console.log('从IndexedDB加载失败:', error);
    }
    
    // 2. 从localStorage加载
    if (!paperDetails) {
        const localPaperDetails = DataManager.load('paperDetails', {});
        // 尝试用数字ID和字符串ID两种方式查找
        if (localPaperDetails[currentPaperId] || localPaperDetails[String(currentPaperId)]) {
            paperDetails = localPaperDetails[currentPaperId] || localPaperDetails[String(currentPaperId)];
            console.log(`从localStorage获取到论文${currentPaperId}的详情`, paperDetails);
        }
    }

    // 3. 从paperDetails.json加载 - 简化版修复
if (!paperDetails) {
    try {
        console.log('尝试从paperDetails.json加载数据...');
        
        // 添加重试机制和超时设置
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时
        
        const response = await fetch('paperDetails.json', {
            signal: controller.signal,
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            console.error(`HTTP ${response.status}: ${response.statusText}`);
            
            // 尝试检查文件是否存在
            try {
                const headResponse = await fetch('paperDetails.json', { method: 'HEAD' });
                console.log('HEAD请求结果:', headResponse.status, headResponse.statusText);
            } catch (headError) {
                console.error('文件HEAD请求失败:', headError);
            }
            
            throw new Error(`无法加载paperDetails.json文件`);
        }
        
        // 直接读取文本而不是JSON，避免大文件解析问题
        const text = await response.text();
        console.log('文件大小:', text.length, '字符');
        
        // 检查文件内容
        if (!text || text.trim().length === 0) {
            console.error('paperDetails.json文件内容为空');
            throw new Error('JSON文件为空');
        }
        
        // 尝试解析JSON
        let jsonData;
        try {
            jsonData = JSON.parse(text);
            console.log('JSON解析成功，数据类型:', typeof jsonData);
        } catch (parseError) {
            console.error('JSON解析失败:', parseError.message);
            console.error('文件前1000字符:', text.substring(0, 1000));
            throw new Error('JSON文件格式错误');
        }
        
        // 检查数据格式
        if (jsonData && typeof jsonData === 'object') {
            // 格式1: { "1": {...}, "2": {...} } 或 { 1: {...}, 2: {...} }
            if (jsonData[currentPaperId] || jsonData[String(currentPaperId)]) {
                paperDetails = jsonData[currentPaperId] || jsonData[String(currentPaperId)];
                console.log(`从对象格式找到论文${currentPaperId}的详情`);
            }
            // 格式2: [{paperId: 1, ...}, {paperId: 2, ...}]
            else if (Array.isArray(jsonData)) {
                console.log('数据是数组格式，搜索论文ID:', currentPaperId);
                const item = jsonData.find(item => {
                    const id = item.paperId || item.id;
                    return id && (parseInt(id) === currentPaperId || String(id) === String(currentPaperId));
                });
                
                if (item) {
                    paperDetails = item;
                    console.log(`从数组格式找到论文${currentPaperId}的详情`);
                }
            } else {
                console.log('paperDetails.json格式不支持，keys:', Object.keys(jsonData).slice(0, 5), '...');
            }
        }
        
        if (paperDetails) {
            console.log(`从paperDetails.json成功找到论文${currentPaperId}的详情`);
            
            // 保存到localStorage和IndexedDB
            const localPaperDetails = DataManager.load('paperDetails', {});
            localPaperDetails[currentPaperId] = paperDetails;
            DataManager.save('paperDetails', localPaperDetails);
            
            await IndexedDBManager.savePaperDetails(currentPaperId, paperDetails);
        } else {
            console.warn(`在paperDetails.json中未找到论文${currentPaperId}的详情，使用默认数据`);
        }
    } catch (error) {
        console.error('从paperDetails.json加载失败:', error.message || error);
        
        // 检查是否是Git LFS指针文件
        try {
            // 尝试读取少量数据检查是否是LFS指针文件
            const smallResponse = await fetch('paperDetails.json', {
                headers: { 'Range': 'bytes=0-1000' }
            });
            
            if (smallResponse.ok) {
                const smallText = await smallResponse.text();
                if (smallText.includes('version https://git-lfs.github.com') || 
                    smallText.includes('oid sha256:')) {
                    console.error('检测到paperDetails.json是Git LFS指针文件，不是实际数据文件');
                    showNotification('paperDetails.json是Git LFS指针文件，请上传实际JSON文件', 'error');
                }
            }
        } catch (lfsError) {
            console.error('检查LFS指针失败:', lfsError);
        }
    }
}
    // 确保数据结构完整
const completePaperDetails = {
    backgroundContent: paperDetails?.backgroundContent || '请添加研究背景信息',
    mainContent: paperDetails?.mainContent || '请添加研究内容信息',
    conclusionContent: paperDetails?.conclusionContent || '请添加研究结论信息',
    linkContent: paperDetails?.linkContent || '暂无全文链接',
    homepageImages: paperDetails?.homepageImages || [],
    keyImages: paperDetails?.keyImages || []
};

console.log(`最终渲染的论文详情:`, completePaperDetails);
renderPaperDetails(completePaperDetails);

// 如果没有加载到任何内容，显示提示
if (!paperDetails || !paperDetails.backgroundContent || !paperDetails.mainContent) {
    showNotification('无法加载论文详情数据，请检查paperDetails.json文件', 'warning');
}

    // 备选方案：尝试分块加载或使用Web Worker
async function tryAlternativeLoading() {
    console.log('使用备选方案加载数据...');
    
    try {
        // 尝试使用XMLHttpRequest，它有更好的进度控制和超时处理
        const xhr = new XMLHttpRequest();
        
        return new Promise((resolve, reject) => {
            xhr.timeout = 30000; // 30秒超时
            xhr.responseType = 'json';
            
            xhr.onload = function() {
                if (xhr.status === 200) {
                    console.log('通过XMLHttpRequest成功加载JSON数据');
                    // 这里需要根据你的数据格式处理
                    // 这部分逻辑与上面类似，可以封装为一个函数
                } else {
                    reject(new Error(`HTTP ${xhr.status}`));
                }
            };
            
            xhr.onerror = function() {
                reject(new Error('网络错误'));
            };
            
            xhr.ontimeout = function() {
                reject(new Error('请求超时'));
            };
            
            xhr.onprogress = function(event) {
                if (event.lengthComputable) {
                    const percentComplete = (event.loaded / event.total) * 100;
                    console.log(`加载进度: ${percentComplete.toFixed(2)}%`);
                }
            };
            
            xhr.open('GET', 'paperDetails.json');
            xhr.send();
        });
    } catch (error) {
        console.error('备选方案也失败了:', error);
        return null;
    }
}
    
    // 4. 创建默认数据
    if (!paperDetails) {
        console.log(`为论文${currentPaperId}创建默认详情数据`);
        paperDetails = {
            backgroundContent: '请添加研究背景信息',
            mainContent: '请添加研究内容信息',
            conclusionContent: '请添加研究结论信息',
            linkContent: '暂无全文链接',
            homepageImages: [],
            keyImages: []
        };
        
        // 保存默认数据
        const localPaperDetails = DataManager.load('paperDetails', {});
        localPaperDetails[currentPaperId] = paperDetails;
        DataManager.save('paperDetails', localPaperDetails);
        
        await IndexedDBManager.savePaperDetails(currentPaperId, paperDetails);
    }
    
    // 确保数据结构完整
    const completePaperDetails = {
        backgroundContent: paperDetails.backgroundContent || '请添加研究背景信息',
        mainContent: paperDetails.mainContent || '请添加研究内容信息',
        conclusionContent: paperDetails.conclusionContent || '请添加研究结论信息',
        linkContent: paperDetails.linkContent || '暂无全文链接',
        homepageImages: paperDetails.homepageImages || [],
        keyImages: paperDetails.keyImages || []
    };
    
    console.log(`最终渲染的论文详情:`, completePaperDetails);
    renderPaperDetails(completePaperDetails);
}

// 渲染论文详情
function renderPaperDetails(paperDetails) {
    console.log('渲染论文详情:', paperDetails);
    
    // 渲染文字内容
    const backgroundElement = document.getElementById('backgroundContent');
    const mainElement = document.getElementById('mainContent');
    const conclusionElement = document.getElementById('conclusionContent');
    const linkElement = document.getElementById('linkContent');
    
    if (backgroundElement) {
        backgroundElement.innerHTML = formatTextWithParagraphs(paperDetails.backgroundContent);
    }
    if (mainElement) {
        mainElement.innerHTML = formatTextWithParagraphs(paperDetails.mainContent);
    }
    if (conclusionElement) {
        conclusionElement.innerHTML = formatTextWithParagraphs(paperDetails.conclusionContent);
    }
    if (linkElement) {
        linkElement.innerHTML = formatLinkContent(paperDetails.linkContent);
    }
    
    // 渲染图片
    renderImages('homepageImages', paperDetails.homepageImages);
    renderImages('keyImages', paperDetails.keyImages);
}

// 格式化文本为段落
function formatTextWithParagraphs(text) {
    if (!text || text.trim() === '' || text === '请添加研究背景信息' || text === '请添加研究内容信息' || text === '请添加研究结论信息') {
        return '<p class="text-gray-500 italic">暂无内容</p>';
    }
    
    const paragraphs = text.split('\n').filter(p => p.trim() !== '');
    
    if (paragraphs.length === 0) {
        return '<p class="text-gray-500 italic">暂无内容</p>';
    }
    
    return paragraphs.map(paragraph => 
        `<p class="paragraph-content">${paragraph.trim()}</p>`
    ).join('');
}

// 格式化链接
function formatLinkContent(content) {
    if (!content || content.trim() === '' || content === '请添加全文链接' || content === '暂无全文链接') {
        return '暂无全文链接';
    }
    
    content = content.trim();
    
    // 检查是否为URL
    const isUrl = content.startsWith('http://') || content.startsWith('https://') || 
                  content.startsWith('www.');
    
    if (isUrl) {
        let url = content;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        
        return `<a href="${url}" target="_blank" class="text-blue-600 hover:text-blue-800 underline break-all">${content}</a>`;
    }
    
    return content;
}

// 渲染图片
function renderImages(containerId, images) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`找不到容器: ${containerId}`);
        return;
    }
    
    if (!images || images.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-8">暂无图片</p>';
        return;
    }
    
    console.log(`渲染图片到 ${containerId}:`, images);
    
    container.innerHTML = images.map((image, index) => {
        let imageUrl = image;
        
        return `
        <div class="image-item bg-gray-100 rounded-lg overflow-hidden relative group mb-4" 
             data-id="${index}" 
             draggable="${isLoggedIn ? 'true' : 'false'}"
             data-image="${imageUrl}">
            <img src="${imageUrl}" alt="论文图片" 
                 class="w-full h-auto cursor-pointer"
                 onclick="openImageModal('${imageUrl.replace(/'/g, "\\'")}')">
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
    `}).join('');
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
        // 添加事件监听器
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', (e) => handleDrop(e, containerId));
        item.addEventListener('dragend', handleDragEnd);
    });
}

function handleDragStart(e) {
    draggedElement = this;
    this.style.opacity = '0.5';
    e.dataTransfer.setData('text/plain', this.dataset.id);
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

async function handleDrop(e, containerId) {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedElement || draggedElement === this) return false;
    
    const draggedIndex = parseInt(draggedElement.dataset.id);
    const targetIndex = parseInt(this.dataset.id);
    
    // 获取当前数据
    const paperDetails = await getCurrentPaperDetails();
    
    const imageArray = containerId === 'homepageImages' 
        ? paperDetails.homepageImages 
        : paperDetails.keyImages;
    
    // 检查索引有效性
    if (draggedIndex >= 0 && draggedIndex < imageArray.length && 
        targetIndex >= 0 && targetIndex < imageArray.length) {
        
        // 交换位置
        const temp = imageArray[draggedIndex];
        imageArray[draggedIndex] = imageArray[targetIndex];
        imageArray[targetIndex] = temp;
        
        // 保存数据
        await savePaperDetails(paperDetails);
        
        // 重新渲染
        renderImages(containerId, imageArray);
        
        // 重新初始化拖拽
        setTimeout(() => {
            initDragAndDropForContainer(document.getElementById(containerId), containerId);
        }, 100);
        
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

// 获取当前论文详情数据
async function getCurrentPaperDetails() {
    // 先尝试从IndexedDB获取
    let paperDetails = await IndexedDBManager.getPaperDetails(currentPaperId);
    
    if (!paperDetails) {
        // 从localStorage获取
        const localPaperDetails = DataManager.load('paperDetails', {});
        paperDetails = localPaperDetails[currentPaperId] || {
            backgroundContent: '请添加研究背景信息',
            mainContent: '请添加研究内容信息',
            conclusionContent: '请添加研究结论信息',
            linkContent: '暂无全文链接',
            homepageImages: [],
            keyImages: []
        };
    }
    
    // 确保数据结构完整
    return {
        backgroundContent: paperDetails.backgroundContent || '请添加研究背景信息',
        mainContent: paperDetails.mainContent || '请添加研究内容信息',
        conclusionContent: paperDetails.conclusionContent || '请添加研究结论信息',
        linkContent: paperDetails.linkContent || '暂无全文链接',
        homepageImages: paperDetails.homepageImages || [],
        keyImages: paperDetails.keyImages || []
    };
}

// 保存论文详情数据
async function savePaperDetails(paperDetails) {
    // 保存到localStorage
    const localPaperDetails = DataManager.load('paperDetails', {});
    localPaperDetails[currentPaperId] = paperDetails;
    DataManager.save('paperDetails', localPaperDetails);
    
    // 保存到IndexedDB
    await IndexedDBManager.savePaperDetails(currentPaperId, paperDetails);
}

// 打开图片模态框
function openImageModal(imageSrc) {
    if (elements.imageModal && elements.modalImage) {
        // 重置缩放比例
        currentScale = 1;
        elements.modalImage.style.transform = 'scale(1)';
        
        // 设置图片源
        elements.modalImage.src = imageSrc;
        
        // 显示模态框
        elements.imageModal.classList.add('show');
        
        // 显示缩放按钮
        if (elements.zoomInBtn) elements.zoomInBtn.classList.remove('hidden');
        if (elements.zoomOutBtn) elements.zoomOutBtn.classList.remove('hidden');
        if (elements.resetZoomBtn) elements.resetZoomBtn.classList.remove('hidden');
        
        // 确保图片有初始缩放
        setTimeout(() => {
            if (elements.modalImage) {
                elements.modalImage.style.transform = `scale(${currentScale})`;
            }
        }, 50);
    }
}

// 关闭图片模态框
function closeImageModal() {
    if (elements.imageModal) {
        elements.imageModal.classList.remove('show');
        
        // 隐藏缩放按钮
        if (elements.zoomInBtn) elements.zoomInBtn.classList.add('hidden');
        if (elements.zoomOutBtn) elements.zoomOutBtn.classList.add('hidden');
        if (elements.resetZoomBtn) elements.resetZoomBtn.classList.add('hidden');
    }
}

// 图片缩放功能
function zoomIn() {
    if (!elements.modalImage) return;
    
    currentScale += 0.25;
    if (currentScale > 3) currentScale = 3;
    elements.modalImage.style.transform = `scale(${currentScale})`;
}

function zoomOut() {
    if (!elements.modalImage) return;
    
    currentScale -= 0.25;
    if (currentScale < 0.5) currentScale = 0.5;
    elements.modalImage.style.transform = `scale(${currentScale})`;
}

function resetZoom() {
    if (!elements.modalImage) return;
    
    currentScale = 1;
    elements.modalImage.style.transform = 'scale(1)';
}

// 删除图片
async function deleteImage(containerId, index) {
    showConfirmModal('确定要删除这张图片吗？', async () => {
        const paperDetails = await getCurrentPaperDetails();
        
        // 删除图片
        if (containerId === 'homepageImages') {
            paperDetails.homepageImages.splice(index, 1);
        } else {
            paperDetails.keyImages.splice(index, 1);
        }
        
        // 保存数据
        await savePaperDetails(paperDetails);
        
        // 重新渲染
        renderImages(containerId, paperDetails[containerId === 'homepageImages' ? 'homepageImages' : 'keyImages']);
        
        showNotification('图片已删除', 'success');
    });
}

// 处理图片上传
async function handleImageUpload(event, type) {
    const files = Array.from(event.target.files);
    
    if (files.length === 0) return;
    
    // 清空文件输入
    event.target.value = '';
    
    // 显示上传提示
    showNotification(`正在上传${files.length}张图片...`, 'info');
    
    try {
        // 获取当前数据
        const paperDetails = await getCurrentPaperDetails();
        
        const targetArray = type === 'homepage' 
            ? paperDetails.homepageImages 
            : paperDetails.keyImages;
        
        // 处理所有图片文件
        for (const file of files) {
            const reader = new FileReader();
            reader.onload = function(e) {
                targetArray.push(e.target.result);
            };
            reader.readAsDataURL(file);
        }
        
        // 等待图片加载
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 保存数据
        await savePaperDetails(paperDetails);
        
        // 重新渲染
        renderImages(type === 'homepage' ? 'homepageImages' : 'keyImages', targetArray);
        
        showNotification(`成功上传 ${files.length} 张图片`, 'success');
        
    } catch (error) {
        console.error('图片上传失败:', error);
        showNotification('图片上传失败，请重试', 'error');
    }
}

// 编辑研究背景
async function editBackgroundContent() {
    const paperDetails = await getCurrentPaperDetails();
    
    showEditModal('编辑研究背景', `
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">研究背景</label>
            <textarea id="backgroundContentText" rows="6" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">${paperDetails.backgroundContent}</textarea>
        </div>
    `, async () => {
        const paperDetails = await getCurrentPaperDetails();
        paperDetails.backgroundContent = document.getElementById('backgroundContentText').value;
        
        await savePaperDetails(paperDetails);
        
        document.getElementById('backgroundContent').innerHTML = formatTextWithParagraphs(paperDetails.backgroundContent);
        showNotification('研究背景已更新', 'success');
    });
}

// 编辑研究内容
async function editMainContent() {
    const paperDetails = await getCurrentPaperDetails();
    
    showEditModal('编辑研究内容', `
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">研究内容</label>
            <textarea id="mainContentText" rows="8" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">${paperDetails.mainContent}</textarea>
        </div>
    `, async () => {
        const paperDetails = await getCurrentPaperDetails();
        paperDetails.mainContent = document.getElementById('mainContentText').value;
        
        await savePaperDetails(paperDetails);
        
        document.getElementById('mainContent').innerHTML = formatTextWithParagraphs(paperDetails.mainContent);
        showNotification('研究内容已更新', 'success');
    });
}

// 编辑研究结论
async function editConclusionContent() {
    const paperDetails = await getCurrentPaperDetails();
    
    showEditModal('编辑研究结论', `
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">研究结论</label>
            <textarea id="conclusionContentText" rows="6" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">${paperDetails.conclusionContent}</textarea>
        </div>
    `, async () => {
        const paperDetails = await getCurrentPaperDetails();
        paperDetails.conclusionContent = document.getElementById('conclusionContentText').value;
        
        await savePaperDetails(paperDetails);
        
        document.getElementById('conclusionContent').innerHTML = formatTextWithParagraphs(paperDetails.conclusionContent);
        showNotification('研究结论已更新', 'success');
    });
}

// 编辑全文链接
async function editLinkContent() {
    const paperDetails = await getCurrentPaperDetails();
    
    showEditModal('编辑全文链接', `
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">全文链接</label>
            <input type="text" id="linkContentText" value="${paperDetails.linkContent}" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="请输入完整的URL链接">
        </div>
    `, async () => {
        const paperDetails = await getCurrentPaperDetails();
        paperDetails.linkContent = document.getElementById('linkContentText').value;
        
        await savePaperDetails(paperDetails);
        
        document.getElementById('linkContent').innerHTML = formatLinkContent(paperDetails.linkContent);
        showNotification('全文链接已更新', 'success');
    });
}

// 登录功能
function showLoginModal() {
    if (elements.loginModal) {
        elements.loginModal.classList.add('show');
        document.getElementById('username').focus();
    }
}

function hideLoginModal() {
    if (elements.loginModal) {
        elements.loginModal.classList.remove('show');
        if (elements.loginForm) elements.loginForm.reset();
    }
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
        if (elements.loginBtn) elements.loginBtn.classList.add('hidden');
        if (elements.logoutBtn) elements.logoutBtn.classList.remove('hidden');
        
        editBtns.forEach(btn => btn.classList.remove('hidden'));
        
        // 显示添加图片按钮和上传区域
        if (addHomepageBtn) addHomepageBtn.classList.remove('hidden');
        if (addKeyBtn) addKeyBtn.classList.remove('hidden');
        if (homepageUpload) homepageUpload.classList.remove('hidden');
        if (keyUpload) keyUpload.classList.remove('hidden');
        
    } else {
        if (elements.loginBtn) elements.loginBtn.classList.remove('hidden');
        if (elements.logoutBtn) elements.logoutBtn.classList.add('hidden');
        
        editBtns.forEach(btn => btn.classList.add('hidden'));
        
        // 隐藏添加图片按钮和上传区域
        if (addHomepageBtn) addHomepageBtn.classList.add('hidden');
        if (addKeyBtn) addKeyBtn.classList.add('hidden');
        if (homepageUpload) homepageUpload.classList.add('hidden');
        if (keyUpload) keyUpload.classList.add('hidden');
    }
}

// 显示通知
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-20 right-4 z-50 p-4 rounded-lg shadow-lg text-white max-w-sm ${
        type === 'success' ? 'bg-green-500' : 
        type === 'error' ? 'bg-red-500' : 
        type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
    }`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// 显示编辑模态框
function showEditModal(title, content, saveCallback) {
    const titleElement = document.getElementById('editModalTitle');
    const contentElement = document.getElementById('editModalContent');
    
    if (titleElement && contentElement) {
        titleElement.textContent = title;
        contentElement.innerHTML = content;
        if (elements.editModal) {
            elements.editModal.classList.add('show');
        }
        
        currentEditData = { saveCallback };
    }
}

// 隐藏编辑模态框
function hideEditModal() {
    if (elements.editModal) {
        elements.editModal.classList.remove('show');
    }
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
    const confirmModal = document.createElement('div');
    confirmModal.className = 'modal show';
    confirmModal.innerHTML = `
        <div class="glass-effect rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
            <h3 class="title-font text-xl font-bold text-gray-800 mb-4">确认删除</h3>
            <p class="text-gray-600 mb-6">${message}</p>
            <div class="flex space-x-4">
                <button id="confirmBtn" class="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg font-medium">
                    确认删除
                </button>
                <button id="cancelBtn" class="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 rounded-lg font-medium">
                    取消
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(confirmModal);
    
    // 绑定事件
    confirmModal.querySelector('#confirmBtn').addEventListener('click', () => {
        callback();
        confirmModal.remove();
    });
    
    confirmModal.querySelector('#cancelBtn').addEventListener('click', () => {
        confirmModal.remove();
    });
}

// 触发图片上传
function triggerImageUpload(type) {
    if (type === 'homepage' && elements.homepageInput) {
        elements.homepageInput.click();
    } else if (type === 'key' && elements.keyInput) {
        elements.keyInput.click();
    }
}

// 页面加载完成事件
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM加载完成，开始初始化...');
    
    // 初始化页面
    initializePage();
    
    // 绑定事件
    bindEvents();
});

// 绑定所有事件
function bindEvents() {
    // 登录相关
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const loginForm = document.getElementById('loginForm');
    const cancelLoginBtn = document.getElementById('cancelLogin');
    
    if (loginBtn) loginBtn.addEventListener('click', showLoginModal);
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (cancelLoginBtn) cancelLoginBtn.addEventListener('click', hideLoginModal);
    
    // 编辑相关
    const editBackgroundBtn = document.getElementById('editBackgroundBtn');
    const editMainContentBtn = document.getElementById('editMainContentBtn');
    const editConclusionBtn = document.getElementById('editConclusionBtn');
    const editLinkBtn = document.getElementById('editLinkBtn');
    const saveEditBtn = document.getElementById('saveEdit');
    const cancelEditBtn = document.getElementById('cancelEdit');
    
    if (editBackgroundBtn) editBackgroundBtn.addEventListener('click', editBackgroundContent);
    if (editMainContentBtn) editMainContentBtn.addEventListener('click', editMainContent);
    if (editConclusionBtn) editConclusionBtn.addEventListener('click', editConclusionContent);
    if (editLinkBtn) editLinkBtn.addEventListener('click', editLinkContent);
    if (saveEditBtn) saveEditBtn.addEventListener('click', saveEditContent);
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', hideEditModal);
    
    // 图片上传
    if (elements.homepageInput) {
        elements.homepageInput.addEventListener('change', (e) => handleImageUpload(e, 'homepage'));
    }
    if (elements.keyInput) {
        elements.keyInput.addEventListener('change', (e) => handleImageUpload(e, 'key'));
    }
    
    // 添加图片按钮
    const addHomepageBtn = document.getElementById('addHomepageBtn');
    const addKeyBtn = document.getElementById('addKeyBtn');
    
    if (addHomepageBtn) addHomepageBtn.addEventListener('click', () => triggerImageUpload('homepage'));
    if (addKeyBtn) addKeyBtn.addEventListener('click', () => triggerImageUpload('key'));
    
    // 图片模态框点击事件 - 点击任意位置都可以关闭
    if (elements.imageModal) {
        elements.imageModal.addEventListener('click', function(e) {
            closeImageModal();
        });
    }
    
// 缩放按钮事件 - 阻止事件冒泡，避免点击按钮时关闭模态框
if (elements.zoomInBtn) {
    elements.zoomInBtn.addEventListener('click', function(e) {
        e.stopPropagation(); // 阻止事件冒泡
        zoomIn();
    });
}

if (elements.zoomOutBtn) {
    elements.zoomOutBtn.addEventListener('click', function(e) {
        e.stopPropagation(); // 阻止事件冒泡
        zoomOut();
    });
}

if (elements.resetZoomBtn) {
    elements.resetZoomBtn.addEventListener('click', function(e) {
        e.stopPropagation(); // 阻止事件冒泡
        resetZoom();
    });
}
    
    // ESC键关闭模态框
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal.show');
            if (activeModal) {
                activeModal.classList.remove('show');
            }
        }
    });
}

// 导出全局函数
window.openImageModal = openImageModal;
window.closeImageModal = closeImageModal;
window.deleteImage = deleteImage;
window.triggerImageUpload = triggerImageUpload;




