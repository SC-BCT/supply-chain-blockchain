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
                    backgroundContent: data.backgroundContent || '暂无研究背景信息',
                    mainContent: data.mainContent || '暂无研究内容信息',
                    conclusionContent: data.conclusionContent || '暂无研究结论信息',
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

    // 获取所有论文详情
    static async getAllPaperDetails() {
        try {
            await this.init();
            
            return new Promise((resolve) => {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const objectStore = transaction.objectStore(this.storeName);
                const request = objectStore.getAll();
                
                request.onsuccess = (event) => {
                    const result = {};
                    event.target.result.forEach(item => {
                        if (item && item.paperId) {
                            result[item.paperId] = item;
                        }
                    });
                    resolve(result);
                };
                
                request.onerror = (event) => {
                    console.error('获取所有数据失败:', event.target.error);
                    resolve({});
                };
            });
        } catch (error) {
            console.error('IndexedDB操作失败:', error);
            return {};
        }
    }
}

// 页面初始化
async function initializePage() {
    console.log('开始初始化论文详情页');
    
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
    document.getElementById('paperTitle').textContent = paper.title || `论文 #${currentPaperId}`;
    document.getElementById('paperJournal').textContent = paper.journal || '';
    document.getElementById('paperTime').textContent = paper.time || '';
    document.getElementById('paperAuthors').textContent = paper.authors || '';
}

// 加载论文详情数据
async function loadPaperDetails() {
    console.log(`开始加载论文${currentPaperId}的详情数据`);
    
    let paperDetails = null;
    
    // 尝试顺序：1. IndexedDB, 2. localStorage, 3. paperDetails.json
    try {
        // 1. 从IndexedDB加载
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
        if (localPaperDetails[currentPaperId]) {
            console.log(`从localStorage获取到论文${currentPaperId}的详情`);
            paperDetails = localPaperDetails[currentPaperId];
            
            // 确保数据结构完整
            paperDetails = {
                backgroundContent: paperDetails.backgroundContent || '暂无研究背景信息',
                mainContent: paperDetails.mainContent || '暂无研究内容信息',
                conclusionContent: paperDetails.conclusionContent || '暂无研究结论信息',
                linkContent: paperDetails.linkContent || '暂无全文链接',
                homepageImages: paperDetails.homepageImages || [],
                keyImages: paperDetails.keyImages || []
            };
            
            // 保存回IndexedDB
            IndexedDBManager.savePaperDetails(currentPaperId, paperDetails);
        }
    }
    
    // 3. 从paperDetails.json加载
    if (!paperDetails) {
        try {
            const response = await fetch('paperDetails.json');
            if (response.ok) {
                const jsonData = await response.json();
                console.log('从paperDetails.json加载的数据:', jsonData);
                
                // 处理不同的数据格式
                let detailsData = jsonData;
                if (typeof jsonData === 'string') {
                    try {
                        detailsData = JSON.parse(jsonData);
                    } catch (e) {
                        console.error('解析JSON失败:', e);
                    }
                }
                
                if (detailsData[currentPaperId]) {
                    // 格式: { "1": {...}, "2": {...} }
                    paperDetails = detailsData[currentPaperId];
                } else if (Array.isArray(detailsData)) {
                    // 格式: [{paperId: 1, ...}, {paperId: 2, ...}]
                    const item = detailsData.find(item => 
                        item.paperId === currentPaperId || 
                        (item.id && item.id === currentPaperId)
                    );
                    if (item) {
                        paperDetails = item;
                    }
                }
                
                if (paperDetails) {
                    console.log(`从paperDetails.json找到论文${currentPaperId}的详情`);
                    
                    // 确保数据结构完整
                    paperDetails = {
                        backgroundContent: paperDetails.backgroundContent || '暂无研究背景信息',
                        mainContent: paperDetails.mainContent || '暂无研究内容信息',
                        conclusionContent: paperDetails.conclusionContent || '暂无研究结论信息',
                        linkContent: paperDetails.linkContent || '暂无全文链接',
                        homepageImages: paperDetails.homepageImages || [],
                        keyImages: paperDetails.keyImages || []
                    };
                    
                    // 保存到localStorage和IndexedDB
                    const localPaperDetails = DataManager.load('paperDetails', {});
                    localPaperDetails[currentPaperId] = paperDetails;
                    DataManager.save('paperDetails', localPaperDetails);
                    
                    IndexedDBManager.savePaperDetails(currentPaperId, paperDetails);
                }
            }
        } catch (error) {
            console.log('从paperDetails.json加载失败:', error);
        }
    }
    
    // 4. 创建默认数据
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
        
        IndexedDBManager.savePaperDetails(currentPaperId, paperDetails);
    }
    
    console.log(`最终渲染的论文详情:`, paperDetails);
    renderPaperDetails(paperDetails);
}

// 渲染论文详情
function renderPaperDetails(paperDetails) {
    // 渲染文字内容到对应的框里
    document.getElementById('backgroundContent').innerHTML = formatTextWithParagraphs(paperDetails.backgroundContent);
    document.getElementById('mainContent').innerHTML = formatTextWithParagraphs(paperDetails.mainContent);
    document.getElementById('conclusionContent').innerHTML = formatTextWithParagraphs(paperDetails.conclusionContent);
    document.getElementById('linkContent').innerHTML = formatLinkContent(paperDetails.linkContent);
    
    // 渲染图片
    renderImages('homepageImages', paperDetails.homepageImages);
    renderImages('keyImages', paperDetails.keyImages);
}

