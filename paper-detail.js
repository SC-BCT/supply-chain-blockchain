// 论文详情页面 - 完整修改版
// 全局变量
let isLoggedIn = false;
let currentEditData = null;
let currentPaperId = null;
let paperDetailsData = null;

// DOM元素
const elements = {
    loginBtn: document.getElementById('loginBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    loginModal: document.getElementById('loginModal'),
    loginForm: document.getElementById('loginForm'),
    editModal: document.getElementById('editModal'),
    imageModal: document.getElementById('imageModal'),
    modalImage: document.getElementById('modalImage')
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

// 页面初始化
async function initializePage() {
    // 检查登录状态
    isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
    
    // 获取URL参数中的论文ID
    const urlParams = new URLSearchParams(window.location.search);
    currentPaperId = parseInt(urlParams.get('id')) || 1;
    
    try {
        // 加载论文数据
        await loadPaperData();
        
        // 加载论文详情数据
        await loadPaperDetails();
        
        // 加载图片
        await loadImages();
        
        // 更新UI
        updateUI();
        
    } catch (error) {
        console.error('初始化失败:', error);
        // 设置默认值，避免页面空白
        setDefaultContent();
    }
    
    // 添加动画
    if (window.anime) {
        anime({
            targets: '.fade-in',
            opacity: [0, 1],
            translateY: [30, 0],
            duration: 800,
            delay: anime.stagger(200),
            easing: 'easeOutQuad'
        });
    }
}

// 设置默认内容
function setDefaultContent() {
    document.getElementById('paperTitle').textContent = '论文标题';
    document.getElementById('paperJournal').textContent = '未知期刊';
    document.getElementById('paperTime').textContent = '未知时间';
    document.getElementById('paperAuthors').textContent = '未知作者';
    
    const defaultText = '<p class="text-para">暂无内容，请先登录编辑或检查数据文件</p>';
    document.getElementById('backgroundContent').innerHTML = defaultText;
    document.getElementById('mainContent').innerHTML = defaultText;
    document.getElementById('conclusionContent').innerHTML = defaultText;
    document.getElementById('linkContent').innerHTML = '暂无全文链接';
    
    renderImages('homepageImages', []);
    renderImages('keyImages', []);
}

// 加载论文数据
async function loadPaperData() {
    try {
        // 先尝试从localStorage加载
        const projectData = DataManager.load('projectData');
        if (projectData && projectData.papers) {
            const paper = projectData.papers.find(p => p.id === currentPaperId);
            if (paper) {
                // 渲染论文基本信息
                document.getElementById('paperTitle').textContent = paper.title;
                document.getElementById('paperJournal').textContent = paper.journal || '';
                document.getElementById('paperTime').textContent = paper.time || '';
                document.getElementById('paperAuthors').textContent = paper.authors || '';
                return;
            }
        }
        
        // 如果localStorage没有，尝试从data.json加载
        const response = await fetch('data.json');
        if (response.ok) {
            const jsonData = await response.json();
            const paper = jsonData.papers.find(p => p.id === currentPaperId);
            if (paper) {
                document.getElementById('paperTitle').textContent = paper.title;
                document.getElementById('paperJournal').textContent = paper.journal || '';
                document.getElementById('paperTime').textContent = paper.time || '';
                document.getElementById('paperAuthors').textContent = paper.authors || '';
            }
        }
    } catch (error) {
        console.warn('加载论文数据失败:', error);
    }
}

// 加载论文详情数据
async function loadPaperDetails() {
    try {
        // 先尝试从localStorage加载
        paperDetailsData = DataManager.load('paperDetails', {});
        
        // 如果localStorage没有数据，尝试从paperDetails.json加载
        if (!paperDetailsData || Object.keys(paperDetailsData).length === 0) {
            try {
                const response = await fetch('paperDetails.json');
                if (response.ok) {
                    paperDetailsData = await response.json();
                } else {
                    // 创建默认结构
                    paperDetailsData = {};
                }
            } catch (error) {
                console.log('未找到paperDetails.json文件，将创建默认结构');
                paperDetailsData = {};
            }
        }
        
        const currentPaperDetails = paperDetailsData[currentPaperId] || {
            backgroundContent: '暂无研究背景信息',
            mainContent: '暂无主要内容信息',
            conclusionContent: '暂无主要结论信息',
            linkContent: '暂无全文链接',
            homepageImages: [],
            keyImages: []
        };
        
        // 渲染文本内容
        document.getElementById('backgroundContent').innerHTML = formatTextWithIndent(currentPaperDetails.backgroundContent);
        document.getElementById('mainContent').innerHTML = formatTextWithIndent(currentPaperDetails.mainContent);
        document.getElementById('conclusionContent').innerHTML = formatTextWithIndent(currentPaperDetails.conclusionContent);
        document.getElementById('linkContent').innerHTML = formatLinkContent(currentPaperDetails.linkContent);
        
    } catch (error) {
        console.error('加载论文详情失败:', error);
        // 设置默认值
        const defaultText = '<p class="text-para">暂无内容</p>';
        document.getElementById('backgroundContent').innerHTML = defaultText;
        document.getElementById('mainContent').innerHTML = defaultText;
        document.getElementById('conclusionContent').innerHTML = defaultText;
        document.getElementById('linkContent').innerHTML = '暂无全文链接';
    }
}

// 加载图片
async function loadImages() {
    try {
        // 从paperDetails.json中加载图片
        const currentPaperDetails = paperDetailsData[currentPaperId] || {};
        const homepageImages = currentPaperDetails.homepageImages || [];
        const keyImages = currentPaperDetails.keyImages || [];
        
        // 如果paperDetails.json中没有图片数据，尝试从images文件夹加载
        if (homepageImages.length === 0 || keyImages.length === 0) {
            // 尝试从images文件夹动态加载
            const [homepageImgs, keyImgs] = await Promise.all([
                loadImagesFromFolder(`images/papers/${currentPaperId}/homepage/`),
                loadImagesFromFolder(`images/papers/${currentPaperId}/key/`)
            ]);
            
            // 如果从文件夹加载到图片，就使用这些图片
            if (homepageImgs.length > 0) {
                homepageImages.push(...homepageImgs);
            }
            
            if (keyImgs.length > 0) {
                keyImages.push(...keyImgs);
            }
        }
        
        // 渲染图片
        renderImages('homepageImages', homepageImages);
        renderImages('keyImages', keyImages);
        
    } catch (error) {
        console.error('加载图片失败:', error);
        renderImages('homepageImages', []);
        renderImages('keyImages', []);
    }
}

// 从文件夹加载图片
async function loadImagesFromFolder(folderPath) {
    const images = [];
    
    try {
        // 尝试加载预定义的图片列表
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        
        // 尝试加载常见命名的图片
        for (let i = 1; i <= 10; i++) {
            for (const ext of imageExtensions) {
                const imageName = `${i}${ext}`;
                const imagePath = `${folderPath}${imageName}`;
                
                // 检查图片是否存在
                if (await checkImageExists(imagePath)) {
                    images.push(imagePath);
                    break; // 找到一张图片后跳出内层循环
                }
            }
        }
        
        // 如果没有找到数字命名的图片，尝试其他命名方式
        if (images.length === 0) {
            const otherNames = ['homepage', 'cover', 'front', 'key', 'figure', 'chart'];
            for (const name of otherNames) {
                for (const ext of imageExtensions) {
                    const imageName = `${name}${ext}`;
                    const imagePath = `${folderPath}${imageName}`;
                    
                    if (await checkImageExists(imagePath)) {
                        images.push(imagePath);
                        break;
                    }
                }
            }
        }
        
    } catch (error) {
        console.warn(`加载文件夹 ${folderPath} 失败:`, error);
    }
    
    return images;
}

// 检查图片是否存在
function checkImageExists(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
        
        // 设置超时
        setTimeout(() => resolve(false), 1000);
    });
}

