// 全局变量
let isLoggedIn = false;
let currentEditData = null;
let currentPaperId = null;
let draggedElement = null;
let mouseDownTarget = null;
let mouseUpTarget = null;
let currentImageScale = 1;
let isDataLoadedFromGitHub = false;

// IndexedDB 数据库
let db = null;
const DB_NAME = 'PaperImagesDB';
const DB_VERSION = 1;
const STORE_NAME = 'images';

// DOM元素
const elements = {
    loginBtn: document.getElementById('loginBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    loginModal: document.getElementById('loginModal'),
    loginForm: document.getElementById('loginForm'),
    editModal: document.getElementById('editModal'),
    imageModal: document.getElementById('imageModal'),
    modalImage: document.getElementById('modalImage'),
    zoomInBtn: document.getElementById('zoomInBtn'),
    zoomOutBtn: document.getElementById('zoomOutBtn'),
    resetZoomBtn: document.getElementById('resetZoomBtn')
};

// 初始化 IndexedDB
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = (event) => {
            console.error('IndexedDB 打开失败:', event.target.error);
            // 如果IndexedDB失败，仍然继续，使用localStorage
            resolve(null);
        };
        
        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('IndexedDB 初始化成功');
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                // 创建对象存储，使用复合键：paperId_type_index
                const store = db.createObjectStore(STORE_NAME, { 
                    keyPath: ['paperId', 'type', 'index'] 
                });
                console.log('创建对象存储成功');
            }
        };
    });
}

// 保存图片到 IndexedDB
async function saveImageToDB(paperId, type, index, imageData) {
    return new Promise((resolve, reject) => {
        if (!db) {
            // 如果没有IndexedDB，保存到localStorage作为备份
            const backupKey = `img_${paperId}_${type}_${index}`;
            DataManager.save(backupKey, imageData);
            resolve(true);
            return;
        }
        
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        const record = {
            paperId: paperId,
            type: type,
            index: index,
            data: imageData,
            timestamp: Date.now()
        };
        
        const request = store.put(record);
        
        request.onsuccess = () => {
            console.log(`图片保存成功: paperId=${paperId}, type=${type}, index=${index}`);
            resolve(true);
        };
        
        request.onerror = (event) => {
            console.error('保存图片失败:', event.target.error);
            // 保存到localStorage作为备份
            const backupKey = `img_${paperId}_${type}_${index}`;
            DataManager.save(backupKey, imageData);
            resolve(true);
        };
    });
}

// 从 IndexedDB 获取图片
async function getImageFromDB(paperId, type, index) {
    return new Promise((resolve, reject) => {
        if (!db) {
            // 尝试从localStorage备份中获取
            const backupKey = `img_${paperId}_${type}_${index}`;
            const imageData = DataManager.load(backupKey);
            resolve(imageData);
            return;
        }
        
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get([paperId, type, index]);
        
        request.onsuccess = (event) => {
            const result = event.target.result;
            if (result) {
                resolve(result.data);
            } else {
                // 尝试从localStorage备份中获取
                const backupKey = `img_${paperId}_${type}_${index}`;
                const imageData = DataManager.load(backupKey);
                resolve(imageData);
            }
        };
        
        request.onerror = (event) => {
            console.error('获取图片失败:', event.target.error);
            // 尝试从localStorage备份中获取
            const backupKey = `img_${paperId}_${type}_${index}`;
            const imageData = DataManager.load(backupKey);
            resolve(imageData);
        };
    });
}

// 获取所有图片
async function getAllImagesFromDB(paperId, type) {
    return new Promise((resolve, reject) => {
        if (!db) {
            // 从localStorage备份中获取所有图片
            const images = [];
            let index = 0;
            
            while (true) {
                const backupKey = `img_${paperId}_${type}_${index}`;
                const imageData = DataManager.load(backupKey);
                
                if (imageData) {
                    images.push(imageData);
                    index++;
                } else {
                    break;
                }
            }
            
            resolve(images);
            return;
        }
        
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const images = [];
        
        // 使用游标获取特定论文和类型的所有图片
        const request = store.openCursor();
        
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                const record = cursor.value;
                if (record.paperId === paperId && record.type === type) {
                    images.push({
                        index: record.index,
                        data: record.data
                    });
                }
                cursor.continue();
            } else {
                // 按索引排序
                images.sort((a, b) => a.index - b.index);
                resolve(images.map(img => img.data));
            }
        };
        
        request.onerror = (event) => {
            console.error('获取图片列表失败:', event.target.error);
            // 从localStorage备份中获取
            const backupImages = [];
            let index = 0;
            
            while (true) {
                const backupKey = `img_${paperId}_${type}_${index}`;
                const imageData = DataManager.load(backupKey);
                
                if (imageData) {
                    backupImages.push(imageData);
                    index++;
                } else {
                    break;
                }
            }
            
            resolve(backupImages);
        };
    });
}

