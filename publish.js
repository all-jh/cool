// Instagram API 配置
const igTokenPublish = 'IGQWRPa09TSkxyQlFkZAWRtM1BuYUxGUXk0XzEwSEJCQXRmTF9CNDRDMVB1dW1haDlOWWh3SE1uUkFCSGhkUWFneEdhMUxlYUdoSG9nNTlrck0tdHdpdWZAUUEdVSEtrTlZA5Vm9PeGJZAM2c0ZAmJEU1BrMFdwOWFKR2cZD';

// Instagram API 請求函數
async function sendIGRequestPublish(endpoint, params) {
    try {
        // 首先獲取用戶 ID
        const userResponse = await fetch(
            `https://graph.instagram.com/me?fields=id,username&access_token=${igTokenPublish}`
        );
        
        if (!userResponse.ok) {
            const errorData = await userResponse.json();
            throw new Error(`獲取用戶信息失敗: ${JSON.stringify(errorData)}`);
        }

        const userData = await userResponse.json();
        console.log('Instagram 用戶信息:', userData);
    
        // 構建 API 請求 URL
        const url = new URL(`https://graph.instagram.com/${userData.id}/${endpoint}`);
        url.searchParams.append('access_token', igTokenPublish);

        // 特殊處理輪播貼文
        if (endpoint === 'media' && params.media_type === 'CAROUSEL') {
            // 首先為每個子媒體創建 container
            const childrenContainers = await Promise.all(params.children.map(async child => {
                const childResponse = await fetch(`${url.toString()}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        media_type: 'IMAGE',
                        image_url: child.image_url
                    })
                });

                if (!childResponse.ok) {
                    const errorData = await childResponse.json();
                    throw new Error(`創子媒體失敗: ${JSON.stringify(errorData)}`);
                }

                const childData = await childResponse.json();
                return childData.id;
            }));

            // 創建輪播貼文
            const formData = new FormData();
            formData.append('access_token', igTokenPublish);
            formData.append('media_type', 'CAROUSEL');
            formData.append('caption', params.caption);
            formData.append('children', JSON.stringify(childrenContainers));

            console.log('發送輪播貼文資料:', {
                media_type: 'CAROUSEL',
                caption: params.caption,
                children: childrenContainers
            });

            const response = await fetch(url.toString(), {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(`API 請求失敗: ${JSON.stringify(data)}`);
            }
            return data;
        }

        // 一般請求處理
        console.log('發送請求到:', url.toString(), params);
        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(params)
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(`API 請求失敗: ${JSON.stringify(data)}`);
        }

        console.log('API 響應:', data);
        return data;

    } catch (error) {
        console.error('API 請求錯誤:', error);
        throw error;
    }
}

// 修改配置對象，添加時間閾值常量
const publishConfig = {
    defaultMinPosts: 3,
    currentMinPosts: 3,
    requestCount: 0,
    lastRequestTime: null,
    resetTimeout: null,
    isPublishing: false,
    // 添加時間閾值常量
    TIME_THRESHOLDS: {
        RESET: 2 * 60 * 60 * 1000,    // 2小時
        MEDIUM: 20 * 60 * 1000,       // 20分鐘
        SHORT: 10 * 60 * 1000         // 10分鐘
    },
    // 添加請求次數閾值
    REQUEST_THRESHOLDS: {
        MEDIUM: 5,  // 20分鐘內5次
        SHORT: 3    // 10分鐘內3次
    }
};

// 優化請求計數器管理函數
function updateRequestCount() {
    const now = Date.now();
    const timeSinceLastRequest = publishConfig.lastRequestTime ? 
        now - publishConfig.lastRequestTime : 
        Infinity;
    
    // 如果超過重置時間，重置所有計數
    if (timeSinceLastRequest > publishConfig.TIME_THRESHOLDS.RESET) {
        publishConfig.requestCount = 1;
        publishConfig.currentMinPosts = publishConfig.defaultMinPosts;
    } else {
        publishConfig.requestCount++;
        
        // 根據時間區間和請求次數調整最小發布數量
        if (timeSinceLastRequest <= publishConfig.TIME_THRESHOLDS.SHORT && 
            publishConfig.requestCount >= publishConfig.REQUEST_THRESHOLDS.SHORT) {
            publishConfig.currentMinPosts = 5;
        } else if (timeSinceLastRequest <= publishConfig.TIME_THRESHOLDS.MEDIUM && 
                   publishConfig.requestCount >= publishConfig.REQUEST_THRESHOLDS.MEDIUM) {
            publishConfig.currentMinPosts = 8;
        }
    }
    
    publishConfig.lastRequestTime = now;
    
    // 設置重置定時器
    clearTimeout(publishConfig.resetTimeout);
    publishConfig.resetTimeout = setTimeout(() => {
        publishConfig.currentMinPosts = publishConfig.defaultMinPosts;
        publishConfig.requestCount = 0;
        publishConfig.lastRequestTime = null;
    }, publishConfig.TIME_THRESHOLDS.RESET);
    
    console.log(`當前最小發布數量: ${publishConfig.currentMinPosts}, 請求次數: ${publishConfig.requestCount}`);
}

// 修改 batchPublishToIG 函數中的相關判斷
async function batchPublishToIG() {
    try {
        // 更新請求計數
        updateRequestCount();
        
        const approvedPosts = document.querySelectorAll('#approvedPostsContainer .post-card');
        const unpublishedPosts = Array.from(approvedPosts).filter(post => 
            post.querySelector('.post-status').textContent === '未發布'
        );

        console.log('找到未發布的貼文數量:', unpublishedPosts.length);

        if (unpublishedPosts.length === 0) {
            console.log('沒有未發布的貼文');
            return;
        }

        // 使用動態最小發布數量
        if (unpublishedPosts.length < publishConfig.currentMinPosts) {
            console.log(`目前只有 ${unpublishedPosts.length} 則未發布貼文，需要累積到 ${publishConfig.currentMinPosts} 則才會發布`);
            return;
        }

        // 顯示處理中的遮罩
        const overlay = document.querySelector('.processing-overlay');
        overlay.style.display = 'flex';
        const progressBar = overlay.querySelector('.progress-bar');
        const progressText = overlay.querySelector('.progress-text');
        const statusText = overlay.querySelector('.status-text');

        // 處理每一組貼文（每10個一組）
        for (let i = 0; i < unpublishedPosts.length; i += 10) {
            const group = unpublishedPosts.slice(i, i + 10);
            try {
                statusText.textContent = `正在處理第 ${Math.floor(i/10) + 1} 組貼文`;

                // 為每個貼文生成圖片
                const mediaResults = await Promise.all(group.map(async (post) => {
                    const postContent = post.querySelector('.post-content').textContent;
                    const isReply = post.querySelector('.post-content').getAttribute('data-is-reply') === 'true';
                    const postId = post.getAttribute('data-post-id');
                    
                    let results = [];

                    // 處理附帶的圖片和媒體
                    const postData = isReply ? 
                        (await db.collection('postsrea').doc(postId).get()).data() :
                        (await db.collection('posts').doc(postId).get()).data();

                    // 修改媒體處理邏輯
                    if (postData.mediaUrls && postData.mediaUrls.length > 0) {
                        for (const media of postData.mediaUrls) {
                            if (media.type === 'image' || media.type === 'gif') {
                                // 下載原始圖片並重新上傳，確保唯一性
                                try {
                                    const response = await fetch(media.url);
                                    const blob = await response.blob();
                                    const uniqueFileName = `ig_media_${Date.now()}_${Math.random().toString(36).substring(7)}_${postId}.jpg`;
                                    const mediaStorageRef = firebase.storage().ref(`instagram_posts/${uniqueFileName}`);
                                    await mediaStorageRef.put(blob);
                                    const newMediaUrl = await mediaStorageRef.getDownloadURL();

                                    results.push({
                                        image_url: newMediaUrl,
                                        postId: postId,
                                        isReply: isReply,
                                        originalUrl: media.url // 保存原始URL以便追踪
                                    });
                                } catch (error) {
                                    console.error('處理媒體文件時發生錯誤:', error);
                                    // 如果處理失敗，跳過這個媒體文件
                                    continue;
                                }
                            }
                        }
                    }

                    // 生成文字圖片
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = 800;
                    canvas.height = 600;
                    
                    // 套上背景圖
                    const background = new Image();
                    background.src = '乾淨天中.png';
                    await new Promise(resolve => {
                        background.onload = () => {
                            ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
                            resolve();
                        };
                    });

                    // 設置文字樣式
                    let fontSize = postContent.length < 20 ? 48 : postContent.length < 50 ? 36 : 28;
                    ctx.font = `bold ${fontSize}px "可畫甜心體", Arial, "Noto Sans TC", sans-serif`;
                    ctx.fillStyle = '#5271ff';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';

                    // 如果是回覆貼文，添加原始貼文資訊
                    let contentToDisplay = postContent;
                    if (isReply && postData.originalPost) {
                        contentToDisplay = `↳ 回覆：\n${postData.originalPost.content}\n\n回覆內容：\n${postContent}`;
                        // 調整字體大小以適應更多文字
                        fontSize = Math.min(fontSize, 24);
                        ctx.font = `bold ${fontSize}px "可畫甜心體", Arial, "Noto Sans TC", sans-serif`;
                    }

                    // 處理文字換行
                    const lines = [];
                    const maxWidth = 700;
                    const lineHeight = fontSize * 1.2;
                    let currentLine = '';
                    const words = contentToDisplay.split('');

                    for (const word of words) {
                        if (word === '\n') {
                            lines.push(currentLine);
                            currentLine = '';
                            continue;
                        }
                        const testLine = currentLine + word;
                        const metrics = ctx.measureText(testLine);
                        if (metrics.width > maxWidth && currentLine !== '') {
                            lines.push(currentLine);
                            currentLine = word;
                        } else {
                            currentLine = testLine;
                        }
                    }
                    lines.push(currentLine);

                    // 繪製文字
                    const totalHeight = lines.length * lineHeight;
                    const startY = (canvas.height - totalHeight) / 2;
                    lines.forEach((line, index) => {
                        ctx.fillText(line, canvas.width / 2, startY + index * lineHeight);
                    });

                    // 修改文字圖片的存儲邏輯
                    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
                    const uniqueFileName = `ig_text_${Date.now()}_${Math.random().toString(36).substring(7)}_${postId}.jpg`;
                    const storageRef = firebase.storage().ref(`instagram_posts/${uniqueFileName}`);
                    await storageRef.put(blob);
                    const textImageUrl = await storageRef.getDownloadURL();

                    results.push({
                        image_url: textImageUrl,
                        postId: postId,
                        isReply: isReply,
                        isTextImage: true
                    });

                    return results;
                }));

                // 將結果扁平化並確保唯一性
                const flattenedResults = mediaResults.flat();
                const uniqueResults = Array.from(new Map(
                    flattenedResults.map(item => [item.image_url, item])
                ).values());

                // 發布輪播貼文
                const carouselData = await sendIGRequestPublish('media', {
                    media_type: 'CAROUSEL',
                    caption: "#乾淨天中使用#自動審文。",
                    children: uniqueResults.map(result => ({
                        media_type: 'IMAGE',
                        image_url: result.image_url
                    }))
                });

                // 等待媒體處理
                await new Promise(resolve => setTimeout(resolve, 5000));

                // 發布貼文
                const publishData = await sendIGRequestPublish('media_publish', {
                    creation_id: carouselData.id
                });

                // 更新資料庫
                await Promise.all(group.map(async (post) => {
                    const collection = post.querySelector('.post-content').getAttribute('data-is-reply') === 'true' ? 'postsrea' : 'posts';
                    await db.collection(collection).doc(post.getAttribute('data-post-id')).update({
                        published: true,
                        instagramPostId: publishData.id,
                        publishedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }));

                // 更新進度
                const progress = ((i + 10) / unpublishedPosts.length) * 100;
                progressBar.style.width = `${progress}%`;
                progressText.textContent = `${Math.round(progress)}%`;

            } catch (error) {
                console.error('處理貼文組時發生錯誤:', error);
                console.log(`處理貼文組時發生錯誤: ${error.message}\n是否繼續處理其他組？`);
                throw error;
            }
        }

        overlay.style.display = 'none';
        console.log('發布完成！');
        loadPosts();

    } catch (error) {
        console.error('批量發布失敗:', error);
        document.querySelector('.processing-overlay').style.display = 'none';
        console.log(`批量發布失敗: ${error.message}`);
    }
}

// 修改自動檢查函數
async function autoCheckAndPublish() {
    // 如果正在發布中，直接返回
    if (publishConfig.isPublishing) {
        return;
    }

    const approvedPosts = document.querySelectorAll('#approvedPostsContainer .post-card');
    const unpublishedPosts = Array.from(approvedPosts).filter(post => 
        post.querySelector('.post-status').textContent === '未發布'
    );

    if (unpublishedPosts.length >= publishConfig.currentMinPosts) {
        try {
            publishConfig.isPublishing = true;  // 設置發布鎖定
            await batchPublishToIG();
        } finally {
            publishConfig.isPublishing = false;  // 解除發布鎖定
        }
    }
}

// 使用防抖處理來避免過頻繁的檢查
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 使用防抖包裝 autoCheckAndPublish
const debouncedAutoCheck = debounce(autoCheckAndPublish, 1000);

// 修改 MutationObserver 的回調
const observer = new MutationObserver(debouncedAutoCheck);
observer.observe(document.getElementById('approvedPostsContainer'), { 
    childList: true, 
    subtree: true 
});

// 初始檢查
autoCheckAndPublish();