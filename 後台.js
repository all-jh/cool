// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDAw3LKSDHHwasOhN0l63lO4I-AO1xeGGU",
    authDomain: "tmjh113.firebaseapp.com",
    projectId: "tmjh113",
    storageBucket: "tmjh113.appspot.com",
    messagingSenderId: "936878916477",
    appId: "1:936878916477:web:cbff479db9898b0a218214",
    measurementId: "G-J5WT01ZLBD"
  }
          // 初始 Firebase
          firebase.initializeApp(firebaseConfig);
          const db = firebase.firestore();
          // 獲取並顯示留言
          async function loadPosts() {
              const pendingContainer = document.getElementById('pendingPostsContainer');
              const approvedContainer = document.getElementById('approvedPostsContainer');
              
              pendingContainer.innerHTML = '<div class="loading">載入中...</div>';
              approvedContainer.innerHTML = '<div class="loading">載入中...</div>';
              
              try {
                  // 使用複合查詢，一次獲取所有需要的數據
                  const [postsSnapshot, repliesSnapshot] = await Promise.all([
                      db.collection('posts')
                          .orderBy('createdAt', 'desc')
                          .limit(50) // 限制加載數量
                          .get(),
                      db.collection('postsrea')
                          .orderBy('createdAt', 'desc')
                          .limit(50) // 限制加載數量
                          .get()
                  ]);
  
                  pendingContainer.innerHTML = '';
                  approvedContainer.innerHTML = '';
  
                  if (postsSnapshot.empty && repliesSnapshot.empty) {
                      pendingContainer.innerHTML = '<div class="no-posts">目前還沒有待審核留言</div>';
                      approvedContainer.innerHTML = '<div class="no-posts">目前還沒有已批准留言</div>';
                  } else {
                      // 處理主要貼文
                      postsSnapshot.forEach(doc => {
                          const postData = doc.data();
                          const postElement = createPostElement(doc.id, postData, false);
                          
                          if (postData.approved) {
                              approvedContainer.appendChild(postElement);
                          } else {
                              pendingContainer.appendChild(postElement);
                          }
                      });
  
                      // 處理回覆貼文
                      repliesSnapshot.forEach(doc => {
                          const replyData = doc.data();
                          // 確保回覆有編號
                          if (replyData.status === 'approved' && !replyData.postNumber) {
                              // 如果是已批准但沒有編號的回覆，立即分配編號
                              getCurrentPostNumber().then(nextNumber => {
                                  db.collection('postsrea').doc(doc.id).update({
                                      postNumber: nextNumber,
                                      published: false
                                  });
                              });
                          }
                          const replyElement = createPostElement(doc.id, replyData, true);
                          
                          if (replyData.status === 'approved') {
                              approvedContainer.appendChild(replyElement);
                          } else {
                              pendingContainer.appendChild(replyElement);
                          }
                      });
                  }
              } catch (error) {
                  console.error("載入留言時發生誤：", error);
                  pendingContainer.innerHTML = '<div class="error-message">載入留言失敗，請稍後再試</div>';
                  approvedContainer.innerHTML = '<div class="error-message">載入留言失敗，請稍後再試</div>';
              }
          }
          function createPostElement(docId, postData, isReply) {
              const postElement = document.createElement('div');
              postElement.className = 'post-card';
              postElement.setAttribute('data-post-id', docId);
              
              const timestamp = postData.createdAt?.toDate() || new Date();
              const formattedDate = timestamp.toLocaleString('zh-TW', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
              });
  
              let content, postNumber;
              if (isReply) {
                  content = postData.replyContent;
                  postNumber = postData.postNumber ? `#${postData.postNumber}` : '未編號';
              } else {
                  content = postData.content;
                  postNumber = postData.postNumber ? `#${postData.postNumber}` : '未編號';
              }
  
              const actionButtons = (isReply ? 
                  (postData.status === 'approved' ? 
                      `<button class="delete-btn" onclick="deleteReply('${docId}')">刪除</button>` :
                      `<button class="approve-btn" onclick="approveReply('${docId}')">批准</button>
                       <button class="delete-btn" onclick="deleteReply('${docId}')">刪除</button>`) :
                  (postData.approved ? 
                      `<button class="delete-btn" onclick="deletePost('${docId}')">刪除</button>` :
                      `<button class="approve-btn" onclick="approvePost('${docId}')">批准</button>
                       <button class="delete-btn" onclick="deletePost('${docId}')">刪除</button>`));
  
              const publishedStatus = postData.published ? '已發布' : '未發布';
              const contentHtml = `<div class="post-content" ${isReply ? 'data-is-reply="true"' : ''}>${content}</div>`;
              postElement.innerHTML = `
                  <div class="post-header">
                      <h3>📝 ${isReply ? '回覆留言' : '匿名留言'} ${postNumber}</h3>
                      <span class="post-time">🕒 ${formattedDate}</span>
                  </div>
                  ${contentHtml}
                  ${postData.mediaUrls ? postData.mediaUrls.map(url => {
                      if (url.type === 'image') {
                          return `<img src="${url.url}" alt="留言圖片" class="post-media" loading="lazy">`;
                      } else if (url.type === 'video') {
                          return `<video controls class="post-media" preload="metadata">
                                      <source src="${url.url}" type="video/mp4">
                                      您的瀏覽器不支持視頻標籤。
                                  </video>`;
                      } else if (url.type === 'gif') {
                          return `<img src="${url.url}" alt="留言GIF" class="post-media" loading="lazy">`;
                      }
                  }).join('') : ''}
                  <div class="post-actions">
                      <button class="ai-check-btn" onclick="aiCheckPost(this, '${docId}')">AI審核</button>
                      ${actionButtons}
                  </div>
                  <div class="post-status">${publishedStatus}</div>
              `;
              return postElement;
          }
          // 新增批准貼文功能
          async function approvePost(docId) {
              try {
                  await db.collection('posts').doc(docId).update({
                      approved: true
                  });
                  loadPosts(); // 重新載入貼文
              } catch (error) {
                  console.error("批准貼文時發生錯誤：", error);
                  alert("批准貼文失敗，請稍再試");
              }
          }
          // 新增刪除貼文功能
          async function deletePost(docId) {
              try {
                  const postElement = document.querySelector(`[data-post-id="${docId}"]`);
                  if (postElement) {
                      postElement.style.opacity = '0';
                      postElement.style.transform = 'scale(0.9)';
                      postElement.style.transition = 'all 0.3s ease';
                      
                      // 同時執行刪除操和動畫
                      await Promise.all([
                          db.collection('posts').doc(docId).delete(),
                          new Promise(resolve => setTimeout(resolve, 300))
                      ]);
                      
                      postElement.remove();
                  }
              } catch (error) {
                  console.error("刪除貼文時發生錯誤：", error);
                  alert("刪除貼文失敗，請稍後再試");
              }
          }
          // 輔助函數：獲取文件擴展
          function getFileExtension(url) {
              return url.split('.').pop().split(/\#|\?/)[0];
          }
          async function getCurrentPostNumber() {
              try {
                  // 只查詢最後一個編號，減少數據讀取
                  const [postsLast, repliesLast] = await Promise.all([
                      db.collection('posts')
                          .where('published', '==', true)
                          .orderBy('postNumber', 'desc')
                          .limit(1)
                          .get(),
                      db.collection('postsrea')
                          .where('published', '==', true)
                          .orderBy('postNumber', 'desc')
                          .limit(1)
                          .get()
                  ]);
  
                  let maxNumber = 0;
                  
                  if (!postsLast.empty) {
                      maxNumber = Math.max(maxNumber, postsLast.docs[0].data().postNumber || 0);
                  }
                  
                  if (!repliesLast.empty) {
                      maxNumber = Math.max(maxNumber, repliesLast.docs[0].data().postNumber || 0);
                  }
                  
                  return maxNumber + 1;
                  
              } catch (error) {
                  console.error("獲取貼文編號時發生錯誤：", error);
                  return 1;
              }
          }
          // 修改 setupRealtimeListeners 函數
          function setupRealtimeListeners() {
              // 監聽新的主要貼文
              const unsubscribePosts = db.collection('posts')
                  .onSnapshot(snapshot => {
                      snapshot.docChanges().forEach(change => {
                          const postData = change.doc.data();
                          const postElement = document.querySelector(`[data-post-id="${change.doc.id}"]`);
                          
                          if (change.type === 'added') {
                              // 新增貼文時自動進行 AI 審核
                              if (!postData.approved) {
                                  autoAICheck(change.doc.id, postData.content, false);
                              }
                              if (!postElement) {
                                  const newPostElement = createPostElement(change.doc.id, postData, false);
                                  const container = postData.approved ? 
                                      document.getElementById('approvedPostsContainer') : 
                                      document.getElementById('pendingPostsContainer');
                                  container.insertBefore(newPostElement, container.firstChild);
                              }
                          } else if (change.type === 'modified') {
                              // 更新現有貼文
                              if (postElement) {
                                  const updatedElement = createPostElement(change.doc.id, postData, false);
                                  postElement.replaceWith(updatedElement);
                              }
                          } else if (change.type === 'removed') {
                              // 移除貼文
                              postElement?.remove();
                          }
                      });
                  });
  
              // 監聽新的回覆貼文
              const unsubscribeReplies = db.collection('postsrea')
                  .onSnapshot(snapshot => {
                      snapshot.docChanges().forEach(change => {
                          const replyData = change.doc.data();
                          const replyElement = document.querySelector(`[data-post-id="${change.doc.id}"]`);
                          
                          if (change.type === 'added') {
                              // 新增回覆時自動進行 AI 審核
                              if (replyData.status !== 'approved') {
                                  autoAICheck(change.doc.id, replyData.replyContent, true);
                              }
                              if (!replyElement) {
                                  const newReplyElement = createPostElement(change.doc.id, replyData, true);
                                  const container = replyData.status === 'approved' ? 
                                      document.getElementById('approvedPostsContainer') : 
                                      document.getElementById('pendingPostsContainer');
                                  container.insertBefore(newReplyElement, container.firstChild);
                              }
                          } else if (change.type === 'modified') {
                              // 更新現有回覆
                              if (replyElement) {
                                  const updatedElement = createPostElement(change.doc.id, replyData, true);
                                  replyElement.replaceWith(updatedElement);
                              }
                          } else if (change.type === 'removed') {
                              // 移除回覆
                              replyElement?.remove();
                          }
                      });
                  });
  
              return () => {
                  unsubscribePosts();
                  unsubscribeReplies();
              };
          }
          // 修改初始化代碼
          document.addEventListener('DOMContentLoaded', () => {
              loadPosts(); // 初始載入
              setupRealtimeListeners(); // 啟動實時監聽和自動 AI 審核
          });
  
          // 新增回覆相關的功能
          async function approveReply(docId) {
              try {
                  // 獲取當前最大編號
                  const nextNumber = await getCurrentPostNumber();
                  
                  // 更新回覆狀態和編號
                  await db.collection('postsrea').doc(docId).update({
                      status: 'approved',
                      postNumber: nextNumber,
                      published: false  // 確保新批准的回覆預設為未發布
                  });
                  
                  console.log(`已批准回覆並設置編號: ${nextNumber}`);
                  loadPosts();
              } catch (error) {
                  console.error("批准回覆時發生錯誤：", error);
                  alert("批准回覆失敗，請稍後再試");
              }
          }
  
          async function deleteReply(docId) {
              try {
                  const replyElement = document.querySelector(`[data-post-id="${docId}"]`);
                  if (replyElement) {
                      replyElement.style.opacity = '0';
                      replyElement.style.transform = 'scale(0.9)';
                      replyElement.style.transition = 'all 0.3s ease';
                      
                      await Promise.all([
                          db.collection('postsrea').doc(docId).delete(),
                          new Promise(resolve => setTimeout(resolve, 300))
                      ]);
                      
                      replyElement.remove();
                  }
              } catch (error) {
                  console.error("刪除回覆時發生錯誤：", error);
                  alert("刪除回覆失敗，請稍後再試");
              }
          }
  
          async function aiCheckPost(button, docId) {
              const postCard = button.closest('.post-card');
              const content = postCard.querySelector('.post-content').textContent;
              
              try {
                  const response = await fetch('https://api.x.ai/v1/chat/completions', {
                      method: 'POST',
                      headers: {
                          'Content-Type': 'application/json',
                          'Authorization': 'Bearer xai-bTBkhJryFZ06CPbCoftT0MAKR7vBMn1QZGjaWOWULNy0HvjJ8iEERmQynIbFxU1MJtMMXWZ4uu7cEtbA'
                      },
                      body: JSON.stringify({
                          messages: [
                              {
                                  "role": "system",
                                  "content": `你是一個內容審核助手。請分析內容是否違反以下規則，並特別注意隱私保護：

1. 校園霸凌
2. 公然侮辱
3. 誹謗
4. 引起群眾紛爭或對立
5. 暴力或煽動暴力
6. 色情或不當暗示
7. 仇恨或歧視性言論
8. 個人隱私侵犯（需要遮蔽處理，但不需要刪除）：
   - 姓名（將姓氏保留，名字改為 xx，例：林大名 改為 林xx）
   - 電話號碼（需用 x 遮蔽）
   - 地址（需用 x 遮蔽）
   - 學號或身分證字號（需用 x 遮蔽）
   - 班級座號的規則：
     * 座號只遮蔽個位數（例：45號 改為 4x號）
     * 完整班級座號（例：7義45 改為 7義4x）
     * 只提到班級時不需遮蔽（例：7義 保持不變）
   - 社群媒體帳號（需遮蔽）

遮蔽規則說明：
1. 座號遮蔽：只遮蔽個位數
   - 45號 → 4x號
   - 7義45 → 7義4x
   - 第45號 → 第4x號

2. 姓名遮蔽：保留姓氏，名字改為xx
   - 林大名 → 林xx
   - 王小明 → 王xx

3. 以下情況不需要遮蔽：
   - 只提到班級（例：7義、七義）
   - 非具體座號的數字
   - 一般性描述

請直接回傳一個 JSON 物件，格式為：
{
    "isSafe": boolean,
    "issues": {
        "bullying": boolean,
        "publicInsult": boolean,
        "defamation": boolean,
        "conflict": boolean,
        "violence": boolean,
        "sexual": boolean,
        "hate": boolean,
        "privacy": boolean,
        "minorProtection": boolean
    },
    "reason": "如果內容不安全，說明原因",
    "maskedContent": "如果需要遮蔽處理，返回處理後的內容"
}`
                              },
                              {
                                  "role": "user",
                                  "content": content
                              }
                          ],
                          model: "grok-beta",
                          stream: false,
                          temperature: 0
                      })
                  });
  
                  const apiResponse = await response.json();
                  const aiMessage = apiResponse.choices[0].message.content;
                  const cleanedResponse = aiMessage.replace(/```json\n?|\n?```/g, '').trim();
                  const result = JSON.parse(cleanedResponse);
  
                  // 如果內容包含個資但可以遮蔽處理
                  if (result.maskedContent && !result.isSafe && (result.issues.privacy || result.issues.minorProtection)) {
                      const isReply = postCard.querySelector('.post-content').hasAttribute('data-is-reply');
                      
                      // 更新資料庫中的內容
                      if (isReply) {
                          await db.collection('postsrea').doc(docId).update({
                              replyContent: result.maskedContent,
                              lastModified: firebase.firestore.FieldValue.serverTimestamp()
                          });
                      } else {
                          await db.collection('posts').doc(docId).update({
                              content: result.maskedContent,
                              lastModified: firebase.firestore.FieldValue.serverTimestamp()
                          });
                      }
                      
                      // 實時監聽會自動更新UI
                  }
  
                  // 移除舊的 AI 結果
                  const oldResult = postCard.querySelector('.ai-result');
                  if (oldResult) {
                      oldResult.remove();
                  }
  
                  // 創建新的結果顯示
                  const resultDiv = document.createElement('div');
                  resultDiv.className = `ai-result ${result.isSafe ? 'ai-safe' : 'ai-danger'}`;
                  
                  let resultText = 'AI 審核結果：\n';
                  if (result.isSafe) {
                      resultText += '✅ 內容安全，已自動批准\n';
                      // 自動批准
                      const approveBtn = postCard.querySelector('.approve-btn');
                      if (approveBtn) {
                          approveBtn.click();
                      }
                  } else {
                      resultText += '❌ 檢測到違規內容，將自動刪除：\n';
                      const issues = result.issues;
                      if (issues.bullying) resultText += '- 涉及校園霸凌\n';
                      if (issues.publicInsult) resultText += '- 涉及公然侮辱\n';
                      if (issues.defamation) resultText += '- 涉及誹謗\n';
                      if (issues.conflict) resultText += '- 可能起群眾紛爭\n';
                      if (issues.violence) resultText += '- 包含暴力內容\n';
                      if (issues.sexual) resultText += '- 包含不當性暗示\n';
                      if (issues.hate) resultText += '- 包含仇恨或歧視言論\n';
                      if (issues.privacy) resultText += '- 涉及個人隱私侵犯\n';
                      if (issues.minorProtection) resultText += '- 涉及未成年者敏感資訊\n';
                      resultText += `\n原因：${result.reason}`;
  
                      // 延遲 3 秒後自動刪除
                      setTimeout(async () => {
                          const isReply = postCard.querySelector('.post-content').hasAttribute('data-is-reply');
                          if (isReply) {
                              await deleteReply(docId);
                          } else {
                              await deletePost(docId);
                          }
                      }, 3000);
                  }
                  
                  resultDiv.innerText = resultText;
                  postCard.insertBefore(resultDiv, postCard.querySelector('.post-actions'));
  
              } catch (error) {
                  console.error('AI 審核失敗：', error);
                  alert('AI 審核系統暫時無法使用，請稍後再試');
              }
          }
           // autoAICheck 函數現在可以直接使用全局的 sendIGRequest
           async function autoAICheck(docId, content, isReply = false) {
            try {
                const response = await fetch('https://api.x.ai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer xai-bTBkhJryFZ06CPbCoftT0MAKR7vBMn1QZGjaWOWULNy0HvjJ8iEERmQynIbFxU1MJtMMXWZ4uu7cEtbA'
                    },
                    body: JSON.stringify({
                        messages: [
                            {
                                "role": "system",
                                "content": `你是一個內容審核助手。請分析內容是否違反以下規則，並特別注意隱私保護：

                                1. 校園霸凌
                                2. 公然侮辱
                                3. 誹謗
                                4. 引起群眾紛爭或對立
                                5. 暴力或煽動暴力
                                6. 色情或不當暗示
                                7. 仇恨或歧視性言論
                                8. 個人隱私侵犯（需要遮蔽處理，但不需要刪除）：
                                   - 姓名（將姓氏保留，名字改為 xx，例：林大名 改為 林xx）
                                   - 電話號碼（需用 x 遮蔽）
                                   - 地址（需用 x 遮蔽）
                                   - 學號或身分證字號（需用 x 遮蔽）
                                   - 班級座號的規則：
                                     * 座號只遮蔽個位數（例：45號 改為 4x號）
                                     * 完整班級座號（例：7義45 改為 7義4x）
                                     * 只提到班級時不需遮蔽（例：7義 保持不變）
                                   - 社群媒體帳號（需遮蔽）

                                遮蔽規則說明：
                                1. 座號遮蔽：只遮蔽個位數
                                   - 45號 → 4x號
                                   - 7義45 → 7義4x
                                   - 第45號 → 第4x號

                                2. 姓名遮蔽：保留姓氏，名字改為xx
                                   - 林大名 → 林xx
                                   - 王小明 → 王xx

                                3. 以下情況不需要遮蔽：
                                   - 只提到班級（例：7義、七義）
                                   - 非具體座號的數字
                                   - 一般性描述

                                請直接回傳一個 JSON 物件，格式為：
                                {
                                    "isSafe": boolean,
                                    "issues": {
                                        "bullying": boolean,
                                        "publicInsult": boolean,
                                        "defamation": boolean,
                                        "conflict": boolean,
                                        "violence": boolean,
                                        "sexual": boolean,
                                        "hate": boolean,
                                        "privacy": boolean,
                                        "minorProtection": boolean
                                    },
                                    "reason": "如果內容不安全，說明原因",
                                    "maskedContent": "如果需要遮蔽處理，返回處理後的內容"
                                }`
                                                              },
                                                              {
                                                                  "role": "user",
                                                                  "content": content
                                                              }
                                                          ],
                                                          model: "grok-beta",
                                                          stream: false,
                                                          temperature: 0
                                                      })
                                                  });
                const apiResponse = await response.json();
                const aiMessage = apiResponse.choices[0].message.content;
                const cleanedResponse = aiMessage.replace(/```json\n?|\n?```/g, '').trim();
                const result = JSON.parse(cleanedResponse);

                // 檢查是否只有隱私問題需要遮蔽
                const hasOnlyPrivacyIssues = Object.entries(result.issues).every(([key, value]) => {
                    if (key === 'privacy' || key === 'minorProtection') {
                        return true; // 忽略隱私相關的問題
                    }
                    return value === false; // 其他問題必須為 false
                });

                // 如果有遮蔽後的內容且只有隱私問題
                if (result.maskedContent && hasOnlyPrivacyIssues) {
                    // 更新內容為遮蔽後的版本
                    if (isReply) {
                        await db.collection('postsrea').doc(docId).update({
                            replyContent: result.maskedContent,
                            status: 'approved',
                            postNumber: await getCurrentPostNumber(),
                            published: false
                        });
                    } else {
                        await db.collection('posts').doc(docId).update({
                            content: result.maskedContent,
                            approved: true
                        });
                    }
                    console.log('內容已遮蔽並自動批准：', docId);
                    return;
                }

                // 處理其他情況
                if (result.isSafe) {
                    // 如果內容安全，自動批准
                    if (isReply) {
                        const nextNumber = await getCurrentPostNumber();
                        await db.collection('postsrea').doc(docId).update({
                            status: 'approved',
                            postNumber: nextNumber,
                            published: false
                        });
                    } else {
                        await db.collection('posts').doc(docId).update({
                            approved: true
                        });
                    }
                    console.log('內容安全，已自動批准：', docId);
                } else if (!hasOnlyPrivacyIssues) {
                    // 只有在有其他違規問題時才刪除
                    if (isReply) {
                        await db.collection('postsrea').doc(docId).delete();
                    } else {
                        await db.collection('posts').doc(docId).delete();
                    }
                    console.log('檢測到嚴重違規內容，已自動刪除：', docId);
                }
            } catch (error) {
                console.error('AI 自動審核失敗：', error);
                throw new Error('AI 審核失敗：' + error.message);
            }
        }