// 删除图片
async function deleteImageFromDB(paperId, type, index) {
    return new Promise((resolve, reject) => {
        if (!db) {
            // 从localStorage备份中删除
            const backupKey = `img_${paperId}_${type}_${index}`;
            DataManager.remove(backupKey);
            resolve(true);
            return;
        }
        
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete([paperId, type, index]);
        
        request.onsuccess = () => {
            console.log(`图片删除成功: paperId=${paperId}, type=${type}, index=${index}`);
            resolve(true);
        };
        
        request.onerror = (event) => {
            console.error('删除图片失败:', event.target.error);
            // 从localStorage备份中删除
            const backupKey = `img_${paperId}_${type}_${index}`;
            DataManager.remove(backupKey);
            resolve(true);
        };
    });
}

// 删除某类型的所有图片
async function deleteAllImagesByType(paperId, type) {
    return new Promise((resolve, reject) => {
        if (!db) {
            // 从localStorage备份中删除所有该类型的图片
            let index = 0;
            while (true) {
                const backupKey = `img_${paperId}_${type}_${index}`;
                const imageData = DataManager.load(backupKey);
                if (imageData) {
                    DataManager.remove(backupKey);
                    index++;
                } else {
                    break;
                }
            }
            resolve(true);
            return;
        }
        
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        // 使用游标删除所有匹配的记录
        const request = store.openCursor();
        
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                const record = cursor.value;
                if (record.paperId === paperId && record.type === type) {
                    cursor.delete();
                }
                cursor.continue();
            } else {
                console.log(`已删除所有类型为${type}的图片`);
                resolve(true);
            }
        };
        
        request.onerror = (event) => {
            console.error('删除所有图片失败:', event.target.error);
            resolve(false);
        };
    });
}

// 重新索引图片（修复索引问题）
async function reindexImages(paperId, type) {
    try {
        // 获取所有图片
        const allImages = await getAllImagesFromDB(paperId, type);
        
        // 删除该类型的所有记录
        await deleteAllImagesByType(paperId, type);
        
        // 重新保存图片，索引从0开始连续
        for (let i = 0; i < allImages.length; i++) {
            await saveImageToDB(paperId, type, i, allImages[i]);
        }
        
        console.log(`重新索引完成: ${type}类型图片，共${allImages.length}张`);
        return allImages;
    } catch (error) {
        console.error('重新索引失败:', error);
        throw error;
    }
}

// 数据管理
class DataManager {
    static save(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('保存到localStorage失败:', e);
            return false;
        }
    }
    
    static load(key, defaultValue = null) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
    }
    
    static remove(key) {
        localStorage.removeItem(key);
    }
    
    // 检查是否有本地编辑（用户编辑过的数据）
    static hasLocalEdits(paperId) {
        const paperDetails = this.load('paperDetails', {});
        const paperDetail = paperDetails[paperId];
        
        if (!paperDetail) return false;
        
        // 检查是否有任何内容被编辑过（不是默认值）
        const hasEditedContent = 
            paperDetail.backgroundContent !== '暂无研究背景信息' ||
            paperDetail.mainContent !== '暂无研究内容信息' ||
            paperDetail.conclusionContent !== '暂无研究结论信息' ||
            paperDetail.linkContent !== '暂无全文链接';
        
        return hasEditedContent;
    }
}

