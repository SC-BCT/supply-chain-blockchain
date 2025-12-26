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
    
    // 先显示加载中的状态
    document.getElementById('loadingIndicator').style.display = 'flex';
    
    // 初始化DOM元素引用
    initElements();
    
    // 检查登录状态
    isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
    console.log('登录状态:', isLoggedIn);
    
    // 获取URL参数中的论文ID - 确保正确获取当前需要的论文ID
    const urlParams = new URLSearchParams(window.location.search);
    currentPaperId = parseInt(urlParams.get('id'));
    
    // 如果URL中没有ID或ID无效，不默认加载第一篇，而是显示错误信息
    if (!currentPaperId || isNaN(currentPaperId)) {
        console.error('无效的论文ID');
        document.getElementById('loadingIndicator').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('loadingIndicator').style.display = 'none';
        }, 300);
        showNotification('无效的论文ID', 'error');
        return;
    }
    
    console.log('当前论文ID:', currentPaperId);
    
    // 立即更新基本信息区域（快速显示）
    updateBasicInfoPlaceholder();
    
    try {
        // 只加载当前论文的基本信息和详情数据
        const [basicInfoLoaded, detailsLoaded] = await Promise.allSettled([
            loadPaperBasicInfo(currentPaperId),  // 传入当前论文ID
            loadPaperDetails(currentPaperId)     // 传入当前论文ID
        ]);
        
        // 先更新文字内容，快速显示给用户
        updateTextContent();
        
        // 延迟加载图片，不阻塞文字显示
        setTimeout(() => {
            loadPaperImages(currentPaperId);
        }, 500);
        
        // 更新UI
        updateUI();
        
        // 初始化拖拽功能（如果登录）
        if (isLoggedIn) {
            setTimeout(initDragAndDrop, 100);
        }
        
        // 显示完成状态
        document.getElementById('loadingIndicator').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('loadingIndicator').style.display = 'none';
        }, 300);
        
    } catch (error) {
        console.error('初始化失败:', error);
        showNotification('页面加载遇到问题，但已显示可用内容', 'warning');
        document.getElementById('loadingIndicator').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('loadingIndicator').style.display = 'none';
        }, 300);
    }
    
    // 添加动画效果
    setTimeout(() => {
        const fadeElements = document.querySelectorAll('.fade-in');
        if (fadeElements.length > 0) {
            anime({
                targets: '.fade-in',
                opacity: [0, 1],
                translateY: [30, 0],
                duration: 600,
                delay: anime.stagger(100),
                easing: 'easeOutQuad'
            });
        }
    }, 50);
}

// 更新基本信息占位符（快速显示）
function updateBasicInfoPlaceholder() {
    const titleElement = document.getElementById('paperTitle');
    if (titleElement) {
        titleElement.textContent = `论文 #${currentPaperId}`;
    }
}