// 格式化文本，添加首行缩进和换行
function formatTextWithIndent(text) {
    if (!text || text.trim() === '') {
        return '<p class="text-para">暂无内容</p>';
    }
    
    // 将文本按换行符分割成段落
    const paragraphs = text.split('\n').filter(p => p.trim() !== '');
    
    if (paragraphs.length === 0) {
        return '<p class="text-para">暂无内容</p>';
    }
    
    const formattedParagraphs = paragraphs.map(paragraph => {
        return `<p class="text-para">${paragraph}</p>`;
    });
    
    return formattedParagraphs.join('');
}

// 格式化链接内容
function formatLinkContent(content) {
    if (content && content.startsWith('http')) {
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
    
    // 过滤掉无效的图片
    const validImages = images.filter(img => img && img.trim() !== '');
    
    if (validImages.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-8">暂无图片</p>';
        return;
    }
    
    container.innerHTML = validImages.map((image, index) => {
        // 确保图片路径正确
        let imageSrc = image;
        // 如果图片路径不是完整URL，且不包含images/前缀，添加前缀
        if (!imageSrc.startsWith('http') && !imageSrc.startsWith('data:') && !imageSrc.startsWith('images/')) {
            imageSrc = imageSrc.startsWith('/') ? imageSrc.substring(1) : imageSrc;
            if (!imageSrc.startsWith('images/')) {
                imageSrc = 'images/' + imageSrc;
            }
        }
        
        // 为图片路径添加缓存避免时间戳，避免浏览器缓存问题
        const cacheBuster = `?t=${new Date().getTime()}`;
        
        return `
            <div class="image-item bg-gray-100 rounded-lg overflow-hidden mb-4" data-image="${imageSrc}">
                <img src="${imageSrc}${cacheBuster}" alt="论文图片" 
                     class="w-full h-auto cursor-pointer object-contain max-h-64"
                     onclick="openImageModal('${imageSrc.replace(/'/g, "\\'")}')"
                     onerror="this.onerror=null; this.style.display='none'; this.parentElement.innerHTML='<div class=\\'p-4 text-center text-red-500\\'>图片加载失败: ${imageSrc.split('/').pop()}</div>'">
                ${isLoggedIn ? `
                <div class="image-overlay">
                    <button onclick="deleteImage('${containerId}', ${index})" class="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-sm">
                        删除
                    </button>
                </div>
                ` : ''}
            </div>
        `;
    }).join('');
    
    // 如果登录状态改变，需要更新图片的覆盖层
    updateImageOverlays();
}

// 更新图片覆盖层显示状态
function updateImageOverlays() {
    const overlays = document.querySelectorAll('.image-overlay');
    overlays.forEach(overlay => {
        overlay.classList.toggle('hidden', !isLoggedIn);
    });
}

// 打开图片模态框
function openImageModal(imageSrc) {
    if (elements.modalImage) {
        elements.modalImage.src = imageSrc;
        if (elements.imageModal) {
            elements.imageModal.classList.add('show');
        }
    }
}

// 关闭图片模态框
function closeImageModal() {
    if (elements.imageModal) {
        elements.imageModal.classList.remove('show');
    }
}

// 删除图片
function deleteImage(containerId, index) {
    showConfirmModal('确定要删除这张图片吗？', () => {
        // 从paperDetailsData中删除
        if (paperDetailsData[currentPaperId]) {
            let imageArray;
            if (containerId === 'homepageImages') {
                imageArray = paperDetailsData[currentPaperId].homepageImages;
            } else if (containerId === 'keyImages') {
                imageArray = paperDetailsData[currentPaperId].keyImages;
            }
            
            if (imageArray && imageArray.length > index) {
                imageArray.splice(index, 1);
                
                // 保存到localStorage
                DataManager.save('paperDetails', paperDetailsData);
            }
        }
        
        // 重新加载图片
        loadImages();
        showNotification('图片已删除', 'success');
    });
}

// 编辑研究背景
function editBackgroundContent() {
    const currentPaperDetails = paperDetailsData[currentPaperId] || { backgroundContent: '暂无研究背景信息' };
    
    showEditModal('编辑研究背景', `
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">研究背景</label>
            <textarea id="backgroundContentText" rows="6" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">${currentPaperDetails.backgroundContent}</textarea>
            <p class="text-sm text-gray-500 mt-2">提示：每段文字会自动首行缩进，换行会被保留</p>
        </div>
    `, () => {
        if (!paperDetailsData[currentPaperId]) {
            paperDetailsData[currentPaperId] = {
                backgroundContent: '暂无研究背景信息',
                mainContent: '暂无主要内容信息',
                conclusionContent: '暂无主要结论信息',
                linkContent: '暂无全文链接',
                homepageImages: [],
                keyImages: []
            };
        }
        
        paperDetailsData[currentPaperId].backgroundContent = document.getElementById('backgroundContentText').value;
        DataManager.save('paperDetails', paperDetailsData);
        
        // 重新加载页面以应用格式
        loadPaperDetails();
        showNotification('研究背景已更新', 'success');
    });
}

// 编辑主要内容
function editMainContent() {
    const currentPaperDetails = paperDetailsData[currentPaperId] || { mainContent: '暂无主要内容信息' };
    
    showEditModal('编辑主要内容', `
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">主要内容</label>
            <textarea id="mainContentText" rows="8" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">${currentPaperDetails.mainContent}</textarea>
            <p class="text-sm text-gray-500 mt-2">提示：每段文字会自动首行缩进，换行会被保留</p>
        </div>
    `, () => {
        if (!paperDetailsData[currentPaperId]) {
            paperDetailsData[currentPaperId] = {
                backgroundContent: '暂无研究背景信息',
                mainContent: '暂无主要内容信息',
                conclusionContent: '暂无主要结论信息',
                linkContent: '暂无全文链接',
                homepageImages: [],
                keyImages: []
            };
        }
        
        paperDetailsData[currentPaperId].mainContent = document.getElementById('mainContentText').value;
        DataManager.save('paperDetails', paperDetailsData);
        
        // 重新加载页面以应用格式
        loadPaperDetails();
        showNotification('主要内容已更新', 'success');
    });
}

// 编辑主要结论
function editConclusionContent() {
    const currentPaperDetails = paperDetailsData[currentPaperId] || { conclusionContent: '暂无主要结论信息' };
    
    showEditModal('编辑主要结论', `
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">主要结论</label>
            <textarea id="conclusionContentText" rows="6" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">${currentPaperDetails.conclusionContent}</textarea>
            <p class="text-sm text-gray-500 mt-2">提示：每段文字会自动首行缩进，换行会被保留</p>
        </div>
    `, () => {
        if (!paperDetailsData[currentPaperId]) {
            paperDetailsData[currentPaperId] = {
                backgroundContent: '暂无研究背景信息',
                mainContent: '暂无主要内容信息',
                conclusionContent: '暂无主要结论信息',
                linkContent: '暂无全文链接',
                homepageImages: [],
                keyImages: []
            };
        }
        
        paperDetailsData[currentPaperId].conclusionContent = document.getElementById('conclusionContentText').value;
        DataManager.save('paperDetails', paperDetailsData);
        
        // 重新加载页面以应用格式
        loadPaperDetails();
        showNotification('主要结论已更新', 'success');
    });
}

// 编辑全文链接
function editLinkContent() {
    const currentPaperDetails = paperDetailsData[currentPaperId] || { linkContent: '暂无全文链接' };
    
    showEditModal('编辑全文链接', `
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">全文链接（URL）</label>
            <input type="text" id="linkContentText" value="${currentPaperDetails.linkContent}" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="请输入完整的URL链接">
            <p class="text-sm text-gray-500 mt-1">请输入完整的URL，例如：https://example.com/paper.pdf</p>
        </div>
    `, () => {
        if (!paperDetailsData[currentPaperId]) {
            paperDetailsData[currentPaperId] = {
                backgroundContent: '暂无研究背景信息',
                mainContent: '暂无主要内容信息',
                conclusionContent: '暂无主要结论信息',
                linkContent: '暂无全文链接',
                homepageImages: [],
                keyImages: []
            };
        }
        
        const linkValue = document.getElementById('linkContentText').value;
        paperDetailsData[currentPaperId].linkContent = linkValue;
        DataManager.save('paperDetails', paperDetailsData);
        
        document.getElementById('linkContent').innerHTML = formatLinkContent(linkValue);
        showNotification('全文链接已更新', 'success');
    });
}

// 登录功能
function showLoginModal() {
    if (elements.loginModal) {
        elements.loginModal.classList.add('show');
        const usernameInput = document.getElementById('username');
        if (usernameInput) {
            usernameInput.focus();
        }
    }
}

function hideLoginModal() {
    if (elements.loginModal) {
        elements.loginModal.classList.remove('show');
        if (elements.loginForm) {
            elements.loginForm.reset();
        }
    }
}

function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    
    // 使用与主页面相同的登录凭证
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
    
    if (isLoggedIn) {
        if (elements.loginBtn) elements.loginBtn.classList.add('hidden');
        if (elements.logoutBtn) elements.logoutBtn.classList.remove('hidden');
        editBtns.forEach(btn => btn.classList.remove('hidden'));
        updateImageOverlays();
    } else {
        if (elements.loginBtn) elements.loginBtn.classList.remove('hidden');
        if (elements.logoutBtn) elements.logoutBtn.classList.add('hidden');
        editBtns.forEach(btn => btn.classList.add('hidden'));
        updateImageOverlays();
    }
}