// 页面初始化
async function initializePage() {
    // 检查登录状态
    isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
    
    // 获取URL参数中的论文ID
    const urlParams = new URLSearchParams(window.location.search);
    currentPaperId = parseInt(urlParams.get('id')) || 1;
    
    try {
        // 初始化 IndexedDB
        await initDB();
        
        // 加载论文数据
        await loadPaperData();
        
        // 加载论文详情数据
        await loadPaperDetails();
        
        // 更新UI
        updateUI();
        
    } catch (error) {
        console.error('初始化失败:', error);
        showNotification('加载数据失败', 'error');
    }
    
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

// 加载论文数据 - 总是从GitHub的data.json加载
async function loadPaperData() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) {
            throw new Error('无法加载data.json文件');
        }
        
        const jsonData = await response.json();
        const projectData = jsonData.projectData ? JSON.parse(jsonData.projectData) : jsonData;
        
        // 保存到localStorage（以便离线使用）
        DataManager.save('projectData', projectData);
        
        // 找到当前论文
        const paper = projectData.papers.find(p => p.id === currentPaperId);
        if (paper) {
            // 渲染论文基本信息
            document.getElementById('paperTitle').textContent = paper.title;
            document.getElementById('paperJournal').textContent = paper.journal;
            document.getElementById('paperTime').textContent = paper.time;
            document.getElementById('paperAuthors').textContent = paper.authors;
        } else {
            document.getElementById('paperTitle').textContent = '论文未找到';
        }
        
    } catch (error) {
        console.error('从GitHub加载论文数据失败:', error);
        // 使用localStorage中的数据
        const projectData = DataManager.load('projectData', { papers: [] });
        const paper = projectData.papers.find(p => p.id === currentPaperId);
        if (paper) {
            document.getElementById('paperTitle').textContent = paper.title;
            document.getElementById('paperJournal').textContent = paper.journal || '';
            document.getElementById('paperTime').textContent = paper.time || '';
            document.getElementById('paperAuthors').textContent = paper.authors || '';
        }
    }
}

// 从GitHub的paperDetails.json加载论文详情数据
async function loadPaperDetailsFromGitHub() {
    try {
        const response = await fetch('paperDetails.json');
        if (!response.ok) {
            throw new Error('无法加载paperDetails.json文件');
        }
        
        const paperDetailsData = await response.json();
        
        // 如果是字符串，尝试解析
        const details = typeof paperDetailsData === 'string' ? 
            JSON.parse(paperDetailsData) : paperDetailsData;
        
        // 查找当前论文的详情
        let currentPaperDetails;
        
        if (Array.isArray(details)) {
            currentPaperDetails = details.find(item => item.paperId === currentPaperId);
        } else if (details[currentPaperId]) {
            currentPaperDetails = details[currentPaperId];
        }
        
        if (currentPaperDetails) {
            isDataLoadedFromGitHub = true;
            return currentPaperDetails;
        }
        
        return null;
    } catch (error) {
        console.error('从GitHub加载论文详情失败:', error);
        return null;
    }
}

// 加载论文详情数据
async function loadPaperDetails() {
    // 优先从GitHub加载数据
    const githubPaperDetails = await loadPaperDetailsFromGitHub();
    
    // 检查是否有本地编辑
    const hasLocalEdits = DataManager.hasLocalEdits(currentPaperId);
    
    if (githubPaperDetails && !hasLocalEdits) {
        // 使用GitHub的数据（没有本地编辑时）
        console.log('使用GitHub数据（无本地编辑）');
        await renderPaperDetails(githubPaperDetails);
        
        // 将GitHub的图片数据保存到本地数据库
        if (githubPaperDetails.homepageImages && githubPaperDetails.homepageImages.length > 0) {
            for (let i = 0; i < githubPaperDetails.homepageImages.length; i++) {
                await saveImageToDB(currentPaperId, 'homepage', i, githubPaperDetails.homepageImages[i]);
            }
        }
        
        if (githubPaperDetails.keyImages && githubPaperDetails.keyImages.length > 0) {
            for (let i = 0; i < githubPaperDetails.keyImages.length; i++) {
                await saveImageToDB(currentPaperId, 'key', i, githubPaperDetails.keyImages[i]);
            }
        }
    } else {
        // 使用本地数据（有本地编辑时）
        console.log('使用本地数据（有本地编辑）');
        await loadPaperDetailsFromLocalStorage();
    }
}

// 从localStorage加载论文详情数据
async function loadPaperDetailsFromLocalStorage() {
    const paperDetails = DataManager.load('paperDetails', {});
    let currentPaperDetails = paperDetails[currentPaperId];
    
    if (!currentPaperDetails) {
        // 如果没有本地数据，尝试从GitHub加载
        const githubPaperDetails = await loadPaperDetailsFromGitHub();
        if (githubPaperDetails) {
            currentPaperDetails = githubPaperDetails;
            isDataLoadedFromGitHub = true;
        } else {
            // 使用默认数据
            currentPaperDetails = {
                backgroundContent: '暂无研究背景信息',
                mainContent: '暂无研究内容信息',
                conclusionContent: '暂无研究结论信息',
                linkContent: '暂无全文链接'
            };
        }
    }
    
    await renderPaperDetails(currentPaperDetails);
}

