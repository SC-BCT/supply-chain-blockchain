// main.js - 基于原始代码修复版
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
        try {
            await initIndexedDB();
        } catch (error) {
            console.log('IndexedDB初始化失败，将使用localStorage:', error);
            return {};
        }
    }
    
    return new Promise((resolve) => {
        const transaction = db.transaction(['paperDetails'], 'readonly');
        const objectStore = transaction.objectStore('paperDetails');
        const request = objectStore.getAll();
        
        request.onsuccess = function(event) {
            const allPaperDetails = {};
            event.target.result.forEach(item => {
                if (item && item.paperId) {
                    allPaperDetails[item.paperId] = {
                        backgroundContent: item.backgroundContent || '请添加研究背景信息',
                        mainContent: item.mainContent || '请添加研究内容信息',
                        conclusionContent: item.conclusionContent || '请添加研究结论信息',
                        linkContent: item.linkContent || '暂无全文链接',
                        homepageImages: item.homepageImages || [],
                        keyImages: item.keyImages || []
                    };
                }
            });
            console.log('从IndexedDB获取到的论文详情:', Object.keys(allPaperDetails).length, '篇');
            resolve(allPaperDetails);
        };
        
        request.onerror = function(event) {
            console.error('从IndexedDB获取数据失败:', event.target.error);
            resolve({});
        };
    });
}

// 从localStorage获取论文详情数据
function getPaperDetailsFromLocalStorage() {
    const paperDetails = DataManager.load('paperDetails', {});
    const result = {};
    
    for (const paperId in paperDetails) {
        const detail = paperDetails[paperId];
        if (detail) {
            result[paperId] = {
                backgroundContent: detail.backgroundContent || '请添加研究背景信息',
                mainContent: detail.mainContent || '请添加研究内容信息',
                conclusionContent: detail.conclusionContent || '请添加研究结论信息',
                linkContent: detail.linkContent || '暂无全文链接',
                homepageImages: detail.homepageImages || [],
                keyImages: detail.keyImages || []
            };
        }
    }
    
    console.log('从localStorage获取到的论文详情:', Object.keys(result).length, '篇');
    return result;
}

// 获取所有论文详情数据
async function getAllPaperDetails() {
    console.log('开始获取所有论文详情数据...');
    
    // 从IndexedDB获取
    let indexedDBData = {};
    try {
        indexedDBData = await getAllPaperDetailsFromIndexedDB();
    } catch (error) {
        console.log('从IndexedDB获取数据失败:', error);
    }
    
    // 从localStorage获取
    const localStorageData = getPaperDetailsFromLocalStorage();
    
    // 合并数据：IndexedDB优先
    const mergedData = { ...localStorageData, ...indexedDBData };
    
    console.log('合并后的论文详情数据:', Object.keys(mergedData).length, '篇');
    return mergedData;
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
            showNotification('没有找到论文详情数据，请先在论文详情页添加数据', 'warning');
            return;
        }
        
        // 导出数据格式：{ "1": {...}, "2": {...} }
        const exportData = {};
        let totalImages = 0;
        
        for (const paperId in paperDetails) {
            const detail = paperDetails[paperId];
            exportData[paperId] = detail;
            
            totalImages += (detail.homepageImages ? detail.homepageImages.length : 0);
            totalImages += (detail.keyImages ? detail.keyImages.length : 0);
        }
        
        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'paperDetails.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification(`论文详情数据已导出，包含 ${Object.keys(paperDetails).length} 篇论文的数据和 ${totalImages} 张图片`, 'success');
    } catch (error) {
        console.error('导出论文详情数据失败:', error);
        showNotification('导出失败: ' + error.message, 'error');
    }
}

// 一键导出所有数据
async function exportAllData() {
    try {
        showNotification('正在准备导出所有数据...', 'info');
        
        // 导出首页数据
        exportMainData();
        
        // 稍等片刻后导出论文详情数据
        setTimeout(async () => {
            await exportPaperDetailsData();
            showNotification('所有数据导出完成！', 'success');
        }, 500);
        
    } catch (error) {
        console.error('导出所有数据失败:', error);
        showNotification('导出失败: ' + error.message, 'error');
    }
}

// ... [其余main.js代码保持不变，保持你原来的渲染、编辑、拖拽等功能] ...
// 由于代码过长，这里只显示关键修改部分，其余代码保持你原来的逻辑