// 格式化文本为段落
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
    if (!content || content.trim() === '') {
        return '暂无全文链接';
    }
    
    if (content.startsWith('http://') || content.startsWith('https://')) {
        return `<a href="${content}" target="_blank" class="text-blue-600 hover:text-blue-800 underline break-all">${content}</a>`;
    }
    
    return content;
}

// 渲染图片
function renderImages(containerId, images) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (!images || images.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-8">暂无图片</p>';
        return;
    }
    
    container.innerHTML = images.map((image, index) => `
        <div class="image-item bg-gray-100 rounded-lg overflow-hidden relative group mb-4" 
             data-id="${index}" 
             draggable="${isLoggedIn ? 'true' : 'false'}"
             data-image="${image}">
            <img src="${image}" alt="论文图片" 
                 class="w-full h-auto cursor-pointer"
                 style="max-width: 100%; height: auto; display: block;"
                 onclick="openImageModal('${image}')">
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
    
    // 图片加载完成后重新调整
    container.querySelectorAll('img').forEach(img => {
        img.onload = function() {
            // 图片宽度调整为容器宽度，高度自适应
            this.style.width = '100%';
            this.style.height = 'auto';
        };
    });
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
        if (isLoggedIn) {
            item.setAttribute('draggable', 'true');
        }
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
            backgroundContent: '暂无研究背景信息',
            mainContent: '暂无研究内容信息',
            conclusionContent: '暂无研究结论信息',
            linkContent: '暂无全文链接',
            homepageImages: [],
            keyImages: []
        };
    }
    
    // 确保数据结构完整
    return {
        backgroundContent: paperDetails.backgroundContent || '暂无研究背景信息',
        mainContent: paperDetails.mainContent || '暂无研究内容信息',
        conclusionContent: paperDetails.conclusionContent || '暂无研究结论信息',
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
    elements.modalImage.src = imageSrc;
    elements.imageModal.classList.add('show');
}

// 关闭图片模态框
function closeImageModal() {
    elements.imageModal.classList.remove('show');
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
        
        // 重新初始化拖拽
        setTimeout(() => {
            const container = document.getElementById(containerId);
            if (container) {
                initDragAndDropForContainer(container, containerId);
            }
        }, 100);
        
        showNotification('图片已删除', 'success');
    });
}

// 处理图片上传 - 修复版，确保无限制上传
async function handleImageUpload(event, type) {
    const files = Array.from(event.target.files);
    
    if (files.length === 0) return;
    
    // 清空文件输入，以便可以再次选择相同文件
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
        const uploadPromises = files.map(file => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = function(e) {
                    // 压缩图片以节省空间
                    compressImage(e.target.result, (compressedImage) => {
                        targetArray.push(compressedImage);
                        resolve();
                    });
                };
                reader.readAsDataURL(file);
            });
        });
        
        // 等待所有图片上传完成
        await Promise.all(uploadPromises);
        
        // 保存数据
        await savePaperDetails(paperDetails);
        
        // 重新渲染
        renderImages(type === 'homepage' ? 'homepageImages' : 'keyImages', targetArray);
        
        // 重新初始化拖拽
        setTimeout(() => {
            const container = document.getElementById(type === 'homepage' ? 'homepageImages' : 'keyImages');
            if (container) {
                initDragAndDropForContainer(container, type === 'homepage' ? 'homepageImages' : 'keyImages');
            }
        }, 100);
        
        showNotification(`成功上传 ${files.length} 张图片`, 'success');
        
    } catch (error) {
        console.error('图片上传失败:', error);
        showNotification('图片上传失败，请重试', 'error');
    }
}

// 压缩图片以节省存储空间
function compressImage(dataUrl, callback, maxWidth = 1200) {
    const img = new Image();
    img.src = dataUrl;
    
    img.onload = function() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // 计算压缩后的尺寸
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // 绘制压缩后的图片
        ctx.drawImage(img, 0, 0, width, height);
        
        // 转换为jpeg格式，质量为0.8
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        callback(compressedDataUrl);
    };
    
    img.onerror = function() {
        // 如果压缩失败，使用原始图片
        callback(dataUrl);
    };
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
    
    // 点击背景关闭
    confirmModal.addEventListener('click', (e) => {
        if (e.target === confirmModal) {
            confirmModal.remove();
        }
    });
}

// 触发图片上传
function triggerImageUpload(type) {
    if (type === 'homepage') {
        elements.homepageInput.click();
    } else if (type === 'key') {
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
    if (elements.loginBtn) elements.loginBtn.addEventListener('click', showLoginModal);
    if (elements.logoutBtn) elements.logoutBtn.addEventListener('click', logout);
    if (elements.loginForm) elements.loginForm.addEventListener('submit', handleLogin);
    
    const cancelLoginBtn = document.getElementById('cancelLogin');
    if (cancelLoginBtn) cancelLoginBtn.addEventListener('click', hideLoginModal);
    
    // 编辑相关
    const editBackgroundBtn = document.getElementById('editBackgroundBtn');
    const editMainContentBtn = document.getElementById('editMainContentBtn');
    const editConclusionBtn = document.getElementById('editConclusionBtn');
    const editLinkBtn = document.getElementById('editLinkBtn');
    
    if (editBackgroundBtn) editBackgroundBtn.addEventListener('click', editBackgroundContent);
    if (editMainContentBtn) editMainContentBtn.addEventListener('click', editMainContent);
    if (editConclusionBtn) editConclusionBtn.addEventListener('click', editConclusionContent);
    if (editLinkBtn) editLinkBtn.addEventListener('click', editLinkContent);
    
    const saveEditBtn = document.getElementById('saveEdit');
    const cancelEditBtn = document.getElementById('cancelEdit');
    
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