// 渲染论文详情
async function renderPaperDetails(paperDetails) {
    // 渲染研究背景
    document.getElementById('backgroundContent').innerHTML = formatTextWithParagraphs(paperDetails.backgroundContent);
    
    // 渲染研究内容
    document.getElementById('mainContent').innerHTML = formatTextWithParagraphs(paperDetails.mainContent);
    
    // 渲染研究结论
    document.getElementById('conclusionContent').innerHTML = formatTextWithParagraphs(paperDetails.conclusionContent);
    
    // 渲染全文链接
    document.getElementById('linkContent').innerHTML = formatLinkContent(paperDetails.linkContent);
    
    // 从本地数据库加载并渲染论文首页图片
    const homepageImages = await getAllImagesFromDB(currentPaperId, 'homepage');
    renderImages('homepageImages', homepageImages);
    
    // 从本地数据库加载并渲染关键内容图片
    const keyImages = await getAllImagesFromDB(currentPaperId, 'key');
    renderImages('keyImages', keyImages);
}

// 格式化文本，将换行符转换为HTML段落
function formatTextWithParagraphs(text) {
    if (!text || text.trim() === '') {
        return '<p>暂无内容</p>';
    }
    
    // 将文本按换行符分割成段落
    const paragraphs = text.split('\n').filter(p => p.trim() !== '');
    
    if (paragraphs.length === 0) {
        return '<p>暂无内容</p>';
    }
    
    // 为每个段落添加<p>标签
    return paragraphs.map(paragraph => 
        `<p style="text-indent: 2em; margin-bottom: 1em; line-height: 1.8;">${paragraph.trim()}</p>`
    ).join('');
}