// 更新基本信息占位符（快速显示）
function updateBasicInfoPlaceholder() {
    const titleElement = document.getElementById('paperTitle');
    if (titleElement) {
        titleElement.textContent = `论文 #${currentPaperId}`;
    }
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

// 加载论文详情数据 - 修复版（JSON优先）
async function loadPaperDetails() {
    console.log(`开始加载论文${currentPaperId}的详情数据`);
    
    let paperDetails = null;
    
    // 检查URL中是否有强制刷新参数
    const urlParams = new URLSearchParams(window.location.search);
    const forceRefresh = urlParams.get('refresh') === 'true';
    
    // 方法1：总是先尝试从JSON文件加载最新数据
    if (!forceRefresh) {
        try {
            // 使用索引文件快速定位
            paperDetails = await loadFromJSONFile();
            if (paperDetails) {
                console.log(`从JSON文件获取到论文${currentPaperId}的最新数据`);
                
                // 立即显示JSON数据，然后异步保存到本地
                const completePaperDetails = ensurePaperDetailsStructure(paperDetails);
                renderPaperDetails(completePaperDetails);
                
                // 异步保存到本地存储（不阻塞显示）
                savePaperDetailsAsync(completePaperDetails);
                return; // 直接返回，不继续执行下面的代码
            }
        } catch (error) {
            console.log('从JSON文件加载失败，尝试本地数据:', error);
        }
    }
    
    // 方法2：如果JSON加载失败，使用本地数据
    // 1. 从IndexedDB加载
    try {
        const indexedDBData = await IndexedDBManager.getPaperDetails(currentPaperId);
        if (indexedDBData) {
            console.log(`从IndexedDB获取到论文${currentPaperId}的详情`);
            paperDetails = indexedDBData;
        }
    } catch (error) {
        console.log('从IndexedDB加载失败:', error);
    }
    
    // 2. 从localStorage加载
    if (!paperDetails) {
        const localPaperDetails = DataManager.load('paperDetails', {});
        if (localPaperDetails[currentPaperId] || localPaperDetails[String(currentPaperId)]) {
            paperDetails = localPaperDetails[currentPaperId] || localPaperDetails[String(currentPaperId)];
            console.log(`从localStorage获取到论文${currentPaperId}的详情`);
        }
    }
    
    // 方法3：创建默认数据
    if (!paperDetails) {
        console.log(`为论文${currentPaperId}创建默认详情数据`);
        paperDetails = createDefaultPaperDetails();
    }
    
    // 确保数据结构完整
    const completePaperDetails = ensurePaperDetailsStructure(paperDetails);
    console.log(`最终渲染的论文详情:`, completePaperDetails);
    renderPaperDetails(completePaperDetails);
}

// 确保数据结构完整的辅助函数
function ensurePaperDetailsStructure(paperDetails) {
    return {
        backgroundContent: paperDetails.backgroundContent || '请添加研究背景信息',
        mainContent: paperDetails.mainContent || '请添加研究内容信息',
        conclusionContent: paperDetails.conclusionContent || '请添加研究结论信息',
        linkContent: paperDetails.linkContent || '暂无全文链接',
        homepageImages: paperDetails.homepageImages || [],
        keyImages: paperDetails.keyImages || []
    };
}

// 创建默认论文详情
function createDefaultPaperDetails() {
    return {
        backgroundContent: '请添加研究背景信息',
        mainContent: '请添加研究内容信息',
        conclusionContent: '请添加研究结论信息',
        linkContent: '暂无全文链接',
        homepageImages: [],
        keyImages: []
    };
}

// 异步保存论文详情（不阻塞主线程）
async function savePaperDetailsAsync(paperDetails) {
    setTimeout(async () => {
        try {
            // 保存到localStorage（仅文本）
            const localPaperDetails = DataManager.load('paperDetails', {});
            localPaperDetails[currentPaperId] = {
                backgroundContent: paperDetails.backgroundContent,
                mainContent: paperDetails.mainContent,
                conclusionContent: paperDetails.conclusionContent,
                linkContent: paperDetails.linkContent
            };
            DataManager.save('paperDetails', localPaperDetails);
            
            // 保存到IndexedDB（完整数据）
            await IndexedDBManager.savePaperDetails(currentPaperId, paperDetails);
            console.log(`论文${currentPaperId}详情已异步保存到存储`);
        } catch (error) {
            console.error('异步保存失败:', error);
        }
    }, 0);
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

// 渲染图片（添加懒加载）
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
    
    console.log(`渲染图片到 ${containerId}: ${images.length} 张图片`);
    
    // 先显示占位符
    container.innerHTML = images.map((image, index) => {
        return `
        <div class="image-item bg-gray-200 rounded-lg overflow-hidden relative group mb-4 min-h-[200px] flex items-center justify-center" 
             data-id="${index}" 
             draggable="${isLoggedIn ? 'true' : 'false'}"
             data-image="${image}">
            <div class="text-gray-500">加载图片中...</div>
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
    
    // 延迟加载图片（提升页面响应速度）
    setTimeout(() => {
        images.forEach((image, index) => {
            const img = new Image();
            img.onload = function() {
                const item = container.querySelector(`.image-item[data-id="${index}"]`);
                if (item) {
                    item.innerHTML = `
                        <img src="${image}" alt="论文图片" 
                             class="w-full h-auto cursor-pointer lazy-image loaded"
                             onclick="openImageModal('${image.replace(/'/g, "\\'")}')">
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
                    `;
                }
            };
            img.src = image;
        });
    }, 100);
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

// 从JSON文件加载数据
async function loadFromJSONFile() {
    try {
        console.log('尝试从分页JSON文件加载数据...');
        
        // 方法1：使用预缓存的索引（性能最优）
        let targetFileName = null;
        
        // 首先从sessionStorage获取索引缓存
        let fileIndexData = null;
        try {
            const cachedIndex = sessionStorage.getItem('paperIndexCache');
            const cacheTime = sessionStorage.getItem('paperIndexCacheTime');
            
            // 检查缓存是否有效（1小时内有效）
            if (cachedIndex && cacheTime && (Date.now() - parseInt(cacheTime)) < 3600000) {
                fileIndexData = JSON.parse(cachedIndex);
                console.log('从sessionStorage加载索引缓存');
            } else {
                // 从网络加载并缓存
                const indexResponse = await fetch('paperIndex.json');
                if (indexResponse.ok) {
                    fileIndexData = await indexResponse.json();
                    // 缓存到sessionStorage
                    sessionStorage.setItem('paperIndexCache', JSON.stringify(fileIndexData));
                    sessionStorage.setItem('paperIndexCacheTime', Date.now().toString());
                    console.log('从网络加载索引并缓存到sessionStorage');
                }
            }
        } catch (indexError) {
            console.log('索引文件处理失败，尝试直接按计算方式查找:', indexError);
        }
        
        // 使用索引快速定位文件
        if (fileIndexData) {
            for (const [fileName, fileInfo] of Object.entries(fileIndexData)) {
                // 优先使用paperIds查找（最精确）
                if (fileInfo.paperIds && fileInfo.paperIds.includes(currentPaperId)) {
                    targetFileName = fileName;
                    console.log(`使用索引精确找到: 论文ID ${currentPaperId} 在文件 ${fileName} 中`);
                    break;
                }
                // 其次使用范围查找
                else if (fileInfo.range) {
                    const [minId, maxId] = fileInfo.range;
                    if (currentPaperId >= minId && currentPaperId <= maxId) {
                        targetFileName = fileName;
                        console.log(`使用索引范围找到: 论文ID ${currentPaperId} 在文件 ${fileName} 的范围内`);
                        break;
                    }
                }
            }
        }
        
        // 方法2：如果索引不可用，直接计算文件名
        if (!targetFileName) {
            const fileNum = Math.ceil(currentPaperId / 5);
            const paddedNum = String(fileNum).padStart(2, '0');
            targetFileName = `paperDetails${paddedNum}.json`;
            console.log(`通过计算确定文件: ${targetFileName} (论文ID: ${currentPaperId})`);
        }
        
        // 加载目标文件（只加载需要的文件）
        console.log(`加载文件: ${targetFileName}`);
        const response = await fetch(targetFileName);
        if (response.ok) {
            const jsonData = await response.json();
            
            // 直接查找数据（使用数字键和字符串键两种方式）
            const foundData = jsonData[currentPaperId] || jsonData[String(currentPaperId)];
            
            if (foundData) {
                console.log(`从 ${targetFileName} 找到论文${currentPaperId}的详情`);
                
                // 构建完整数据
                return {
                    backgroundContent: foundData.backgroundContent || '请添加研究背景信息',
                    mainContent: foundData.mainContent || '请添加研究内容信息',
                    conclusionContent: foundData.conclusionContent || '请添加研究结论信息',
                    linkContent: foundData.linkContent || '暂无全文链接',
                    homepageImages: foundData.homepageImages || [],
                    keyImages: foundData.keyImages || []
                };
            } else {
                console.warn(`文件 ${targetFileName} 中没有找到论文 ${currentPaperId} 的数据`);
                return null;
            }
        }
    } catch (error) {
        console.log('从分页JSON文件加载失败:', error);
        
        // 作为后备方案，尝试加载旧的单个文件
        try {
            console.log('尝试加载旧的 paperDetails.json 文件作为后备...');
            const fallbackResponse = await fetch('paperDetails.json');
            if (fallbackResponse.ok) {
                const fallbackData = await fallbackResponse.json();
                console.log('从旧文件加载的数据:', fallbackData);
                
                if (fallbackData && typeof fallbackData === 'object') {
                    const foundData = fallbackData[currentPaperId] || fallbackData[String(currentPaperId)];
                    if (foundData) {
                        console.log(`从旧文件找到论文${currentPaperId}的详情`);
                        return {
                            backgroundContent: foundData.backgroundContent || '请添加研究背景信息',
                            mainContent: foundData.mainContent || '请添加研究内容信息',
                            conclusionContent: foundData.conclusionContent || '请添加研究结论信息',
                            linkContent: foundData.linkContent || '暂无全文链接',
                            homepageImages: foundData.homepageImages || [],
                            keyImages: foundData.keyImages || []
                        };
                    }
                }
            }
        } catch (fallbackError) {
            console.log('旧文件加载也失败:', fallbackError);
            return null;
        }
        
        return null;
    }
}

// 预加载常见论文的索引文件
function preloadPaperIndex() {
    // 如果索引文件可能较大，可以预加载
    if (!sessionStorage.getItem('paperIndexCache')) {
        fetch('paperIndex.json')
            .then(response => response.json())
            .then(data => {
                sessionStorage.setItem('paperIndexCache', JSON.stringify(data));
                sessionStorage.setItem('paperIndexCacheTime', Date.now().toString());
                console.log('预加载索引文件完成');
            })
            .catch(error => console.log('预加载索引文件失败:', error));
    }
}

// 异步保存论文详情（不阻塞主线程）
async function savePaperDetailsAsync(paperDetails) {
    setTimeout(async () => {
        try {
            // 保存到localStorage（仅文本）
            const localPaperDetails = DataManager.load('paperDetails', {});
            localPaperDetails[currentPaperId] = {
                backgroundContent: paperDetails.backgroundContent,
                mainContent: paperDetails.mainContent,
                conclusionContent: paperDetails.conclusionContent,
                linkContent: paperDetails.linkContent
            };
            DataManager.save('paperDetails', localPaperDetails);
            
            // 保存到IndexedDB（完整数据）
            await IndexedDBManager.savePaperDetails(currentPaperId, paperDetails);
            console.log(`论文${currentPaperId}详情已异步保存到存储`);
        } catch (error) {
            console.error('异步保存失败:', error);
        }
    }, 0);
}

// 创建默认论文详情
function createDefaultPaperDetails() {
    return {
        backgroundContent: '请添加研究背景信息',
        mainContent: '请添加研究内容信息',
        conclusionContent: '请添加研究结论信息',
        linkContent: '暂无全文链接',
        homepageImages: [],
        keyImages: []
    };
}

// 预加载常见论文的索引文件
function preloadPaperIndex() {
    // 如果索引文件可能较大，可以预加载
    if (!sessionStorage.getItem('paperIndexCache')) {
        fetch('paperIndex.json')
            .then(response => response.json())
            .then(data => {
                sessionStorage.setItem('paperIndexCache', JSON.stringify(data));
                sessionStorage.setItem('paperIndexCacheTime', Date.now().toString());
                console.log('预加载索引文件完成');
            })
            .catch(error => console.log('预加载索引文件失败:', error));
    }
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