// 通知系统
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-20 right-4 z-50 p-4 rounded-lg shadow-lg text-white max-w-sm ${type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    if (window.anime) {
        anime({
            targets: notification,
            translateX: [300, 0],
            opacity: [0, 1],
            duration: 300,
            easing: 'easeOutQuad'
        });
    }
    
    setTimeout(() => {
        if (window.anime) {
            anime({
                targets: notification,
                translateX: [0, 300],
                opacity: [1, 0],
                duration: 300,
                easing: 'easeInQuad',
                complete: () => notification.remove()
            });
        } else {
            notification.remove();
        }
    }, 3000);
}

// 显示编辑模态框
function showEditModal(title, content, saveCallback) {
    const titleElement = document.getElementById('editModalTitle');
    const contentElement = document.getElementById('editModalContent');
    
    if (titleElement) titleElement.textContent = title;
    if (contentElement) contentElement.innerHTML = content;
    
    if (elements.editModal) {
        elements.editModal.classList.add('show');
    }
    
    currentEditData = { saveCallback };
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
    
    // 点击背景关闭
    confirmModal.addEventListener('click', (e) => {
        if (e.target === confirmModal) {
            confirmModal.remove();
        }
    });
}

// 页面初始化
document.addEventListener('DOMContentLoaded', function() {
    // 启动页面
    initializePage();
    
    // 登录相关
    if (elements.loginBtn) {
        elements.loginBtn.addEventListener('click', showLoginModal);
    }
    if (elements.logoutBtn) {
        elements.logoutBtn.addEventListener('click', logout);
    }
    if (elements.loginForm) {
        elements.loginForm.addEventListener('submit', handleLogin);
    }
    
    const cancelLoginBtn = document.getElementById('cancelLogin');
    if (cancelLoginBtn) {
        cancelLoginBtn.addEventListener('click', hideLoginModal);
    }
    
    // 编辑相关 - 论文详情各字段
    const editBackgroundBtn = document.getElementById('editBackgroundBtn');
    if (editBackgroundBtn) {
        editBackgroundBtn.addEventListener('click', editBackgroundContent);
    }
    
    const editMainContentBtn = document.getElementById('editMainContentBtn');
    if (editMainContentBtn) {
        editMainContentBtn.addEventListener('click', editMainContent);
    }
    
    const editConclusionBtn = document.getElementById('editConclusionBtn');
    if (editConclusionBtn) {
        editConclusionBtn.addEventListener('click', editConclusionContent);
    }
    
    const editLinkBtn = document.getElementById('editLinkBtn');
    if (editLinkBtn) {
        editLinkBtn.addEventListener('click', editLinkContent);
    }
    
    const saveEditBtn = document.getElementById('saveEdit');
    if (saveEditBtn) {
        saveEditBtn.addEventListener('click', saveEditContent);
    }
    
    const cancelEditBtn = document.getElementById('cancelEdit');
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', hideEditModal);
    }
    
    // 图片模态框
    if (elements.imageModal) {
        elements.imageModal.addEventListener('click', closeImageModal);
    }
    
    // 修复模态框关闭问题
    document.addEventListener('click', function(e) {
        // 点击模态框背景才关闭
        if (e.target.classList.contains('modal') && e.target.id !== 'editModal') {
            e.target.classList.remove('show');
        }
    });
    
    // 特别处理编辑模态框，防止在输入框内点击时关闭
    if (elements.editModal) {
        elements.editModal.addEventListener('click', function(e) {
            // 只有点击模态框背景（不是内容区域）才关闭
            if (e.target === this) {
                hideEditModal();
            }
        });
    }
    
    // ESC键关闭模态框
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            document.querySelectorAll('.modal.show, .image-modal.show').forEach(modal => {
                modal.classList.remove('show');
            });
        }
    });
});