// 格式化链接内容
function formatLinkContent(content) {
    if (content && content.startsWith('http')) {
        return `<a href="${content}" target="_blank" class="text-blue-600 hover:text-blue-800 underline">${content}</a>`;
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
    
    // 使用map创建图片HTML，但需要转义单引号
    container.innerHTML = images.map((image, index) => {
        // 转义单引号，避免HTML解析错误
        const safeImage = image.replace(/'/g, "\\'");
        return `
        <div class="image-item bg-gray-100 rounded-lg overflow-hidden relative" data-id="${index}" draggable="${isLoggedIn ? 'true' : 'false'}" data-image="${safeImage}">
            <img src="${safeImage}" alt="论文图片" class="w-full h-auto cursor-pointer" onclick="openImageModal('${safeImage}')">
            <div class="image-overlay edit-btn ${isLoggedIn ? '' : 'hidden'} absolute bottom-2 right-2">
                <button onclick="deleteImage('${containerId}', ${index})" class="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-sm">
                    删除
                </button>
            </div>
        </div>
    `}).join('');
    
    // 如果已登录，为图片添加拖拽排序功能
    if (isLoggedIn) {
        addDragAndDropListeners(container, containerId);
    }
}

// 添加图片拖拽排序功能
function addDragAndDropListeners(container, containerId) {
    const items = container.querySelectorAll('[draggable="true"]');
    
    items.forEach(item => {
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
    return false;
}

async function handleDrop(e, containerId) {
    e.preventDefault();
    e.stopPropagation();
    
    if (draggedElement !== this) {
        const container = this.parentNode;
        const draggedIndex = parseInt(draggedElement.dataset.id);
        const targetIndex = parseInt(this.dataset.id);
        
        // 获取当前类型的所有图片
        const type = containerId === 'homepageImages' ? 'homepage' : 'key';
        const currentImages = await getAllImagesFromDB(currentPaperId, type);
        
        if (draggedIndex < 0 || draggedIndex >= currentImages.length || 
            targetIndex < 0 || targetIndex >= currentImages.length) {
            return;
        }
        
        // 重新排序数组
        const movedImage = currentImages.splice(draggedIndex, 1)[0];
        currentImages.splice(targetIndex, 0, movedImage);
        
        // 删除原有数据
        if (db) {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            // 使用游标删除当前类型的所有数据
            const deleteRequest = store.openCursor();
            
            deleteRequest.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const record = cursor.value;
                    if (record.paperId === currentPaperId && record.type === type) {
                        cursor.delete();
                    }
                    cursor.continue();
                } else {
                    // 删除完成后，保存重新排序的图片
                    saveReorderedImages(currentPaperId, type, currentImages);
                }
            };
        } else {
            // 如果没有IndexedDB，直接保存
            await saveReorderedImages(currentPaperId, type, currentImages);
        }
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

// 保存重新排序的图片
async function saveReorderedImages(paperId, type, images) {
    try {
        // 删除旧数据
        await deleteAllImagesByType(paperId, type);
        
        // 批量保存重新排序的图片
        for (let i = 0; i < images.length; i++) {
            await saveImageToDB(paperId, type, i, images[i]);
        }
        
        // 重新渲染图片
        if (type === 'homepage') {
            renderImages('homepageImages', images);
        } else {
            renderImages('keyImages', images);
        }
        
        updateUI();
        showNotification('图片顺序已更新', 'success');
    } catch (error) {
        console.error('保存排序失败:', error);
        showNotification('保存排序失败', 'error');
    }
}

// 打开图片模态框
function openImageModal(imageSrc) {
    // 重置缩放
    currentImageScale = 1;
    elements.modalImage.style.transform = 'scale(1)';
    elements.modalImage.style.maxWidth = '90vw';
    elements.modalImage.style.maxHeight = '90vh';
    
    // 设置图片源
    elements.modalImage.src = imageSrc;
    
    elements.imageModal.classList.add('show');
    
    // 显示缩放控制按钮
    if (elements.zoomInBtn) elements.zoomInBtn.classList.remove('hidden');
    if (elements.zoomOutBtn) elements.zoomOutBtn.classList.remove('hidden');
    if (elements.resetZoomBtn) elements.resetZoomBtn.classList.remove('hidden');
}

// 关闭图片模态框
function closeImageModal() {
    elements.imageModal.classList.remove('show');
    // 隐藏缩放控制按钮
    if (elements.zoomInBtn) elements.zoomInBtn.classList.add('hidden');
    if (elements.zoomOutBtn) elements.zoomOutBtn.classList.add('hidden');
    if (elements.resetZoomBtn) elements.resetZoomBtn.classList.add('hidden');
}

// 图片放大
function zoomInImage() {
    currentImageScale += 0.2;
    elements.modalImage.style.transform = `scale(${currentImageScale})`;
    elements.modalImage.style.transformOrigin = 'center center';
}

// 图片缩小
function zoomOutImage() {
    if (currentImageScale > 0.3) {
        currentImageScale -= 0.2;
        elements.modalImage.style.transform = `scale(${currentImageScale})`;
        elements.modalImage.style.transformOrigin = 'center center';
    }
}

// 重置图片缩放
function resetImageZoom() {
    currentImageScale = 1;
    elements.modalImage.style.transform = 'scale(1)';
    elements.modalImage.style.transformOrigin = 'center center';
}

// 删除图片
async function deleteImage(containerId, index) {
    showConfirmModal('确定要删除这张图片吗？', async () => {
        const type = containerId === 'homepageImages' ? 'homepage' : 'key';
        
        try {
            // 获取所有图片
            const allImages = await getAllImagesFromDB(currentPaperId, type);
            
            if (index < 0 || index >= allImages.length) {
                showNotification('删除失败：图片索引无效', 'error');
                return;
            }
            
            // 从数组中删除指定索引的图片
            allImages.splice(index, 1);
            
            // 重新索引并保存所有图片
            await reindexImages(currentPaperId, type);
            
            // 重新渲染图片
            const remainingImages = await getAllImagesFromDB(currentPaperId, type);
            renderImages(containerId, remainingImages);
            
            updateUI();
            showNotification('图片已删除', 'success');
        } catch (error) {
            console.error('删除图片失败:', error);
            showNotification('删除图片失败', 'error');
        }
    });
}

// 压缩图片
function compressImage(file, maxWidth = 1600, maxHeight = 1600, quality = 0.8) {
    return new Promise((resolve, reject) => {
        if (!file.type.match('image.*')) {
            reject(new Error('文件不是图片'));
            return;
        }
        
        // 如果文件小于1MB，直接返回（不压缩）
        if (file.size < 1024 * 1024) {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // 计算缩放比例
                if (width > maxWidth) {
                    height = Math.round(height * maxWidth / width);
                    width = maxWidth;
                }
                
                if (height > maxHeight) {
                    width = Math.round(width * maxHeight / height);
                    height = maxHeight;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                
                // 设置更高的图像质量
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                
                ctx.drawImage(img, 0, 0, width, height);
                
                // 获取压缩后的base64
                try {
                    // 根据文件类型选择格式
                    const format = file.type === 'image/png' ? 'png' : 'jpeg';
                    const compressedBase64 = canvas.toDataURL(`image/${format}`, quality);
                    resolve(compressedBase64);
                } catch (err) {
                    console.error('图片压缩失败:', err);
                    // 如果压缩失败，返回原始base64
                    resolve(e.target.result);
                }
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// 处理图片上传
async function handleImageUpload(event, type) {
    const files = Array.from(event.target.files);
    
    if (files.length === 0) return;
    
    showNotification('正在上传图片...', 'info');
    
    try {
        // 获取当前已有的图片数量
        const existingImages = await getAllImagesFromDB(currentPaperId, type);
        let currentIndex = existingImages.length;
        
        // 处理每个文件
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            // 压缩图片
            const compressedImage = await compressImage(file, 1600, 1600, 0.8);
            
            // 保存到数据库
            await saveImageToDB(currentPaperId, type, currentIndex, compressedImage);
            currentIndex++;
        }
        
        // 重新获取并渲染所有图片
        const allImages = await getAllImagesFromDB(currentPaperId, type);
        
        if (type === 'homepage') {
            renderImages('homepageImages', allImages);
        } else {
            renderImages('keyImages', allImages);
        }
        
        updateUI();
        showNotification(`成功上传 ${files.length} 张图片`, 'success');
        
        // 清空文件输入，允许再次上传相同文件
        event.target.value = '';
        
    } catch (error) {
        console.error('图片上传失败:', error);
        showNotification('图片上传失败: ' + error.message, 'error');
        event.target.value = '';
    }
}

// 编辑研究背景
function editBackgroundContent() {
    const paperDetails = DataManager.load('paperDetails', {});
    const currentPaperDetails = paperDetails[currentPaperId] || { backgroundContent: '暂无研究背景信息' };
    
    showEditModal('编辑研究背景', `
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">研究背景</label>
            <textarea id="backgroundContentText" rows="6" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">${currentPaperDetails.backgroundContent}</textarea>
        </div>
    `, () => {
        const paperDetails = DataManager.load('paperDetails', {});
        if (!paperDetails[currentPaperId]) {
            paperDetails[currentPaperId] = {
                backgroundContent: '暂无研究背景信息',
                mainContent: '暂无研究内容信息',
                conclusionContent: '暂无研究结论信息',
                linkContent: '暂无全文链接'
            };
        }
        
        paperDetails[currentPaperId].backgroundContent = document.getElementById('backgroundContentText').value;
        DataManager.save('paperDetails', paperDetails);
        
        // 使用innerHTML重新渲染，保留段落结构
        document.getElementById('backgroundContent').innerHTML = formatTextWithParagraphs(paperDetails[currentPaperId].backgroundContent);
        showNotification('研究背景已更新', 'success');
    });
}

// 编辑研究内容
function editMainContent() {
    const paperDetails = DataManager.load('paperDetails', {});
    const currentPaperDetails = paperDetails[currentPaperId] || { mainContent: '暂无研究内容信息' };
    
    showEditModal('编辑研究内容', `
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">研究内容</label>
            <textarea id="mainContentText" rows="8" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">${currentPaperDetails.mainContent}</textarea>
        </div>
    `, () => {
        const paperDetails = DataManager.load('paperDetails', {});
        if (!paperDetails[currentPaperId]) {
            paperDetails[currentPaperId] = {
                backgroundContent: '暂无研究背景信息',
                mainContent: '暂无研究内容信息',
                conclusionContent: '暂无研究结论信息',
                linkContent: '暂无全文链接'
            };
        }
        
        paperDetails[currentPaperId].mainContent = document.getElementById('mainContentText').value;
        DataManager.save('paperDetails', paperDetails);
        
        document.getElementById('mainContent').innerHTML = formatTextWithParagraphs(paperDetails[currentPaperId].mainContent);
        showNotification('研究内容已更新', 'success');
    });
}

// 编辑研究结论
function editConclusionContent() {
    const paperDetails = DataManager.load('paperDetails', {});
    const currentPaperDetails = paperDetails[currentPaperId] || { conclusionContent: '暂无研究结论信息' };
    
    showEditModal('编辑研究结论', `
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">研究结论</label>
            <textarea id="conclusionContentText" rows="6" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">${currentPaperDetails.conclusionContent}</textarea>
        </div>
    `, () => {
        const paperDetails = DataManager.load('paperDetails', {});
        if (!paperDetails[currentPaperId]) {
            paperDetails[currentPaperId] = {
                backgroundContent: '暂无研究背景信息',
                mainContent: '暂无研究内容信息',
                conclusionContent: '暂无研究结论信息',
                linkContent: '暂无全文链接'
            };
        }
        
        paperDetails[currentPaperId].conclusionContent = document.getElementById('conclusionContentText').value;
        DataManager.save('paperDetails', paperDetails);
        
        document.getElementById('conclusionContent').innerHTML = formatTextWithParagraphs(paperDetails[currentPaperId].conclusionContent);
        showNotification('研究结论已更新', 'success');
    });
}

// 编辑全文链接
function editLinkContent() {
    const paperDetails = DataManager.load('paperDetails', {});
    const currentPaperDetails = paperDetails[currentPaperId] || { linkContent: '暂无全文链接' };
    
    showEditModal('编辑全文链接', `
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">全文链接</label>
            <input type="text" id="linkContentText" value="${currentPaperDetails.linkContent}" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="请输入完整的URL链接">
    `, () => {
        const paperDetails = DataManager.load('paperDetails', {});
        if (!paperDetails[currentPaperId]) {
            paperDetails[currentPaperId] = {
                backgroundContent: '暂无研究背景信息',
                mainContent: '暂无研究内容信息',
                conclusionContent: '暂无研究结论信息',
                linkContent: '暂无全文链接'
            };
        }
        
        const linkValue = document.getElementById('linkContentText').value;
        paperDetails[currentPaperId].linkContent = linkValue;
        DataManager.save('paperDetails', paperDetails);
        
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
    const editBtns = document.querySelectorAll('.edit-btn');
    const addHomepageBtn = document.getElementById('addHomepageBtn');
    const addKeyBtn = document.getElementById('addKeyBtn');
    const homepageUpload = document.getElementById('homepageUpload');
    const keyUpload = document.getElementById('keyUpload');
    const homepageImagesContainer = document.getElementById('homepageImages');
    const keyImagesContainer = document.getElementById('keyImages');
    
    if (isLoggedIn) {
        elements.loginBtn.classList.add('hidden');
        elements.logoutBtn.classList.remove('hidden');
        editBtns.forEach(btn => btn.classList.remove('hidden'));
        
        // 显示添加图片按钮和上传区域
        if (addHomepageBtn) addHomepageBtn.classList.remove('hidden');
        if (addKeyBtn) addKeyBtn.classList.remove('hidden');
        if (homepageUpload) homepageUpload.classList.remove('hidden');
        if (keyUpload) keyUpload.classList.remove('hidden');
        
        // 更新图片的拖拽状态
        if (homepageImagesContainer) {
            const homepageItems = homepageImagesContainer.querySelectorAll('.image-item');
            homepageItems.forEach(item => item.setAttribute('draggable', 'true'));
            addDragAndDropListeners(homepageImagesContainer, 'homepageImages');
        }
        
        if (keyImagesContainer) {
            const keyItems = keyImagesContainer.querySelectorAll('.image-item');
            keyItems.forEach(item => item.setAttribute('draggable', 'true'));
            addDragAndDropListeners(keyImagesContainer, 'keyImages');
        }
    } else {
        elements.loginBtn.classList.remove('hidden');
        elements.logoutBtn.classList.add('hidden');
        editBtns.forEach(btn => btn.classList.add('hidden'));
        
        // 隐藏添加图片按钮和上传区域
        if (addHomepageBtn) addHomepageBtn.classList.add('hidden');
        if (addKeyBtn) addKeyBtn.classList.add('hidden');
        if (homepageUpload) homepageUpload.classList.add('hidden');
        if (keyUpload) keyUpload.classList.add('hidden');
        
        // 禁用图片的拖拽功能
        if (homepageImagesContainer) {
            const homepageItems = homepageImagesContainer.querySelectorAll('.image-item');
            homepageItems.forEach(item => item.setAttribute('draggable', 'false'));
        }
        
        if (keyImagesContainer) {
            const keyItems = keyImagesContainer.querySelectorAll('.image-item');
            keyItems.forEach(item => item.setAttribute('draggable', 'false'));
        }
    }
}

// 通知系统
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
                <button id="confirmBtn" class="flex-1 btn-danger text-white py-2 rounded-lg font-medium">
                    确认删除
                </button>
                <button id="cancelBtn" class="flex-1 bg-gray-500 text-white py-2 rounded-lg font-medium">
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
    
    // 点击背景关闭 - 修复：只有当鼠标按下和释放都在模态框背景上时才关闭
    confirmModal.addEventListener('mousedown', (e) => {
        mouseDownTarget = e.target;
    });
    
    confirmModal.addEventListener('mouseup', (e) => {
        mouseUpTarget = e.target;
        if (mouseDownTarget === confirmModal && mouseUpTarget === confirmModal) {
            confirmModal.remove();
        }
        mouseDownTarget = null;
        mouseUpTarget = null;
    });
}

// 触发图片上传
function triggerImageUpload(type) {
    if (type === 'homepage') {
        document.getElementById('homepageInput').click();
    } else if (type === 'key') {
        document.getElementById('keyInput').click();
    }
}

// 修复模态框bug：防止在输入框内选中文字并拖动到框外时关闭模态框
function setupModalBugFix() {
    // 为所有模态框添加mousedown和mouseup事件监听
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('mousedown', function(e) {
            mouseDownTarget = e.target;
        });
        
        modal.addEventListener('mouseup', function(e) {
            mouseUpTarget = e.target;
            // 只有当鼠标按下和释放都在模态框背景上时才关闭
            if (mouseDownTarget === this && mouseUpTarget === this) {
                this.classList.remove('show');
            }
            mouseDownTarget = null;
            mouseUpTarget = null;
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
    
    // 编辑相关 - 论文详情各字段
    document.getElementById('editBackgroundBtn').addEventListener('click', editBackgroundContent);
    document.getElementById('editMainContentBtn').addEventListener('click', editMainContent);
    document.getElementById('editConclusionBtn').addEventListener('click', editConclusionContent);
    document.getElementById('editLinkBtn').addEventListener('click', editLinkContent);
    
    document.getElementById('saveEdit').addEventListener('click', saveEditContent);
    document.getElementById('cancelEdit').addEventListener('click', hideEditModal);
    
    // 图片上传
    document.getElementById('homepageInput').addEventListener('change', (e) => handleImageUpload(e, 'homepage'));
    document.getElementById('keyInput').addEventListener('change', (e) => handleImageUpload(e, 'key'));
    
    // 添加图片按钮事件
    document.getElementById('addHomepageBtn').addEventListener('click', () => triggerImageUpload('homepage'));
    document.getElementById('addKeyBtn').addEventListener('click', () => triggerImageUpload('key'));
    
    // 图片缩放控制按钮事件
    if (elements.zoomInBtn) {
        elements.zoomInBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            zoomInImage();
        });
    }
    
    if (elements.zoomOutBtn) {
        elements.zoomOutBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            zoomOutImage();
        });
    }
    
    if (elements.resetZoomBtn) {
        elements.resetZoomBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            resetImageZoom();
        });
    }
    
    // 图片模态框关闭事件
    elements.imageModal.addEventListener('mousedown', (e) => {
        mouseDownTarget = e.target;
    });
    
    elements.imageModal.addEventListener('mouseup', (e) => {
        mouseUpTarget = e.target;
        // 修改：点击模态框任意位置（包括图片）都可以关闭
        // 但点击缩放按钮时不关闭（已通过stopPropagation阻止事件冒泡）
        if (mouseDownTarget === elements.imageModal && mouseUpTarget === elements.imageModal) {
            closeImageModal();
        } else if (mouseDownTarget === elements.modalImage && mouseUpTarget === elements.modalImage) {
            // 点击图片本身也可以关闭
            closeImageModal();
        }
        mouseDownTarget = null;
        mouseUpTarget = null;
    });
    
    // 修改：添加键盘快捷键支持
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (elements.imageModal.classList.contains('show')) {
                closeImageModal();
            } else if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            } else {
                document.querySelectorAll('.modal.show').forEach(modal => {
                    modal.classList.remove('show');
                });
            }
        }
        
        // 图片缩放快捷键
        if (elements.imageModal.classList.contains('show')) {
            if (e.key === '+') {
                zoomInImage();
            } else if (e.key === '-') {
                zoomOutImage();
            } else if (e.key === '0') {
                resetImageZoom();
            }
        }
    });
});

// 导出函数到全局作用域
window.openImageModal = openImageModal;
window.closeImageModal = closeImageModal;
window.deleteImage = deleteImage;
window.triggerImageUpload = triggerImageUpload;
window.zoomInImage = zoomInImage;
window.zoomOutImage = zoomOutImage;
window.resetImageZoom = resetImageZoom;