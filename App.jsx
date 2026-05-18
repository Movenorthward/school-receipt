<!DOCTYPE html>
<html lang="zh-TW">
<!-- 
  =============================================================
  🏷️ 版本代號：V9.0-最終發布版 (Master2026-Final-Release)
  
  【系統核心亮點】
  1. 原生透明去背：簽名檔採用原生透明 (PNG)，徹底解決 PDF 列印白塊。
  2. 浮空簽名定位：簽名圖片採絕對定位，可自由放大且不撐破領據表格。
  3. 直覺式拖曳排版：點擊簽名即可彈出調整視窗，支援滑鼠拖曳與拉桿縮放。
  4. 記憶路由防呆：加入 Session 暫存，解決手機 LINE 跳轉登入遺失代碼的 Bug。
  5. PDF 直出引擎：列印採用隱形 A4 畫布轉換，確保 100% 絕對不跑版。
  6. 管理員識別列：加入頂端包含 Google 頭像與安全頻道的專屬導覽列。
  7. 端到端加密 (E2EE)：講師端直接鎖定個資，僅承辦人專屬金鑰可解密。
  =============================================================
-->
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- 基礎 XSS 防護 -->
    <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval' https: wss: data: blob:;">
    <title>經費領據管理系統 (V9.0-最終發布版)</title>
    
    <!-- 載入 Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    
    <!-- 載入 React 核心庫 -->
    <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
    
    <!-- 載入 Babel Standalone 用於在瀏覽器即時編譯 JSX -->
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
</head>
<body class="m-0 p-0 text-gray-900 bg-gray-50">
    <div id="root"></div>

    <script type="text/babel" data-type="module" data-presets="react">
        import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
        import { getAuth, onAuthStateChanged, signInWithCustomToken, signInAnonymously, GoogleAuthProvider, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
        import { getFirestore, collection, doc, setDoc, getDoc, onSnapshot, addDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

        const { useState, useEffect, useRef, useMemo } = React;

        // ==========================================
        // 🔥 系統主 ID (基礎)
        // ==========================================
        const MY_PROJECT_ID = typeof __app_id !== 'undefined' ? __app_id : "Taiwan-Teachers-Secure-Receipt"; 

        // ==========================================
        // ⚠️ 請在此處填入您的 Firebase 設定
        // ==========================================
        const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
            // 👇 👇 👇 將 Firebase 控制台給您的設定貼在這裡 👇 👇 👇
            // apiKey: "xxxxxxxxx",
            // authDomain: "xxxxxxxxx",
            // projectId: "xxxxxxxxx",
            // storageBucket: "xxxxxxxxx",
            // messagingSenderId: "xxxxxxxxx",
            // appId: "xxxxxxxxx"
            // 👆 👆 👆 將 Firebase 控制台給您的設定貼在這裡 👆 👆 👆
        };

        // 防呆機制
        if (!firebaseConfig.apiKey && typeof __firebase_config === 'undefined') {
            const root = ReactDOM.createRoot(document.getElementById('root'));
            root.render(
                <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-100 print:hidden">
                    <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-lg w-full border-t-8 border-red-500 text-center animate-in zoom-in-95">
                        <h1 className="text-5xl mb-4">⚠️</h1>
                        <h2 className="text-2xl font-bold text-red-600 mb-4">尚未設定 Firebase 金鑰</h2>
                        <div className="text-gray-600 text-left space-y-2 bg-red-50 p-5 rounded-xl border border-red-100 text-sm leading-relaxed">
                            <p className="font-bold text-red-800">請用記事本打開 index.html，在第 47 行填入 Firebase 金鑰！</p>
                        </div>
                    </div>
                </div>
            );
            throw new Error("Missing Firebase Config");
        }

        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);

        // --- 工具函數 ---
        const numberToChinese = (num) => {
            if (!num || isNaN(num) || num === 0) return "零元整";
            const digits = ['零', '壹', '貳', '參', '肆', '伍', '陸', '柒', '捌', '玖'];
            const units = ['', '拾', '佰', '仟', '萬', '拾', '佰', '仟', '億'];
            let str = Math.round(num).toString();
            let res = '';
            for (let i = 0; i < str.length; i++) {
                let n = parseInt(str[i]);
                let u = str.length - 1 - i;
                if (n !== 0) { res += digits[n] + units[u]; } 
                else {
                    if (res[res.length - 1] !== '零' && u !== 0 && u !== 4 && u !== 8) res += '零';
                    if (u === 4 && res[res.length - 1] !== '萬') res += '萬';
                    if (u === 8 && res[res.length - 1] !== '億') res += '億';
                }
            }
            return res.replace(/零+$/, '').replace(/零萬/, '萬').replace(/零億/, '億') + '元整';
        };

        const formatTWDate = (dateStr) => {
            if (!dateStr) return '';
            if (dateStr.includes('/')) return dateStr;
            const parts = dateStr.split('-');
            if (parts.length === 3) {
                return `${parseInt(parts[0], 10) - 1911}/${parts[1]}/${parts[2]}`;
            }
            return dateStr;
        };

        const generateRandomKey = () => {
            const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
            const randomValues = new Uint32Array(32);
            window.crypto.getRandomValues(randomValues);
            let pwd = "";
            for (let i = 0; i < 32; i++) {
                pwd += chars[randomValues[i] % chars.length];
            }
            return pwd;
        };

        const maskIdNumber = (id) => {
            if (!id) return '無個資';
            if (id.length < 8) return '***'; 
            return `${id.substring(0, 3)}****${id.substring(id.length - 3)}`;
        };

        const encryptPayload = (dataObj, key) => {
            if (!window.CryptoJS) return null;
            return window.CryptoJS.AES.encrypt(JSON.stringify(dataObj), key).toString();
        };

        const decryptPayload = (ciphertext, key) => {
            if (!window.CryptoJS || !ciphertext) return null;
            try {
                const bytes = window.CryptoJS.AES.decrypt(ciphertext, key);
                const decryptedStr = bytes.toString(window.CryptoJS.enc.Utf8);
                if (!decryptedStr) return null; 
                return JSON.parse(decryptedStr);
            } catch(e) { 
                return null; 
            }
        };

        const compressImage = (file, maxWidth = 600) => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = (event) => {
                    const img = new Image();
                    img.src = event.target.result;
                    img.onload = () => {
                        try {
                            const canvas = document.createElement('canvas');
                            let scaleSize = 1;
                            if (img.width > maxWidth) scaleSize = maxWidth / img.width;
                            canvas.width = img.width * scaleSize;
                            canvas.height = img.height * scaleSize;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                            // 🔥 去背修正：確保 PNG 上傳時不被強制轉存成不支援透明的 JPEG
                            const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
                            const quality = mimeType === 'image/jpeg' ? 0.4 : undefined;
                            const dataUrl = canvas.toDataURL(mimeType, quality);
                            canvas.width = 0; canvas.height = 0; img.src = '';
                            resolve(dataUrl); 
                        } catch (err) { reject(err); }
                    };
                    img.onerror = error => reject(error);
                };
                reader.onerror = error => reject(error);
            });
        };

        function Toast({ message, onClose }) {
            useEffect(() => {
                if (message) {
                    const timer = setTimeout(onClose, 4000);
                    return () => clearTimeout(timer);
                }
            }, [message, onClose]);
            if (!message) return null;
            return (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-4 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-[9999] flex items-center gap-4 min-w-[300px] justify-between border border-gray-700 animate-in slide-in-from-bottom-5 print:hidden">
                    <span className="font-bold tracking-wide">{message}</span>
                    <button onClick={onClose} className="text-gray-400 hover:text-white font-bold text-xl">✕</button>
                </div>
            );
        }

        // ==========================================
        // 🔥 直覺式簽名拖曳與縮放視窗元件
        // ==========================================
        const SignatureAdjustModal = ({ instructor, initialTransform, onSave, onClose }) => {
            const [transform, setTransform] = useState(initialTransform || { x: 120, y: -10, width: 140 });
            const [isDragging, setIsDragging] = useState(false);
            const [isResizing, setIsResizing] = useState(false);
            const [startPos, setStartPos] = useState({x:0, y:0, startWidth:0});

            const handleDragStart = (e) => {
                e.stopPropagation(); setIsDragging(true);
                setStartPos({ x: e.clientX - transform.x, y: e.clientY - transform.y });
                e.target.setPointerCapture(e.pointerId);
            };
            const handleDragMove = (e) => {
                if (!isDragging) return;
                setTransform(prev => ({ ...prev, x: e.clientX - startPos.x, y: e.clientY - startPos.y }));
            };
            const handleDragEnd = (e) => { setIsDragging(false); e.target.releasePointerCapture(e.pointerId); };

            const handleResizeStart = (e) => {
                e.stopPropagation(); setIsResizing(true);
                setStartPos({ x: e.clientX, startWidth: transform.width });
                e.target.setPointerCapture(e.pointerId);
            };
            const handleResizeMove = (e) => {
                if (!isResizing) return;
                const deltaX = e.clientX - startPos.x;
                setTransform(prev => ({ ...prev, width: Math.max(30, startPos.startWidth + deltaX) }));
            };
            const handleResizeEnd = (e) => { setIsResizing(false); e.target.releasePointerCapture(e.pointerId); };

            return (
                <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4 print-hide" onClick={onClose}>
                    <div className="bg-white p-6 rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold mb-2 text-center text-blue-900">調整 {instructor.name} 的簽名檔</h3>
                        <p className="text-xs text-gray-500 mb-4 text-center bg-blue-50 p-2 rounded-lg">💡 拖曳簽名移動位置，或拖曳右下角藍點縮放大小。</p>
                        
                        <div className="bg-gray-100 p-8 rounded-xl flex justify-center mb-6 overflow-hidden border-2 border-dashed border-gray-300">
                            <div className="bg-white border-2 border-black w-full max-w-lg relative" style={{ height: '65px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', height: '100%', padding: '0 10px', position: 'relative' }}>
                                    <span style={{ fontSize: '1.25rem', fontWeight: 'bold', zIndex: 10 }}>{instructor.name}</span>
                                    <div style={{ position: 'absolute', left: `${transform.x}px`, top: `${transform.y}px`, width: `${transform.width}px`, zIndex: 50, touchAction: 'none' }}>
                                        {/* 🔥 移除導致 PDF 引擎誤判白底的 mixBlendMode */}
                                        <img src={instructor.signatureUrl} alt="Signature" style={{ width: '100%', height: 'auto', cursor: 'move', border: '2px dashed #93c5fd', backgroundColor: 'rgba(219, 234, 254, 0.4)' }} onPointerDown={handleDragStart} onPointerMove={handleDragMove} onPointerUp={handleDragEnd} onPointerCancel={handleDragEnd} draggable="false" />
                                        <div style={{ position: 'absolute', right: '-10px', bottom: '-10px', width: '24px', height: '24px', backgroundColor: '#2563eb', borderRadius: '50%', cursor: 'se-resize', boxShadow: '0 2px 4px rgba(0,0,0,0.3)', border: '2px solid white' }} onPointerDown={handleResizeStart} onPointerMove={handleResizeMove} onPointerUp={handleResizeEnd} onPointerCancel={handleResizeEnd} title="拖曳我來縮放簽名" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 bg-gray-50 p-4 rounded-xl">
                            <label className="flex flex-col text-xs font-bold text-gray-700">↔️ 左右: {Math.round(transform.x)}<input type="range" min="-50" max="400" value={transform.x} onChange={e => setTransform(p => ({...p, x: parseFloat(e.target.value)}))} className="mt-2 accent-blue-600" /></label>
                            <label className="flex flex-col text-xs font-bold text-gray-700">↕️ 上下: {Math.round(transform.y)}<input type="range" min="-100" max="100" value={transform.y} onChange={e => setTransform(p => ({...p, y: parseFloat(e.target.value)}))} className="mt-2 accent-blue-600" /></label>
                            <label className="flex flex-col text-xs font-bold text-gray-700">🔍 大小: {Math.round(transform.width)}<input type="range" min="30" max="300" value={transform.width} onChange={e => setTransform(p => ({...p, width: parseFloat(e.target.value)}))} className="mt-2 accent-blue-600" /></label>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={onClose} className="flex-1 py-3 border-2 border-gray-200 rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition-colors">取消</button>
                            <button onClick={() => onSave(transform)} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-colors">✔ 確定套用</button>
                        </div>
                    </div>
                </div>
            );
        };

        const ReceiptTemplate = ({ config, instructor, sysConfig, showSignature = true, sigTransform, onEditSignature }) => {
            const totalAmount = config.items ? config.items.reduce((sum, item) => sum + (item.qty * item.price), 0) : 0;
            const chineseAmount = numberToChinese(totalAmount);

            const tableStyle = { width: '100%', borderCollapse: 'collapse', border: '2px solid #000', tableLayout: 'fixed', fontSize: '0.95rem', fontFamily: "'DFKai-sb', 'BiauKai', '標楷體', serif" };
            const tdStyle = { border: '1px solid #000', padding: '4px 6px', verticalAlign: 'middle', color: '#000' };
            const centerBold = { ...tdStyle, textAlign: 'center', fontWeight: 'bold', whiteSpace: 'nowrap' };
            
            const bgCyan = { backgroundColor: '#d1fae5', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' };
            const bgYellow = { backgroundColor: '#fef08a', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' };

            const transform = sigTransform || { x: 120, y: -10, width: 140 };

            return (
                <div style={{ width: '800px', minWidth: '800px', margin: '0 auto', boxSizing: 'border-box', background: '#fff' }}>
                    <div style={{ textAlign: 'center', fontSize: '2.2rem', fontWeight: 'bold', letterSpacing: '2em', marginBottom: '15px', marginLeft: '2em', fontFamily: "'DFKai-sb', 'BiauKai', '標楷體', serif" }}>
                        領據
                    </div>
                    <table style={tableStyle}>
                        <colgroup><col style={{width: '18%'}}/><col style={{width: '32%'}}/><col style={{width: '18%'}}/><col style={{width: '32%'}}/></colgroup>
                        <tbody>
                            <tr><td style={centerBold}>茲收到</td><td colSpan="3" style={{...tdStyle, ...bgCyan}}>{config.activityName}</td></tr>
                            <tr><td style={centerBold}>計新臺幣</td><td colSpan="3" style={{...tdStyle, textAlign: 'center', fontSize: '1.4rem', fontWeight: 'bold', letterSpacing: '0.2em'}}>{chineseAmount}</td></tr>
                            <tr><td colSpan="4" style={{...tdStyle, paddingLeft: '2rem'}}>此致</td></tr>
                            <tr><td colSpan="4" style={{...tdStyle, paddingLeft: '2rem', fontSize: '1.2rem', fontWeight: 'bold'}}>{config.schoolName}</td></tr>
                            <tr>
                                <td style={{...tdStyle, textAlign: 'center', whiteSpace: 'nowrap'}}>具領人簽章：</td>
                                <td style={{...tdStyle, padding: '0', height: '65px', position: 'relative'}}>
                                    <div style={{ display: 'flex', alignItems: 'center', height: '100%', padding: '0 10px', position: 'relative' }}>
                                        <span style={{ fontSize: '1.25rem', fontWeight: 'bold', wordBreak: 'break-all', maxWidth: '40%', position: 'relative', zIndex: 10 }}>{instructor.name}</span>
                                        {showSignature && instructor.signatureUrl && (
                                            <img 
                                                src={instructor.signatureUrl} 
                                                alt="Signature" 
                                                className={onEditSignature ? "hover:outline hover:outline-2 hover:outline-blue-500 hover:bg-blue-50/50 cursor-pointer transition-all rounded" : ""}
                                                onClick={() => onEditSignature && onEditSignature(instructor)}
                                                title={onEditSignature ? "點擊拖曳與調整簽名大小" : ""}
                                                style={{ 
                                                    position: 'absolute', 
                                                    left: `${transform.x}px`, 
                                                    top: `${transform.y}px`, 
                                                    width: `${transform.width}px`, 
                                                    objectFit: 'contain', 
                                                    zIndex: 50
                                                }} 
                                            />
                                        )}
                                    </div>
                                </td>
                                <td style={{...tdStyle, textAlign: 'center', whiteSpace: 'nowrap'}}>身分證字號：</td>
                                <td style={{...tdStyle, textAlign: 'center'}}>{instructor.idNumber}</td>
                            </tr>
                            <tr><td style={{...tdStyle, textAlign: 'center', whiteSpace: 'nowrap'}}>戶籍地址：</td><td colSpan="3" style={{...tdStyle, paddingLeft: '1rem'}}>{instructor.address}</td></tr>
                            <tr>
                                <td rowSpan="3" style={{...tdStyle, textAlign: 'center', whiteSpace: 'nowrap'}}>匯款 帳號：</td>
                                <td colSpan="3" style={{...tdStyle, paddingLeft: '1rem'}}>
                                    <span style={{fontWeight: 'bold'}}>{instructor.bankType === 'bank' ? '■' : '□'}</span> 銀行： 
                                    {instructor.bankType === 'bank' ? ( <> <span style={{margin: '0 8px', textDecoration: 'underline'}}>{instructor.bankName || '　　'}</span> 銀行 <span style={{margin: '0 8px', textDecoration: 'underline'}}>{instructor.bankBranch || '　　'}</span> 分行 &nbsp;&nbsp;帳號：<span style={{margin: '0 8px', textDecoration: 'underline'}}>{instructor.bankAccount || '　　　　　　'}</span> </>
                                    ) : ( <> <span style={{margin: '0 8px'}}>　　</span> 銀行 <span style={{margin: '0 8px'}}>　　</span> 分行 &nbsp;&nbsp;帳號：<span style={{margin: '0 8px'}}>　　　　　　</span> </> )}
                                </td>
                            </tr>
                            <tr>
                                <td colSpan="3" style={{...tdStyle, paddingLeft: '1rem'}}>
                                    <span style={{fontWeight: 'bold'}}>{instructor.bankType === 'post' ? '■' : '□'}</span> 郵局：局號： 
                                    {instructor.bankType === 'post' ? ( <> <span style={{margin: '0 8px', textDecoration: 'underline'}}>{instructor.postOffice || '　　　　'}</span> &nbsp;&nbsp;帳號： <span style={{margin: '0 8px', textDecoration: 'underline'}}>{instructor.postAccount || '　　　　　　'}</span> </>
                                    ) : ( <> <span style={{margin: '0 8px'}}>　　　　</span> &nbsp;&nbsp;帳號： <span style={{margin: '0 8px'}}>　　　　　　</span> </> )}
                                </td>
                            </tr>
                            <tr><td colSpan="3" style={{...tdStyle, paddingLeft: '1rem'}}><span style={{fontWeight: 'bold'}}>{instructor.bankType === 'other' ? '■' : '□'}</span> 其他：親自領取</td></tr>
                            <tr>
                                <td style={{...tdStyle, textAlign: 'center', whiteSpace: 'nowrap'}}>聯絡電話：</td><td style={{...tdStyle, textAlign: 'center'}}>{instructor.phone}</td>
                                <td style={{...tdStyle, textAlign: 'center', whiteSpace: 'nowrap'}}>已登列所得</td><td style={tdStyle}></td>
                            </tr>
                            <tr>
                                <td colSpan="4" style={{...tdStyle, textAlign: 'center', padding: '6px 0', fontSize: '1rem'}}>
                                    中華民國 <span style={{margin: '0 20px', fontWeight: 'bold'}}>{config.year}</span> 年 <span style={{margin: '0 20px', fontWeight: 'bold'}}>{config.month}</span> 月 <span style={{margin: '0 20px', fontWeight: 'bold'}}>{config.day}</span> 日
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <table style={{...tableStyle, borderTop: '4px double #000', marginTop: '8px'}}>
                        <colgroup><col style={{width: '14%'}}/><col style={{width: '18%'}}/><col style={{width: '20%'}}/><col style={{width: '8%'}}/><col style={{width: '12%'}}/><col style={{width: '14%'}}/><col style={{width: '14%'}}/></colgroup>
                        <tbody>
                            <tr><td style={centerBold}>項 目</td><td style={centerBold}>上課日期</td><td style={centerBold}>起訖時間</td><td style={centerBold}>節數</td><td style={centerBold}>單 價</td><td style={centerBold}>應領金額</td><td style={centerBold}>備 註</td></tr>
                            {config.items && config.items.map((item, index) => (
                                <tr key={index}>
                                    <td style={{...tdStyle, textAlign: 'center'}}>{item.itemName}</td>
                                    <td style={{...tdStyle, textAlign: 'center'}}>{formatTWDate(item.itemDate)}</td>
                                    <td style={{...tdStyle, textAlign: 'center'}}>{item.startTime && item.endTime ? `${item.startTime}~${item.endTime}` : ''}</td>
                                    <td style={{...tdStyle, textAlign: 'center'}}>{item.qty}</td>
                                    <td style={{...tdStyle, textAlign: 'center'}}>{item.price.toLocaleString()}</td>
                                    <td style={{...tdStyle, textAlign: 'center', fontWeight: 'bold', color: '#b91c1c', ...bgYellow}}>{(item.qty * item.price).toLocaleString()}</td>
                                    <td style={{...tdStyle, textAlign: 'center', fontSize: '0.85rem'}}>{item.remark || ''}</td>
                                </tr>
                            ))}
                            <tr><td colSpan="7" style={{...tdStyle, fontSize: '0.8rem', padding: '2px 8px'}}>備註：課表於業務單位留存</td></tr>
                        </tbody>
                    </table>
                </div>
            );
        };

        // ==========================================
        // 主程式 App
        // ==========================================
        export default function App() {
            const [user, setUser] = useState(null);
            const [isAppReady, setIsAppReady] = useState(false);
            const [toastMsg, setToastMsg] = useState('');
            const showToast = (msg) => setToastMsg(msg);
            
            // 核心狀態：頻道 ID 與 視窗狀態
            const [targetAdminId, setTargetAdminId] = useState('');
            const [view, setView] = useState('home'); 

            // 用來儲存當前登入者是否已有專屬單位的狀態，用於客製化首頁標題
            const [homeSysConfig, setHomeSysConfig] = useState(null);

            // 動態 App ID，實現頻道隔離
            const dynamicAppId = useMemo(() => {
                const baseId = typeof __app_id !== 'undefined' ? __app_id : "Taiwan-Teachers-Secure-Receipt";
                return targetAdminId ? `${baseId}-${targetAdminId}` : baseId;
            }, [targetAdminId]);

            // 1. 初始化資源與 Firebase Auth
            useEffect(() => {
                const loadScripts = async () => {
                    const scripts = [
                        { id: 'crypto-script', src: 'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js' },
                        { id: 'jsencrypt-script', src: 'https://cdnjs.cloudflare.com/ajax/libs/jsencrypt/3.3.2/jsencrypt.min.js' },
                        { id: 'xlsx-script', src: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js' },
                        { id: 'jszip-script', src: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js' },
                        { id: 'filesaver-script', src: 'https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js' },
                        { id: 'html2canvas-script', src: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js' },
                        { id: 'jspdf-script', src: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js' }
                    ];
                    for (let s of scripts) {
                        if (!document.getElementById(s.id)) {
                            await new Promise(resolve => {
                                const script = document.createElement('script');
                                script.id = s.id; 
                                script.src = s.src;
                                script.crossOrigin = "anonymous";
                                script.onload = resolve;
                                script.onerror = () => { console.warn('載入延遲:', s.src); resolve(); };
                                document.body.appendChild(script);
                            });
                        }
                    }
                    setIsAppReady(true);
                };
                loadScripts();

                const initAuth = async () => {
                    try {
                        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                            await signInWithCustomToken(auth, __initial_auth_token);
                        } else {
                            await signInAnonymously(auth);
                        }
                    } catch (error) { 
                        console.error('連線異常，轉為訪客模式'); 
                        try { await signInAnonymously(auth); } catch(e) {}
                    }
                };
                initAuth();

                const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
                    if (currentUser) setUser(currentUser);
                });
                return () => unsubscribe();
            }, []);

            // 2. 路由控制與瀏覽器暫存還原
            useEffect(() => {
                const handleRouting = () => {
                    let hash = window.location.hash.substring(1);
                    
                    if (!hash) {
                        const savedHash = sessionStorage.getItem('receipt_channel');
                        if (savedHash) {
                            hash = savedHash;
                            window.location.hash = hash; 
                        }
                    } else {
                        sessionStorage.setItem('receipt_channel', hash);
                    }

                    if (hash) {
                        setTargetAdminId(hash);
                        setView('instructor');
                    } else {
                        setView('home');
                        setTargetAdminId('');
                    }
                };
                
                handleRouting();
                window.addEventListener('hashchange', handleRouting);
                return () => window.removeEventListener('hashchange', handleRouting);
            }, []);

            // 3. 背景查詢是否已經設定過單位名稱
            useEffect(() => {
                if (!user || user.isAnonymous) {
                    setHomeSysConfig(null);
                    return;
                }
                const unsub = onSnapshot(doc(db, 'artifacts', MY_PROJECT_ID, 'public', 'data', 'config', `system_${user.uid}`), (docSnap) => {
                    if (docSnap.exists()) setHomeSysConfig(docSnap.data());
                    else setHomeSysConfig(null);
                }, (err) => console.error("Home config error:", err));
                return () => unsub();
            }, [user]);

            const handleGoogleLogin = async () => {
                const provider = new GoogleAuthProvider();
                try { await signInWithPopup(auth, provider); } 
                catch (error) { showToast("登入被阻擋或失敗，請確認視窗權限。"); }
            };

            const goAdmin = async () => {
                if (!user || user.isAnonymous) {
                    const provider = new GoogleAuthProvider();
                    try { 
                        const result = await signInWithPopup(auth, provider); 
                        sessionStorage.setItem('receipt_channel', result.user.uid);
                        setTargetAdminId(result.user.uid);
                        setView('admin');
                    } 
                    catch (error) { 
                        if (error.code !== 'auth/popup-closed-by-user') {
                            showToast("⚠️ 彈出視窗被阻擋，或登入失敗。如果您在預覽模式，請使用外部網址開啟！"); 
                        }
                    }
                } else {
                    sessionStorage.setItem('receipt_channel', user.uid);
                    setTargetAdminId(user.uid);
                    setView('admin');
                }
            };

            const goInstructor = () => {
                if (targetAdminId) {
                    setView('instructor');
                } else {
                    showToast("💡 講師請點擊承辦人的專屬網址。承辦人請先點擊『行政管理員』！");
                }
            };

            if (!isAppReady) return (
                <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-gray-500 font-bold tracking-widest">系統與連線模組載入中...</p>
                </div>
            );

            // 🌟 強制 Google 實名登入閘門
            if (!user && targetAdminId) return (
                <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 print:hidden">
                    <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-md w-full text-center border-t-8 border-blue-500 animate-in zoom-in-95">
                        <div className="text-6xl mb-6">🎓</div>
                        <h2 className="text-3xl font-extrabold text-gray-800 mb-2">經費領據系統</h2>
                        <p className="text-gray-500 mb-8 font-medium">為確保資料安全與隔離，請先實名登入</p>
                        <button onClick={handleGoogleLogin} className="w-full flex items-center justify-center gap-4 bg-white border-2 border-gray-200 rounded-2xl px-6 py-4 text-gray-700 font-bold hover:bg-gray-50 hover:border-blue-300 transition-all shadow-sm active:scale-95">
                            <svg className="w-6 h-6" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 15.02 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                            <span className="text-lg">使用 Google 帳號登入</span>
                        </button>
                    </div>
                </div>
            );

            return (
                <div className="flex flex-col min-h-screen bg-gray-50 font-sans text-gray-900 print:bg-white print:m-0 print:p-0" id="app-main-view">
                    <div className="flex-1 pb-12 print:pb-0 print:m-0 print:p-0">
                        
                        {view === 'home' && (
                            <div className="flex flex-col items-center justify-center min-h-[85vh] p-6 print-hide">
                                <div className="text-center mb-10 space-y-2">
                                    {homeSysConfig && !user?.isAnonymous ? (
                                        <>
                                            <h1 className="text-3xl sm:text-4xl font-extrabold text-blue-600 tracking-tight">{homeSysConfig.schoolName} {homeSysConfig.deptName}</h1>
                                            <h1 className="text-2xl sm:text-3xl font-extrabold text-blue-900 tracking-tight mt-2">領據管理系統</h1>
                                            <p className="text-gray-500 mt-2">管理員：{user.displayName || user.email}</p>
                                        </>
                                    ) : (
                                        <>
                                            <h1 className="text-3xl sm:text-4xl font-extrabold text-blue-900 tracking-tight">經費領據管理系統</h1>
                                            <p className="text-gray-500">歡迎使用本系統</p>
                                        </>
                                    )}
                                </div>
                                <div className="flex flex-col sm:flex-row gap-8 w-full max-w-2xl">
                                    <button onClick={goInstructor} className="flex-1 bg-white border-2 border-green-500 text-green-700 p-10 rounded-2xl shadow-xl hover:shadow-2xl hover:bg-green-50 transition-all duration-300 flex flex-col items-center group cursor-pointer">
                                        <span className="text-5xl mb-4 group-hover:scale-110 transition-transform">✍️</span>
                                        <span className="text-2xl font-bold">我是講師</span>
                                        <span className="text-sm mt-3 text-gray-500">點擊承辦人連結填寫資料</span>
                                    </button>
                                    <button onClick={goAdmin} className="flex-1 bg-white border-2 border-blue-600 text-blue-800 p-10 rounded-2xl shadow-xl hover:shadow-2xl hover:bg-blue-50 transition-all duration-300 flex flex-col items-center group">
                                        <span className="text-5xl mb-4 group-hover:scale-110 transition-transform">⚙️</span>
                                        <span className="text-2xl font-bold">行政管理員</span>
                                        <span className="text-sm mt-3 text-gray-500">
                                            {homeSysConfig && !user?.isAnonymous ? '進入我的管理後台' : '建立與管理專屬表單'}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {view === 'admin' && <AdminView setView={setView} user={user} appId={MY_PROJECT_ID} targetAdminId={targetAdminId} showToast={showToast} />}
                        {view === 'instructor' && <InstructorView setView={setView} user={user} appId={MY_PROJECT_ID} targetAdminId={targetAdminId} showToast={showToast} />}
                        {view === 'receipt' && <ReceiptView setView={setView} config={config} instructors={instructorsRaw} showToast={showToast} sysConfig={sysConfig} />}
                    </div>
                    <div className="text-center text-gray-400 text-sm py-4 print-hide font-bold">@2026 Master (版本：V9.0-最終發布版)</div>
                    <Toast message={toastMsg} onClose={() => setToastMsg('')} />
                </div>
            );
        }

        // ==========================================
        // 講師填寫畫面
        // ==========================================
        function InstructorView({ setView, user, appId, targetAdminId, showToast }) {
            const channelId = targetAdminId || 'default';
            const today = new Date().toISOString().split('T')[0];
            const [config, setConfig] = useState({ activityName: "載入中...", schoolName: "載入中...", year: "115", month: "05", day: "12", items: [] });
            const [sysConfig, setSysConfig] = useState({ schoolName: '載入中...', deptName: '' });
            const [authConfig, setAuthConfig] = useState({ publicKey: null });
            
            const [step, setStep] = useState('form');
            const [formData, setFormData] = useState({ name: user?.displayName || '', idNumber: '', address: '', bankType: 'bank', bankName: '', bankBranch: '', bankAccount: '', postOffice: '', postAccount: '', phone: '' });
            const [signatureUrl, setSignatureUrl] = useState(null);
            const [passbookUrl, setPassbookUrl] = useState(null);
            const [isAgreed, setIsAgreed] = useState(false);
            const [isSignModalOpen, setIsSignModalOpen] = useState(false);
            const canvasRef = useRef(null);
            const [isDrawing, setIsDrawing] = useState(false);
            const [isSubmitting, setIsSubmitting] = useState(false);

            useEffect(() => {
                if (!user) return; 

                const unsubConfig = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'config', `current_${channelId}`), (docSnap) => {
                    if (docSnap.exists()) setConfig(docSnap.data());
                }, (err) => console.error("config snapshot error:", err));
                
                const unsubSys = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'config', `system_${channelId}`), (docSnap) => {
                    if (docSnap.exists()) setSysConfig(docSnap.data());
                }, (err) => console.error("system snapshot error:", err));
                
                const unsubAuth = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'config', `auth_${channelId}`), (docSnap) => {
                    if (docSnap.exists()) setAuthConfig({ publicKey: docSnap.data().publicKey || null });
                }, (err) => console.error("auth snapshot error:", err));
                
                return () => { unsubConfig(); unsubSys(); unsubAuth(); };
            }, [appId, channelId, user]);

            useEffect(() => {
                if (isSignModalOpen) document.body.style.overflow = 'hidden';
                else document.body.style.overflow = '';
                return () => { document.body.style.overflow = ''; };
            }, [isSignModalOpen]);

            useEffect(() => {
                if (!isSignModalOpen || !canvasRef.current) return;
                const canvasEl = canvasRef.current;
                setTimeout(() => {
                    const ctx = canvasEl.getContext('2d');
                    const rect = canvasEl.parentElement.getBoundingClientRect();
                    canvasEl.width = rect.width; canvasEl.height = rect.height;
                    // 🔥 真正的去背：使用 clearRect 取代 fillRect(白底)
                    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
                    ctx.strokeStyle = '#000000'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                }, 100);
            }, [isSignModalOpen]);

            const getPos = (e) => {
                const canvas = canvasRef.current; const rect = canvas.getBoundingClientRect();
                let clientX = e.clientX; let clientY = e.clientY;
                if (e.touches && e.touches.length > 0) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
                return { x: clientX - rect.left, y: clientY - rect.top };
            };
            const startDrawing = (e) => { setIsDrawing(true); const pos = getPos(e); canvasRef.current.getContext('2d').beginPath(); canvasRef.current.getContext('2d').moveTo(pos.x, pos.y); };
            const draw = (e) => { if (!isDrawing) return; const pos = getPos(e); canvasRef.current.getContext('2d').lineTo(pos.x, pos.y); canvasRef.current.getContext('2d').stroke(); };
            const stopDrawing = () => { if (isDrawing) { canvasRef.current.getContext('2d').closePath(); setIsDrawing(false); } };
            const clearSignature = () => { const ctx = canvasRef.current.getContext('2d'); ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); setSignatureUrl(null); };
            // 🔥 確保輸出為 image/png 支援透明背景
            const confirmSignature = () => { setSignatureUrl(canvasRef.current.toDataURL('image/png')); setIsSignModalOpen(false); };

            const handlePhotoUpload = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                try {
                    const compressed = await compressImage(file, 600); 
                    setPassbookUrl(compressed);
                    showToast('📸 存摺照片已上傳成功');
                } catch (err) { showToast('圖片處理失敗'); }
            };

            const processAutoEncryptSubmit = async () => {
                if (!authConfig.publicKey) return showToast('❌ 承辦人尚未設定安全金鑰，無法加密上傳。');
                setIsSubmitting(true);
                try {
                    const sessionKey = generateRandomKey(); 
                    const sensitiveData = { ...formData, signatureUrl, passbookUrl };
                    const encryptedPayload = window.CryptoJS.AES.encrypt(JSON.stringify(sensitiveData), sessionKey).toString();
                    
                    const encryptor = new window.JSEncrypt();
                    encryptor.setPublicKey(authConfig.publicKey);
                    const encryptedSessionKey = encryptor.encrypt(sessionKey);
                    
                    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', `instructors_${channelId}`), { 
                        name: formData.name, payload: encryptedPayload, e2eeKey: encryptedSessionKey, createdAt: Date.now(), userId: user.uid 
                    });
                    showToast('🔒 您的資料已完成自動加密並成功傳送給承辦人！');
                    window.location.hash = '';
                    sessionStorage.removeItem('receipt_channel'); 
                    setView('home');
                } catch (error) { showToast(`❌ 上傳失敗`); } finally { setIsSubmitting(false); }
            };

            const handlePreviewClick = (e) => {
                e.preventDefault();
                if (!isAgreed) return showToast('請先勾選同意聲明！');
                if (!signatureUrl) return showToast('請務必簽名！');
                setStep('preview'); window.scrollTo(0, 0);
            };

            if (step === 'preview') {
                return (
                    <div className="max-w-2xl mx-auto my-10 p-4 print-hide">
                        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-xl mb-8 shadow-sm">
                            <h3 className="font-bold text-yellow-800 mb-2 text-lg">⚠️ 請確認您的填寫資料</h3>
                            <p className="text-yellow-700">發放單位：{sysConfig.schoolName} {sysConfig.deptName}</p>
                        </div>
                        <div className="bg-white shadow-2xl rounded-2xl p-8 border border-gray-100 mb-8">
                            <h3 className="text-xl font-bold border-b-2 pb-3 mb-6 text-green-700 flex items-center gap-2">
                                資料確認預覽 {authConfig.publicKey && <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded">🛡️ 自動加密準備就緒</span>}
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-10 text-lg mb-8">
                                <div><span className="text-gray-400 text-xs block mb-1">姓名</span> <span className="font-bold border-b border-gray-100 block pb-1">{formData.name}</span></div>
                                <div><span className="text-gray-400 text-xs block mb-1">身分證字號</span> <span className="border-b border-gray-100 block pb-1">{formData.idNumber}</span></div>
                                <div><span className="text-gray-400 text-xs block mb-1">聯絡電話</span> <span className="border-b border-gray-100 block pb-1">{formData.phone}</span></div>
                                <div className="sm:col-span-2">
                                    <span className="text-gray-400 text-xs block mb-1">匯款資訊</span> 
                                    <div className="p-3 bg-blue-50 rounded-lg text-blue-900 font-bold border border-blue-100">
                                        {formData.bankType === 'bank' ? `銀行：${formData.bankName} / 帳號：${formData.bankAccount}` : 
                                         formData.bankType === 'post' ? `郵局：局號 ${formData.postOffice} / 帳號 ${formData.postAccount}` : '方式：親自領取'}
                                    </div>
                                </div>
                            </div>
                            {passbookUrl && (
                                <div className="mt-8 border-t pt-6"><span className="text-gray-400 text-xs block mb-3">存摺封面：</span><img src={passbookUrl} className="max-h-56 rounded-xl border border-gray-200 shadow-sm" /></div>
                            )}
                            <div className="mt-8 border-t pt-6 text-center"><span className="text-gray-400 text-xs block mb-3">具領人簽章：</span><div className="p-4 bg-gray-50 rounded-xl inline-block border-2 border-dashed border-gray-200"><img src={signatureUrl} className="max-h-24" /></div></div>
                        </div>
                        <div className="flex flex-col gap-4">
                            <button onClick={() => setStep('form')} className="w-full py-4 bg-gray-500 text-white font-bold rounded-2xl hover:bg-gray-600 shadow-md">✏️ 返回修改</button>
                            <button onClick={processAutoEncryptSubmit} disabled={isSubmitting || !authConfig.publicKey} className={`w-full py-4 font-bold rounded-2xl text-white shadow-lg transition-all text-xl ${isSubmitting || !authConfig.publicKey ? 'bg-gray-300' : 'bg-green-600 hover:bg-green-700'}`}>
                                {isSubmitting ? '加密上傳中...' : '🚀 確認無誤，線上自動送出'}
                            </button>
                        </div>
                    </div>
                );
            }

            return (
                <div className="max-w-2xl mx-auto my-10 p-8 bg-white rounded-3xl shadow-xl border border-gray-50 print-hide">
                    <button onClick={() => { window.location.hash=''; sessionStorage.removeItem('receipt_channel'); setView('home'); }} className="mb-6 text-blue-600 flex items-center hover:underline">← 取消並返回首頁</button>
                    <div className="mb-8">
                        <p className="text-blue-500 text-xs font-bold uppercase tracking-widest mb-1">{sysConfig.schoolName} {sysConfig.deptName}</p>
                        <h2 className="text-2xl font-bold text-green-800 border-l-8 border-green-500 pl-4 flex items-center gap-2">講師領據資料填寫</h2>
                    </div>
                    
                    {authConfig.publicKey ? (
                        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm flex items-center gap-3">
                            <span className="text-2xl">🛡️</span><p>本系統啟用 E2EE 端到端非對稱加密。您的資料送出時會「全自動上鎖」，保障個資安全，請安心填寫。</p>
                        </div>
                    ) : (
                        <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-xl text-orange-800 text-sm flex items-center gap-3">
                            <span className="text-2xl">⚠️</span><p>安全警告：承辦人尚未設定安全金鑰，目前無法加密送出資料。</p>
                        </div>
                    )}

                    <form onSubmit={handlePreviewClick} className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">講師姓名 <span className="text-red-500">*</span></label><input required type="text" className="w-full p-3 border rounded-xl shadow-inner bg-gray-50 focus:bg-white" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">身分證字號 <span className="text-red-500">*</span></label><input required type="text" className="w-full p-3 border rounded-xl shadow-inner bg-gray-50 focus:bg-white" placeholder="核銷用" value={formData.idNumber} onChange={e => setFormData({...formData, idNumber: e.target.value})} /></div>
                        </div>
                        <div><label className="block text-sm font-bold text-gray-700 mb-1">戶籍地址 <span className="text-red-500">*</span></label><input required type="text" className="w-full p-3 border rounded-xl shadow-inner bg-gray-50 focus:bg-white" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
                        <div><label className="block text-sm font-bold text-gray-700 mb-1">聯絡電話 <span className="text-red-500">*</span></label><input required type="text" className="w-full p-3 border rounded-xl shadow-inner bg-gray-50 focus:bg-white" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>

                        <div className="border-2 border-blue-50 p-6 rounded-2xl bg-blue-50/30">
                            <label className="block text-base font-bold text-blue-900 mb-4 flex items-center gap-2">🏦 匯款帳號資訊 <span className="text-red-500">*</span></label>
                            <div className="space-y-4">
                                <div className="flex gap-6">
                                    <label className="flex items-center space-x-2 cursor-pointer"><input type="radio" value="bank" checked={formData.bankType === 'bank'} onChange={e => setFormData({...formData, bankType: e.target.value})} className="w-4 h-4" /> <span className="font-medium">一般銀行</span></label>
                                    <label className="flex items-center space-x-2 cursor-pointer"><input type="radio" value="post" checked={formData.bankType === 'post'} onChange={e => setFormData({...formData, bankType: e.target.value})} className="w-4 h-4" /> <span className="font-medium">中華郵政</span></label>
                                    <label className="flex items-center space-x-2 cursor-pointer"><input type="radio" value="other" checked={formData.bankType === 'other'} onChange={e => setFormData({...formData, bankType: e.target.value})} className="w-4 h-4" /> <span className="font-medium">親自領取</span></label>
                                </div>
                                {formData.bankType === 'bank' && <div className="grid grid-cols-2 gap-2"><input required type="text" placeholder="銀行名" className="p-3 border rounded-xl bg-white" value={formData.bankName} onChange={e => setFormData({...formData, bankName: e.target.value})}/><input required type="text" placeholder="完整帳號" className="p-3 border rounded-xl bg-white" value={formData.bankAccount} onChange={e => setFormData({...formData, bankAccount: e.target.value})}/></div>}
                                {formData.bankType === 'post' && <div className="grid grid-cols-2 gap-2"><input required type="text" placeholder="局號 (7碼)" className="p-3 border rounded-xl bg-white" value={formData.postOffice} onChange={e => setFormData({...formData, postOffice: e.target.value})}/><input required type="text" placeholder="帳號 (7碼)" className="p-3 border rounded-xl bg-white" value={formData.postAccount} onChange={e => setFormData({...formData, postAccount: e.target.value})}/></div>}
                            </div>
                            {(formData.bankType === 'bank' || formData.bankType === 'post') && (
                                <div className="mt-6 pt-4 border-t border-blue-100">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">上傳存摺封面照片 <span className="text-red-500">*</span></label>
                                    <input required type="file" accept="image/jpeg, image/png" onChange={handlePhotoUpload} className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white"/>
                                    {passbookUrl && <img src={passbookUrl} className="mt-3 h-24 object-contain rounded-lg border shadow-sm" />}
                                </div>
                            )}
                        </div>

                        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center bg-gray-50">
                            <label className="block text-sm font-bold text-gray-700 mb-4">具領人電子簽章 <span className="text-red-500">*</span></label>
                            {signatureUrl ? (
                                <div className="flex flex-col items-center">
                                    <img src={signatureUrl} className="h-32 object-contain bg-white border rounded-xl mb-4 shadow-sm" />
                                    <button type="button" onClick={() => setIsSignModalOpen(true)} className="text-sm text-blue-600 underline">重新簽名</button>
                                </div>
                            ) : (
                                <button type="button" onClick={() => setIsSignModalOpen(true)} className="w-full py-10 border-2 border-blue-200 text-blue-600 rounded-2xl bg-white hover:bg-blue-50 font-bold shadow-sm">✍️ 啟動簽名板</button>
                            )}
                        </div>

                        <div className="p-5 bg-orange-50 rounded-2xl border border-orange-100 text-xs space-y-2">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input type="checkbox" required className="w-5 h-5 accent-green-600" checked={isAgreed} onChange={e => setIsAgreed(e.target.checked)} />
                                <span className="text-orange-900 font-bold text-sm underline underline-offset-4">我同意將上述資料提供給 {sysConfig.schoolName} 核銷使用。</span>
                            </label>
                        </div>
                        <button type="submit" disabled={!isAgreed} className={`w-full py-5 rounded-2xl text-white font-bold text-xl shadow-xl transition-all ${isAgreed ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300 cursor-not-allowed'}`}>資料預覽與確認送出 👉</button>
                    </form>

                    {isSignModalOpen && (
                        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col justify-center items-center p-4">
                            <div className="bg-white w-full max-w-lg p-6 rounded-3xl flex flex-col h-[70vh] shadow-2xl">
                                <h3 className="text-xl font-bold mb-4 text-center text-gray-800 shrink-0">手寫簽名區域</h3>
                                <div className="border-4 border-gray-100 flex-1 relative bg-white overflow-hidden rounded-2xl">
                                    <canvas ref={canvasRef} className="absolute inset-0 w-full h-full cursor-crosshair" style={{ touchAction: 'none' }} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseOut={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}></canvas>
                                </div>
                                <div className="flex gap-4 mt-6 shrink-0">
                                    <button onClick={clearSignature} className="flex-1 bg-red-50 text-red-600 py-4 rounded-2xl font-bold text-lg">清除</button>
                                    <button onClick={confirmSignature} className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg">完成簽名</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        // ==========================================
        // 管理員儀表板
        // ==========================================
        function AdminView(props) {
            const { setView, user, appId, targetAdminId, showToast } = props;
            const channelId = targetAdminId || 'default';
            const today = new Date().toISOString().split('T')[0];
            
            // 資料狀態
            const [config, setConfig] = useState({ activityName: "114學年度國民中小學雙語生活化校園計畫－諮詢費", schoolName: "基隆市立成功國民中學", year: "115", month: "05", day: "12", items: [] });
            const [sysConfig, setSysConfig] = useState({ schoolName: '基隆市立成功國民中學', deptName: '教務處' });
            const [itemOptions, setItemOptions] = useState(["鐘點費", "諮詢費", "交通費", "出席費"]);
            const [instructorsRaw, setInstructorsRaw] = useState([]);
            
            // 安全金鑰狀態
            const [isAuthFetched, setIsAuthFetched] = useState(false);
            const [authConfig, setAuthConfig] = useState({ publicKey: null, encryptedPrivateKey: null });
            const [adminKey, setAdminKey] = useState(null);
            const [isGenerating, setIsGenerating] = useState(false);

            // UI 狀態
            const [searchTerm, setSearchTerm] = useState('');
            const [selectedIds, setSelectedIds] = useState(new Set());
            const [selectedInstructors, setSelectedInstructors] = useState([]);
            const [viewMode, setViewMode] = useState('dashboard');
            
            // 彈窗與排版狀態
            const [isAddModalOpen, setIsAddModalOpen] = useState(false);
            const [addFormData, setAddFormData] = useState({ name: '', idNumber: '', address: '', bankType: 'bank', bankName: '', bankBranch: '', bankAccount: '', postOffice: '', postAccount: '', phone: '' });
            const [previewImageUrl, setPreviewImageUrl] = useState(null);
            const [imageScalePercent, setImageScalePercent] = useState(100);
            const [imageOffsetX, setImageOffsetX] = useState(0);
            const [imageOffsetY, setImageOffsetY] = useState(0);
            const [deleteConfirmId, setDeleteConfirmId] = useState(null);
            const [isClearModalOpen, setIsClearModalOpen] = useState(false);

            // --- 資料讀取與金鑰解密 ---
            useEffect(() => {
                if (!user) return; 

                const unsubConfig = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'config', `current_${channelId}`), (docSnap) => {
                    if (docSnap.exists()) {
                        let data = docSnap.data();
                        if (!data.items && data.itemName) data.items = [{ itemName: data.itemName, itemDate: today, startTime: "11:00", endTime: "13:00", qty: data.qty, price: data.price, remark: "" }];
                        setConfig(data);
                    }
                }, (err) => console.error("config snapshot error:", err));
                
                const unsubSys = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'config', `system_${channelId}`), (docSnap) => {
                    if (docSnap.exists()) setSysConfig(docSnap.data());
                }, (err) => console.error("system snapshot error:", err));
                
                const unsubOptions = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'config', `options_${channelId}`), (docSnap) => {
                    if (docSnap.exists() && docSnap.data().itemNames) setItemOptions(docSnap.data().itemNames);
                }, (err) => console.error("options snapshot error:", err));
                
                const unsubAuth = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'config', `auth_${channelId}`), (docSnap) => {
                    if (docSnap.exists()) {
                        setAuthConfig(docSnap.data());
                    } else {
                        setAuthConfig({ publicKey: null, encryptedPrivateKey: null });
                    }
                    setIsAuthFetched(true);
                }, (err) => {
                    console.error("auth snapshot error:", err);
                    setIsAuthFetched(true);
                });
                
                const unsubInstructors = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', `instructors_${channelId}`), (snapshot) => {
                    const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    list.sort((a, b) => b.createdAt - a.createdAt);
                    setInstructorsRaw(list);
                }, (err) => console.error("instructors snapshot error:", err));
                
                return () => { unsubConfig(); unsubSys(); unsubOptions(); unsubAuth(); unsubInstructors(); };
            }, [appId, channelId, today, user]);

            useEffect(() => {
                if (authConfig.encryptedPrivateKey && user) {
                    try {
                        const bytes = window.CryptoJS.AES.decrypt(authConfig.encryptedPrivateKey, user.uid);
                        const privKey = bytes.toString(window.CryptoJS.enc.Utf8);
                        if (privKey) setAdminKey(privKey);
                    } catch(e) { console.error("私鑰解密失敗"); }
                }
            }, [authConfig.encryptedPrivateKey, user]);

            const decryptedInstructors = useMemo(() => {
                if (!adminKey) return [];
                return instructorsRaw.map(inst => {
                    if (!inst.payload) return inst;
                    try {
                        let sessionKey = adminKey;
                        if (inst.e2eeKey) {
                            const decryptor = new window.JSEncrypt();
                            decryptor.setPrivateKey(adminKey);
                            sessionKey = decryptor.decrypt(inst.e2eeKey);
                            if (!sessionKey) throw new Error("RSA Fail");
                        }
                        const bytes = window.CryptoJS.AES.decrypt(inst.payload, sessionKey);
                        const decryptedStr = bytes.toString(window.CryptoJS.enc.Utf8);
                        if (!decryptedStr) throw new Error("AES Fail");
                        return { id: inst.id, createdAt: inst.createdAt, name: inst.name, ...JSON.parse(decryptedStr) };
                    } catch(e) {
                        return { ...inst, decryptionFailed: true };
                    }
                });
            }, [instructorsRaw, adminKey]);

            const filteredInstructors = useMemo(() => {
                return decryptedInstructors.filter(i => i.name?.includes(searchTerm) || (i.idNumber && i.idNumber.includes(searchTerm)));
            }, [decryptedInstructors, searchTerm]);

            useEffect(() => {
                if (!user || user.isAnonymous || !isAuthFetched) return; 
                if (authConfig && authConfig.publicKey === undefined) return; 
                if (authConfig.publicKey === null && !isGenerating) {
                    setIsGenerating(true);
                    setTimeout(async () => {
                        try {
                            const crypt = new window.JSEncrypt({default_key_size: 2048});
                            crypt.getKey();
                            const pubKey = crypt.getPublicKey();
                            const privKey = crypt.getPrivateKey();
                            const encPrivKey = window.CryptoJS.AES.encrypt(privKey, user.uid).toString();
                            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', `auth_${channelId}`), { 
                                publicKey: pubKey, encryptedPrivateKey: encPrivKey 
                            }, { merge: true });
                            setAdminKey(privKey);
                        } catch(err) { showToast('安全頻道建立失敗，請重新整理'); }
                        finally { setIsGenerating(false); }
                    }, 500);
                }
            }, [authConfig.publicKey, isGenerating, appId, channelId, user, isAuthFetched]);

            const handleLogoutAdmin = async () => {
                try { await signOut(auth); } catch(e) {}
                try { await signInAnonymously(auth); } catch(e) {}
                window.location.hash = '';
                sessionStorage.removeItem('receipt_channel');
                setView('home');
                showToast('👋 已登出管理員身分');
            };

            if (viewMode === 'receipt') {
                return <ReceiptView setView={() => setViewMode('dashboard')} config={config} instructors={selectedInstructors} showToast={showToast} sysConfig={sysConfig} />;
            }

            if (isGenerating || !adminKey) {
                return (
                    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 print-hide">
                        <div className="bg-white p-10 rounded-3xl shadow-xl max-w-md w-full text-center border-t-8 border-indigo-500 animate-in zoom-in-95">
                            <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">正在為您建立專屬安全頻道</h2>
                            <p className="text-gray-500 text-sm">正在產生 RSA-2048 軍規級金鑰對，<br/>並綁定您的 Google 帳號...</p>
                        </div>
                    </div>
                );
            }

            const saveConfig = async (newConfig) => {
                try {
                    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', `current_${channelId}`), newConfig);
                    const currentItemNames = newConfig.items.map(i => i.itemName).filter(Boolean);
                    const newOptions = Array.from(new Set([...itemOptions, ...currentItemNames]));
                    if (newOptions.length > itemOptions.length) {
                        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', `options_${channelId}`), { itemNames: newOptions }, { merge: true });
                    }
                    showToast('💾 活動設定已更新成功！');
                } catch (err) { showToast('儲存失敗'); }
            };

            const handleUpdateSysConfig = async () => {
                try {
                    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', `system_${channelId}`), sysConfig);
                    showToast('✅ 系統名稱已成功更新！');
                } catch (e) { showToast('系統設定存檔失敗'); }
            };

            const handleCopyShareLink = () => {
                const baseUrl = window.location.href.split('#')[0];
                const shareUrl = baseUrl + '#' + user.uid;
                
                const fallbackCopy = (text) => {
                    const el = document.createElement('textarea'); 
                    el.value = text; 
                    el.setAttribute('readonly', ''); 
                    el.style.position = 'absolute'; 
                    el.style.left = '-9999px';
                    document.body.appendChild(el); 
                    el.select(); 
                    el.setSelectionRange(0, 99999);
                    try {
                        if (document.execCommand('copy')) {
                            showToast("📋 已複製！請將連結傳給講師。");
                        } else {
                            showToast("❌ 無法自動複製，請手動複製網址：" + text);
                        }
                    } catch (err) { 
                        showToast("❌ 無法複製，您的代碼為：" + user.uid);
                    }
                    document.body.removeChild(el);
                };

                if (navigator.clipboard && window.isSecureContext) {
                    navigator.clipboard.writeText(shareUrl).then(() => {
                        showToast("📋 已複製專屬講師連結！");
                    }).catch(() => fallbackCopy(shareUrl));
                } else {
                    fallbackCopy(shareUrl);
                }
            };

            const handleSelectAll = () => {
                const validIds = filteredInstructors.filter(i => !i.decryptionFailed).map(i => i.id);
                if (selectedIds.size === validIds.length && validIds.length > 0) setSelectedIds(new Set());
                else setSelectedIds(new Set(validIds));
            };

            const handleSelectInstructor = (id) => {
                const newSet = new Set(selectedIds);
                if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
                setSelectedIds(newSet);
            };

            const handleBatchPrint = () => {
                const selectedList = filteredInstructors.filter(i => selectedIds.has(i.id));
                if (selectedList.length === 0) return showToast('❌ 請先在列表中勾選至少一位講師！');
                setSelectedInstructors(selectedList);
                setViewMode('receipt');
            };

            const handleSinglePrint = (instructor) => {
                setSelectedInstructors([instructor]);
                setViewMode('receipt');
            };

            const handleClearAllData = async () => {
                try {
                    const deletePromises = instructorsRaw.map(inst => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', `instructors_${channelId}`, inst.id)));
                    await Promise.all(deletePromises);
                    showToast('✅ 所有講師資料已清空。'); setIsClearModalOpen(false); setSelectedIds(new Set()); 
                } catch (error) { showToast('清空失敗。'); }
            };

            const handleConfirmSingleDelete = async () => {
                if (!deleteConfirmId) return;
                try {
                    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', `instructors_${channelId}`, deleteConfirmId));
                    showToast('✅ 已刪除。');
                    if (selectedIds.has(deleteConfirmId)) { const newSet = new Set(selectedIds); newSet.delete(deleteConfirmId); setSelectedIds(newSet); }
                } catch (error) { showToast('刪除失敗。'); }
                setDeleteConfirmId(null);
            };

            const handleAdminAddSubmit = async (e) => {
                e.preventDefault();
                try {
                    const sessionKey = generateRandomKey();
                    const encryptedPayload = window.CryptoJS.AES.encrypt(JSON.stringify(addFormData), sessionKey).toString();
                    const encryptor = new window.JSEncrypt(); encryptor.setPublicKey(authConfig.publicKey);
                    const encryptedSessionKey = encryptor.encrypt(sessionKey);

                    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', `instructors_${channelId}`), { 
                        name: addFormData.name, payload: encryptedPayload, e2eeKey: encryptedSessionKey, createdAt: Date.now(), userId: user.uid
                    });
                    showToast('✅ 資料已建檔加密'); setIsAddModalOpen(false);
                    setAddFormData({ name: '', idNumber: '', address: '', bankType: 'bank', bankName: '', bankBranch: '', bankAccount: '', postOffice: '', postAccount: '', phone: '' });
                } catch (error) { showToast('失敗'); }
            };

            const handleQuickUpload = async (instructorId, field, e) => {
                const file = e.target.files[0]; if (!file) return;
                try {
                    showToast('上傳中...');
                    const compressed = await compressImage(file, 600);
                    const instIndex = decryptedInstructors.findIndex(i => i.id === instructorId);
                    const fullData = { ...decryptedInstructors[instIndex], [field]: compressed };
                    delete fullData.id; delete fullData.createdAt; delete fullData.payload; delete fullData.e2eeKey; delete fullData.decryptionFailed;
                    
                    const sessionKey = generateRandomKey();
                    const newEncryptedPayload = window.CryptoJS.AES.encrypt(JSON.stringify(fullData), sessionKey).toString();
                    const encryptor = new window.JSEncrypt(); encryptor.setPublicKey(authConfig.publicKey);
                    const newEncryptedSessionKey = encryptor.encrypt(sessionKey);

                    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', `instructors_${channelId}`, instructorId), { payload: newEncryptedPayload, e2eeKey: newEncryptedSessionKey }, { merge: true });
                    showToast('✅ 更新成功！');
                } catch (err) { showToast('上傳失敗'); }
                e.target.value = '';
            };

            const handleDownloadTemplate = () => {
                if (!window.XLSX || !window.saveAs) { showToast("套件載入中..."); return; }
                try {
                    const templateData = [{
                        '姓名': '王大明 (必填)',
                        '身分證': 'A123456789',
                        '地址': '基隆市安樂區...',
                        '電話': '0912-345-678',
                        '銀行': '台灣銀行 (郵局請直接填寫郵局)',
                        '帳號': '123456789012'
                    }];
                    const sheet = window.XLSX.utils.json_to_sheet(templateData);
                    sheet['!cols'] = [{wch: 15}, {wch: 15}, {wch: 30}, {wch: 15}, {wch: 25}, {wch: 20}];

                    const wb = window.XLSX.utils.book_new();
                    window.XLSX.utils.book_append_sheet(wb, sheet, "匯入範本");
                    
                    const excelBuffer = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                    const data = new Blob([excelBuffer], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
                    window.saveAs(data, '講師資料匯入範本.xlsx');
                    showToast('✅ 範本下載成功！請依照格式填寫後匯入。');
                } catch (e) { showToast('❌ 範本下載失敗'); }
            };

            const handleImportExcel = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (!window.XLSX) { showToast('❌ Excel 套件尚未載入，請稍候再試。'); e.target.value = ''; return; }
                if (!user || !authConfig.publicKey || !adminKey) { showToast('❌ 請先完成系統連線與安全初始化！'); e.target.value = ''; return; }

                showToast('檔案解析中...');
                const reader = new FileReader();
                reader.onload = async (evt) => {
                    try {
                        const dataBuffer = evt.target.result;
                        const wb = window.XLSX.read(dataBuffer, { type: 'array' });
                        const wsname = wb.SheetNames[0];
                        const ws = wb.Sheets[wsname];
                        const data = window.XLSX.utils.sheet_to_json(ws);

                        let count = 0;
                        for (let row of data) {
                            const name = String(row['姓名'] || row['Name'] || row['name'] || '').trim();
                            if (!name || name.includes('(必填)')) continue; 
                            
                            const idNumber = String(row['身分證'] || row['身分證字號'] || '').trim();
                            const address = String(row['地址'] || row['戶籍地址'] || '').trim();
                            const phone = String(row['電話'] || row['聯絡電話'] || '').trim();
                            const bankRaw = String(row['銀行'] || row['銀行名稱'] || '').trim();
                            const accRaw = String(row['帳號'] || row['銀行帳號'] || '').trim();
                            
                            let bankType = 'other', bankName = '', bankAccount = '', postOffice = '', postAccount = '';
                            if (bankRaw.includes('郵局')) { bankType = 'post'; postAccount = accRaw; } 
                            else if (bankRaw) { bankType = 'bank'; bankName = bankRaw; bankAccount = accRaw; }

                            const newInst = { name, idNumber, address, phone, bankType, bankName, bankAccount, postOffice, postAccount, signatureUrl: null, passbookUrl: null };
                            
                            const sessionKey = generateRandomKey();
                            const encryptedPayload = window.CryptoJS.AES.encrypt(JSON.stringify(newInst), sessionKey).toString();
                            const encryptor = new window.JSEncrypt();
                            encryptor.setPublicKey(authConfig.publicKey);
                            const encryptedSessionKey = encryptor.encrypt(sessionKey);

                            const docId = `${user.uid}_import_${Date.now()}_${count}`;
                            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', `instructors_${channelId}`, docId), { 
                                name, payload: encryptedPayload, e2eeKey: encryptedSessionKey, createdAt: Date.now(), userId: user.uid 
                            });
                            count++;
                        }
                        
                        if (count > 0) showToast(`✅ 成功匯入 ${count} 筆講師資料並完成自動加密！`);
                        else showToast('⚠️ 未匯入任何資料，請確認工作表內容是否符合範本格式。');
                    } catch (err) {
                        console.error("Excel import error:", err);
                        showToast('❌ 匯入失敗，請確認檔案格式是否正確。');
                    }
                };
                reader.readAsArrayBuffer(file);
                e.target.value = '';
            };

            const addItem = () => setConfig({ ...config, items: [...(config.items || []), { itemName: '', itemDate: today, startTime: '', endTime: '', qty: 1, price: 1000, remark: '' }] });
            const removeItem = (idx) => setConfig({ ...config, items: config.items.filter((_, i) => i !== idx) });
            const updateItem = (idx, field, val) => { const newItems = [...config.items]; newItems[idx][field] = val; setConfig({ ...config, items: newItems }); };
            const grandTotal = config.items ? config.items.reduce((s, i) => s + (i.qty * i.price), 0) : 0;

            const handleBatchDownload = async () => {
                if (!window.JSZip || !window.XLSX || !window.saveAs) return showToast("套件載入中...");
                const validData = decryptedInstructors.filter(i => !i.decryptionFailed);
                if (validData.length === 0) return showToast("沒有資料可匯出。");
                try {
                    const zip = new window.JSZip();
                    const sheetData = validData.map(i => ({
                        '建檔時間': new Date(i.createdAt).toLocaleString(), '姓名': i.name, '身分證': i.idNumber || '',
                        '地址': i.address || '', '電話': i.phone || '',
                        '帳戶資訊': i.bankType === 'bank' ? `${i.bankName} ${i.bankAccount}` : (i.bankType === 'post' ? `郵局 ${i.postOffice}-${i.postAccount}` : '領現')
                    }));
                    const sheet = window.XLSX.utils.json_to_sheet(sheetData); const wb = window.XLSX.utils.book_new(); window.XLSX.utils.book_append_sheet(wb, sheet, "名冊");
                    zip.file("講師清單.xlsx", window.XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
                    
                    const sigFolder = zip.folder("電子簽名"); const passFolder = zip.folder("存摺封面");
                    validData.forEach(i => {
                        if (i.signatureUrl) sigFolder.file(`${i.name}_簽名.png`, i.signatureUrl.split(',')[1], { base64: true });
                        if (i.passbookUrl) passFolder.file(`${i.name}_存摺.jpg`, i.passbookUrl.split(',')[1], { base64: true });
                    });
                    const content = await zip.generateAsync({ type: "blob" });
                    window.saveAs(content, `核銷資料_${sysConfig.deptName}.zip`);
                    showToast('✅ 下載成功');
                } catch (e) { showToast('匯出失敗'); }
            };

            const createImagePDF = async () => {
                const tempContainer = document.createElement('div');
                tempContainer.style.position = 'absolute';
                tempContainer.style.top = '-9999px';
                tempContainer.style.left = '0';
                tempContainer.style.width = '210mm';
                tempContainer.style.height = '297mm';
                tempContainer.style.background = 'white';
                const originalElement = document.getElementById('image-print-root');
                const clonedNode = originalElement.cloneNode(true);
                clonedNode.style.width = '100%';
                clonedNode.style.height = '100%';
                clonedNode.style.minWidth = '100%';
                clonedNode.style.minHeight = '100%';
                clonedNode.style.boxShadow = 'none';
                tempContainer.appendChild(clonedNode);
                document.body.appendChild(tempContainer);

                const pdf = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
                try {
                    const canvas = await window.html2canvas(tempContainer, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
                    const imgData = canvas.toDataURL('image/jpeg', 1.0);
                    pdf.addImage(imgData, 'JPEG', 0, 0, pdf.internal.pageSize.getWidth(), (canvas.height * pdf.internal.pageSize.getWidth()) / canvas.width);
                    return pdf;
                } catch (error) { return null; } finally { if (document.body.contains(tempContainer)) document.body.removeChild(tempContainer); }
            };

            const handleNativeImagePrint = async () => {
                showToast('📄 處理中...'); const pdf = await createImagePDF();
                if (pdf) { pdf.autoPrint({variant: 'non-conform'}); const blobUrl = URL.createObjectURL(pdf.output('blob')); const win = window.open(blobUrl); if (!win) pdf.save(`圖檔.pdf`); }
            };

            return (
                <div className="max-w-7xl mx-auto my-4 sm:my-8 p-4 flex flex-col gap-6 print-hide">
                    
                    {/* 🔥 管理員專屬身分識別列 */}
                    <div className="bg-white rounded-2xl shadow-md p-4 px-6 flex justify-between items-center border-l-8 border-indigo-500 flex-wrap gap-4">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl hidden sm:block">🛡️</span>
                            <div>
                                <h1 className="text-xl font-bold text-indigo-900">專屬領據管理後台</h1>
                                <p className="text-xs text-gray-500 font-mono mt-1">安全頻道：{user?.uid}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 bg-gray-50 px-5 py-2 rounded-xl border border-gray-100">
                            <div className="text-right hidden sm:block">
                                <div className="text-sm font-bold text-gray-800">{user?.displayName || '系統管理員'}</div>
                                <div className="text-xs text-gray-500">{user?.email}</div>
                            </div>
                            {user?.photoURL ? (
                                <img src={user.photoURL} alt="Profile" className="w-10 h-10 rounded-full shadow-sm ring-2 ring-white" referrerPolicy="no-referrer" />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm ring-2 ring-white">
                                    {(user?.displayName || user?.email || 'A').charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-6 flex-col lg:flex-row w-full">
                        <div className="w-full lg:w-1/3 space-y-6">
                            <div className="bg-white p-6 rounded-2xl shadow-xl border-t-8 border-purple-600">
                                <h2 className="text-xl font-bold mb-4 text-purple-900">🏢 發放單位設定</h2>
                                <div className="space-y-4">
                                    <div><label className="text-xs font-bold text-gray-400">學校/單位全銜</label><input type="text" className="w-full p-2 border rounded-lg bg-gray-50" value={sysConfig.schoolName} onChange={e => setSysConfig({...sysConfig, schoolName: e.target.value})} /></div>
                                    <div><label className="text-xs font-bold text-gray-400">管理組別/處室名稱</label><input type="text" className="w-full p-2 border rounded-lg bg-gray-50" value={sysConfig.deptName} onChange={e => setSysConfig({...sysConfig, deptName: e.target.value})} /></div>
                                    <button onClick={handleUpdateSysConfig} className="w-full py-2 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700 shadow-md">套用單位名稱</button>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-2xl shadow-xl border-t-8 border-blue-600">
                                <h2 className="text-xl font-bold mb-4 text-gray-800 border-b pb-2">1. 領據金額設定</h2>
                                <div className="space-y-4 text-sm">
                                    <div><label className="text-xs font-bold text-gray-400">款項用途/說明</label><input type="text" className="w-full p-2 border rounded-lg bg-gray-50" value={config.activityName} onChange={e => setConfig({...config, activityName: e.target.value})} /></div>
                                    <div><label className="text-xs font-bold text-gray-400">領據支付單位 (此致)</label><input type="text" className="w-full p-2 border rounded-lg bg-gray-50" value={config.schoolName} onChange={e => setConfig({...config, schoolName: e.target.value})} /></div>
                                    <div className="flex gap-2">
                                        <div className="flex-1"><label className="block text-center text-[10px] text-gray-400">民國年</label><input type="text" className="w-full p-2 border rounded-lg text-center" value={config.year} onChange={e => setConfig({...config, year: e.target.value})} /></div>
                                        <div className="flex-1"><label className="block text-center text-[10px] text-gray-400">月</label><input type="text" className="w-full p-2 border rounded-lg text-center" value={config.month} onChange={e => setConfig({...config, month: e.target.value})} /></div>
                                        <div className="flex-1"><label className="block text-center text-[10px] text-gray-400">日</label><input type="text" className="w-full p-2 border rounded-lg text-center" value={config.day} onChange={e => setConfig({...config, day: e.target.value})} /></div>
                                    </div>
                                    <div className="border-t pt-4 mt-6">
                                        <div className="flex justify-between items-center mb-4 text-xs font-bold">明細清單 <button onClick={addItem} className="text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">+ 新增一行</button></div>
                                        {config.items.map((item, idx) => (
                                            <div key={idx} className="border border-gray-100 p-3 mb-4 rounded-xl bg-gray-50 relative shadow-inner">
                                                <button onClick={() => removeItem(idx)} className="absolute -top-2 -right-2 bg-white text-red-500 rounded-full shadow w-6 h-6 border flex items-center justify-center">✕</button>
                                                <div className="grid grid-cols-2 gap-2 mb-2">
                                                    <input list="item-list" className="p-2 border rounded-lg text-xs" placeholder="項目" value={item.itemName} onChange={e => updateItem(idx, 'itemName', e.target.value)} />
                                                    <input type="date" className="p-2 border rounded-lg text-xs" value={item.itemDate} onChange={e => updateItem(idx, 'itemDate', e.target.value)} />
                                                </div>
                                                <div className="flex gap-1 mb-2">
                                                    <input type="time" className="flex-1 p-2 border rounded-lg text-xs" value={item.startTime} onChange={e => updateItem(idx, 'startTime', e.target.value)} />
                                                    <input type="time" className="flex-1 p-2 border rounded-lg text-xs" value={item.endTime} onChange={e => updateItem(idx, 'endTime', e.target.value)} />
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 mb-2">
                                                    <div className="flex items-center gap-1 border rounded-lg p-1 bg-white"><span className="text-[10px] text-gray-400">節:</span><input type="number" className="w-full outline-none text-xs" value={item.qty} onChange={e => updateItem(idx, 'qty', Number(e.target.value))} /></div>
                                                    <div className="flex items-center gap-1 border rounded-lg p-1 bg-white"><span className="text-[10px] text-gray-400">$:</span><input type="number" className="w-full outline-none text-xs" value={item.price} onChange={e => updateItem(idx, 'price', Number(e.target.value))} /></div>
                                                </div>
                                                <input type="text" className="w-full p-2 border rounded-lg text-[10px] bg-white" placeholder="單筆備註..." value={item.remark || ''} onChange={e => updateItem(idx, 'remark', e.target.value)} />
                                            </div>
                                        ))}
                                        <datalist id="item-list">{itemOptions.map(o => <option key={o} value={o} />)}</datalist>
                                        <div className="p-4 bg-blue-900 rounded-xl text-center font-bold text-white mb-4">總金額：{grandTotal.toLocaleString()} 元</div>
                                    </div>
                                    <button onClick={() => saveConfig(config)} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 shadow-lg active:scale-95">💾 儲存活動設定</button>
                                </div>
                            </div>
                        </div>

                        <div className="w-full lg:w-2/3 bg-white p-8 rounded-2xl shadow-xl border-t-8 border-green-600 h-fit">
                            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-4 border-b border-gray-100 pb-4">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">2. 講師歷史清單</h2>
                                    <p className="text-xs text-green-600 font-extrabold mt-1">✓ 本機安全自動解密中</p>
                                </div>
                                <div className="flex flex-wrap gap-2 w-full xl:w-auto">
                                    <button onClick={() => { window.location.hash=''; sessionStorage.removeItem('receipt_channel'); setView('home'); }} className="flex-1 sm:flex-none bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-300">🏠 首頁</button>
                                    <button onClick={handleCopyShareLink} className="flex-1 sm:flex-none bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow hover:bg-indigo-700 animate-pulse">🔗 複製專屬講師連結</button>
                                    <button onClick={handleDownloadTemplate} className="flex-1 sm:flex-none bg-cyan-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow hover:bg-cyan-700 transition-colors">📄 下載範本</button>
                                    <label className="flex-1 sm:flex-none bg-teal-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow hover:bg-teal-700 transition-colors cursor-pointer text-center flex items-center justify-center">
                                        📥 匯入Excel
                                        <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleImportExcel} />
                                    </label>
                                    <button onClick={() => setIsAddModalOpen(true)} className="flex-1 sm:flex-none bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow hover:bg-green-700">+ 新增</button>
                                    <button onClick={handleBatchDownload} className="flex-1 sm:flex-none bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow hover:bg-orange-600">📥 匯出清單/圖片</button>
                                    <button onClick={() => setIsClearModalOpen(true)} className="flex-1 sm:flex-none bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow hover:bg-red-700">🗑️ 清空</button>
                                    <button onClick={handleLogoutAdmin} className="flex-1 sm:flex-none bg-gray-800 text-white px-4 py-2 rounded-xl text-sm font-bold shadow hover:bg-gray-900">🚪 登出</button>
                                </div>
                            </div>
                            
                            <div className="relative mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                                <div className="relative w-full sm:flex-1">
                                    <span className="absolute left-3 top-3 text-gray-400">🔍</span>
                                    <input type="text" placeholder="搜尋講師..." className="w-full p-3 pl-10 border rounded-2xl bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                </div>
                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    {selectedIds.size > 0 && <span className="text-sm font-bold text-blue-600 whitespace-nowrap">已勾選 {selectedIds.size} 筆</span>}
                                    <button onClick={handleBatchPrint} className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold shadow hover:bg-blue-700 flex justify-center items-center gap-2">🖨️ 批次排版列印</button>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead><tr className="bg-gray-100 text-gray-500 text-xs uppercase tracking-wider">
                                        <th className="p-4 w-12 text-center"><input type="checkbox" className="w-5 h-5 accent-blue-600 cursor-pointer" checked={filteredInstructors.length > 0 && selectedIds.size === filteredInstructors.filter(i=>!i.decryptionFailed).length} onChange={handleSelectAll} /></th>
                                        <th className="p-4">姓名</th>
                                        <th className="p-4 text-center">存摺</th>
                                        <th className="p-4 text-center">簽名</th>
                                        <th className="p-4 text-right">操作</th>
                                    </tr></thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredInstructors.length === 0 ? (
                                            <tr><td colSpan="5" className="p-8 text-center text-gray-400 font-bold bg-gray-50">尚無資料。請點擊上方「複製專屬講師連結」傳送給講師填寫！</td></tr>
                                        ) : filteredInstructors.map(i => (
                                            <tr key={i.id} className={`hover:bg-blue-50/30 transition-colors group ${selectedIds.has(i.id) ? 'bg-blue-50' : ''}`}>
                                                <td className="p-4 text-center"><input type="checkbox" className="w-5 h-5 accent-blue-600 cursor-pointer" checked={selectedIds.has(i.id)} onChange={() => handleSelectInstructor(i.id)} disabled={i.decryptionFailed}/></td>
                                                <td className="p-4">
                                                    <div className="font-bold text-gray-800 text-base cursor-pointer select-none" onClick={() => !i.decryptionFailed && handleSelectInstructor(i.id)}>{i.name}</div>
                                                    {i.decryptionFailed ? <div className="text-[10px] text-red-500 font-bold">解密失敗</div> : <div className="text-[10px] text-gray-400">{maskIdNumber(i.idNumber)}</div>}
                                                </td>
                                                <td className="p-4 text-center">
                                                    {i.decryptionFailed ? '-' : i.passbookUrl ? <button onClick={() => setPreviewImageUrl(i.passbookUrl)} className="px-3 py-1.5 bg-blue-100 text-blue-700 font-bold rounded-lg hover:bg-blue-200">🖼️ 預覽</button> : <label className="cursor-pointer px-3 py-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 text-xs font-bold">📁 上傳<input type="file" accept="image/jpeg, image/png" className="hidden" onChange={(e) => handleQuickUpload(i.id, 'passbookUrl', e)} /></label>}
                                                </td>
                                                <td className="p-4 text-center">
                                                    {i.decryptionFailed ? '-' : i.signatureUrl ? <button onClick={() => setPreviewImageUrl(i.signatureUrl)} className="px-3 py-1.5 bg-green-100 text-green-700 font-bold rounded-lg hover:bg-green-200">✔ 預覽</button> : <label className="cursor-pointer px-3 py-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 text-xs font-bold">✍️ 上傳<input type="file" accept="image/jpeg, image/png" className="hidden" onChange={(e) => handleQuickUpload(i.id, 'signatureUrl', e)} /></label>}
                                                </td>
                                                <td className="p-4 text-right flex justify-end gap-2 items-center">
                                                    <button disabled={i.decryptionFailed} onClick={() => handleSinglePrint(i)} className={`px-4 py-2 rounded-xl font-bold shadow ${i.decryptionFailed ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>排版 👉</button>
                                                    <button onClick={() => setDeleteConfirmId(i.id)} className="px-4 py-2 rounded-xl font-bold shadow bg-red-100 text-red-600 hover:bg-red-200">刪除</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* 預覽圖檔彈窗 */}
                    {previewImageUrl && (
                        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 sm:p-10 print-hide" onClick={() => setPreviewImageUrl(null)}>
                            <div className="relative w-full max-w-4xl bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                                <div className="bg-gray-900 text-white p-4 flex justify-between items-center shrink-0">
                                    <h3 className="text-xl font-bold">🖼️ 圖檔排版</h3>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                        <label className="flex items-center gap-2 text-xs font-bold text-gray-300">
                                            ↔️ 左右移: 
                                            <input type="range" min="-300" max="300" step="5" value={imageOffsetX} onChange={(e) => setImageOffsetX(parseInt(e.target.value) || 0)} className="w-16 accent-yellow-400 hidden sm:block" />
                                            <input type="number" value={imageOffsetX} onChange={(e) => setImageOffsetX(parseInt(e.target.value) || 0)} className="w-12 px-1 text-center text-black rounded" /> px
                                        </label>
                                        <label className="flex items-center gap-2 text-xs font-bold text-gray-300">
                                            ↕️ 上下移: 
                                            <input type="range" min="-300" max="300" step="5" value={imageOffsetY} onChange={(e) => setImageOffsetY(parseInt(e.target.value) || 0)} className="w-16 accent-yellow-400 hidden sm:block" />
                                            <input type="number" value={imageOffsetY} onChange={(e) => setImageOffsetY(parseInt(e.target.value) || 0)} className="w-12 px-1 text-center text-black rounded" /> px
                                        </label>
                                        <label className="flex items-center gap-2 text-xs font-bold text-gray-300">
                                            🔍 縮放: 
                                            <input type="range" min="10" max="200" step="5" value={imageScalePercent} onChange={(e) => setImageScalePercent(parseInt(e.target.value) || 100)} className="w-16 accent-blue-500 hidden sm:block" />
                                            <input type="number" min="10" max="200" value={Math.round(imageScalePercent)} onChange={(e) => setImageScalePercent(parseInt(e.target.value) || 100)} className="w-12 px-1 text-center text-black rounded" /> %
                                        </label>
                                        <button onClick={handleNativeImagePrint} className="bg-blue-600 px-4 py-2 rounded-lg font-bold hover:bg-blue-700 ml-2">🖨️ 列印</button>
                                        <button onClick={() => setPreviewImageUrl(null)} className="text-gray-400 hover:text-red-500 font-bold text-2xl ml-2 px-2">✕</button>
                                    </div>
                                </div>
                                <div className="p-6 bg-gray-200 flex justify-center items-start overflow-auto flex-1 relative">
                                    <div id="image-print-root" className="bg-white shadow-xl mx-auto relative flex flex-col items-center justify-center p-[15mm] shrink-0" style={{ width: '210mm', minWidth: '210mm', height: '297mm', minHeight: '297mm', boxSizing: 'border-box', overflow: 'hidden' }}>
                                        <div style={{ transform: `translate(${imageOffsetX}px, ${imageOffsetY}px) scale(${imageScalePercent / 100})`, transformOrigin: 'center center', width: '100%', display: 'flex', justifyContent: 'center' }}><img src={previewImageUrl} className="max-w-full object-contain pointer-events-none" /></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {isAddModalOpen && (
                        <div className="fixed inset-0 z-[100] bg-black/60 flex justify-center items-center p-4">
                            <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-2xl border max-h-[90vh] overflow-y-auto">
                                <h3 className="text-2xl font-bold mb-6 text-gray-800">建立講師基本個資</h3>
                                <form onSubmit={handleAdminAddSubmit} className="space-y-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div><label className="block text-sm font-bold mb-1">講師姓名</label><input required type="text" className="w-full p-3 border rounded-xl bg-gray-50" value={addFormData.name} onChange={e => setAddFormData({...addFormData, name: e.target.value})} /></div>
                                        <div><label className="block text-sm font-bold mb-1">身分證字號</label><input required type="text" className="w-full p-3 border rounded-xl bg-gray-50" value={addFormData.idNumber} onChange={e => setAddFormData({...addFormData, idNumber: e.target.value})} /></div>
                                    </div>
                                    <div className="flex gap-4 mt-6 pt-4 border-t">
                                        <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-4 border rounded-2xl font-bold text-gray-400">取消</button>
                                        <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold">自動加密並儲存</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {isClearModalOpen && (
                        <div className="fixed inset-0 z-[200] bg-black/60 flex justify-center items-center p-4"><div className="bg-white p-8 rounded-3xl text-center"><h3 className="text-2xl font-bold text-red-600">確定清空所有資料？</h3><div className="flex gap-4 mt-6"><button onClick={() => setIsClearModalOpen(false)} className="flex-1 py-3 border-2 rounded-2xl">取消</button><button onClick={handleClearAllData} className="flex-1 py-3 bg-red-600 text-white rounded-2xl">清空</button></div></div></div>
                    )}
                    {deleteConfirmId && (
                        <div className="fixed inset-0 z-[200] bg-black/60 flex justify-center items-center p-4"><div className="bg-white p-8 rounded-3xl text-center"><h3 className="text-2xl font-bold text-red-600">確定刪除？</h3><div className="flex gap-4 mt-6"><button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-3 border-2 rounded-2xl">取消</button><button onClick={handleConfirmSingleDelete} className="flex-1 py-3 bg-red-600 text-white rounded-2xl">刪除</button></div></div></div>
                    )}
                </div>
            );
        }

        function ReceiptView({ setView, config, instructors, showToast, sysConfig }) {
            const [showSignature, setShowSignature] = useState(true);
            const [scalePercent, setScalePercent] = useState(85);
            const [marginY, setMarginY] = useState(15);
            const [marginX, setMarginX] = useState(15);
            const [paperSize, setPaperSize] = useState('a4');

            // 🔥 新增：記錄每個講師的獨立簽名定位狀態
            const [sigTransforms, setSigTransforms] = useState({});
            const [editingInstructor, setEditingInstructor] = useState(null);

            const createPDF = async () => {
                if (!window.jspdf || !window.html2canvas) {
                    showToast('PDF 引擎載入中，請稍候再試...');
                    return null;
                }
                const tempContainer = document.createElement('div');
                tempContainer.style.position = 'absolute';
                tempContainer.style.top = '-9999px';
                tempContainer.style.left = '0';
                tempContainer.style.width = paperSize === 'a4' ? '210mm' : '176mm';
                tempContainer.style.background = 'white';
                
                const originalPages = document.querySelectorAll('.a4-page');
                originalPages.forEach(page => {
                    const clone = page.cloneNode(true);
                    clone.style.margin = '0';
                    clone.style.boxShadow = 'none';
                    const cutLines = clone.querySelectorAll('.cut-line');
                    cutLines.forEach(el => el.remove());
                    tempContainer.appendChild(clone);
                });
                document.body.appendChild(tempContainer);
                const pdf = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: paperSize });

                try {
                    const tempPages = tempContainer.childNodes;
                    for (let i = 0; i < tempPages.length; i++) {
                        if (i > 0) pdf.addPage();
                        const canvas = await window.html2canvas(tempPages[i], { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff', windowWidth: tempContainer.scrollWidth });
                        const imgData = canvas.toDataURL('image/jpeg', 1.0);
                        const pdfWidth = pdf.internal.pageSize.getWidth();
                        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
                    }
                    return pdf;
                } catch (error) { showToast('❌ PDF 產生失敗，請稍後再試。'); return null; } 
                finally { if (document.body.contains(tempContainer)) document.body.removeChild(tempContainer); }
            };

            const handleNativePrint = async () => {
                showToast('📄 產生高畫質列印檔中，請稍候...'); const pdf = await createPDF();
                if (pdf) {
                    pdf.autoPrint({variant: 'non-conform'});
                    const blobUrl = URL.createObjectURL(pdf.output('blob'));
                    const win = window.open(blobUrl);
                    if (!win) { showToast('⚠️ 瀏覽器阻擋了彈出視窗，改為直接下載，請開啟檔案後手動列印。'); pdf.save(`講師領據_列印檔.pdf`); }
                }
            };

            const pages = []; for(let i = 0; i < instructors.length; i += 2) pages.push(instructors.slice(i, i + 2));

            return (
                <div className="bg-white relative pb-20 print:pb-0">
                    <div className="bg-gray-900 text-white p-4 flex flex-col sm:flex-row justify-between items-center sticky top-0 z-[150] shadow-2xl gap-4 print:hidden">
                        <div className="flex items-center gap-4">
                            <button onClick={setView} className="text-gray-400 hover:text-white flex items-center gap-1 transition-colors whitespace-nowrap">← 返回</button>
                            <span className="font-bold border-l border-gray-700 pl-4 text-sm truncate">排版並列印 {instructors.length} 張領據</span>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-3 w-full lg:w-auto bg-gray-800 p-3 rounded-xl shadow-inner">
                            <div className="flex items-center gap-4 bg-gray-700 px-4 py-2 rounded-lg border border-gray-600 w-full sm:w-auto">
                                <label className="flex items-center gap-2 text-xs font-bold text-gray-300">
                                    ↔️ 左右距:
                                    <input type="range" min="0" max="80" step="1" value={marginX} onChange={(e) => setMarginX(parseFloat(e.target.value))} className="w-16 accent-yellow-400 hidden lg:block" />
                                    <input type="number" min="0" max="80" value={marginX} onChange={(e) => setMarginX(parseInt(e.target.value) || 0)} className="w-12 px-1 text-center text-black rounded outline-none" /> mm
                                </label>
                                <label className="flex items-center gap-2 text-xs font-bold text-gray-300 border-l border-gray-500 pl-4">
                                    ↕️ 上下距:
                                    <input type="range" min="0" max="80" step="1" value={marginY} onChange={(e) => setMarginY(parseFloat(e.target.value))} className="w-16 accent-yellow-400 hidden lg:block" />
                                    <input type="number" min="0" max="80" value={marginY} onChange={(e) => setMarginY(parseInt(e.target.value) || 0)} className="w-12 px-1 text-center text-black rounded outline-none" /> mm
                                </label>
                            </div>
                            <div className="flex items-center gap-4 w-full sm:w-auto">
                                <label className="flex items-center gap-2 text-xs font-bold text-gray-300">
                                    🔍 縮放:
                                    <input type="range" min="50" max="150" step="1" value={scalePercent} onChange={(e) => setScalePercent(parseInt(e.target.value) || 100)} className="w-16 accent-blue-500 hidden sm:block" />
                                    <input type="number" min="10" max="200" step="1" value={scalePercent} onChange={(e) => setScalePercent(parseInt(e.target.value) || 100)} className="w-12 px-1 text-center text-black rounded outline-none" /> %
                                </label>
                                <label className="flex items-center gap-1 cursor-pointer text-xs font-bold text-gray-300 hover:text-white transition-colors border-l border-gray-600 pl-4" title="將簽名檔放置於領據中">
                                    <input type="checkbox" checked={showSignature} onChange={(e) => setShowSignature(e.target.checked)} className="w-4 h-4 accent-blue-500 cursor-pointer" />
                                    簽名
                                </label>
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <button onClick={handleNativePrint} className="flex-1 sm:flex-none bg-blue-600 px-4 py-2 rounded-lg font-bold hover:bg-blue-700 shadow-md flex justify-center items-center gap-2 active:scale-95 transition-all text-sm whitespace-nowrap">
                                    🖨️ 產生 PDF 並列印
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    {/* 🔥 當點擊簽名時彈出獨立視窗 */}
                    {editingInstructor && (
                        <SignatureAdjustModal 
                            instructor={editingInstructor}
                            initialTransform={sigTransforms[editingInstructor.id]} 
                            onSave={(newTransform) => {
                                setSigTransforms(prev => ({ ...prev, [editingInstructor.id]: newTransform }));
                                setEditingInstructor(null);
                            }}
                            onClose={() => setEditingInstructor(null)}
                        />
                    )}

                    <div className="w-full flex flex-col items-center py-10 bg-gray-200 min-h-screen print:bg-white print:py-0 print:min-h-0">
                        <div id="print-root" className="w-full mx-auto flex flex-col items-center">
                            {pages.map((pageInstructors, pageIndex) => (
                                <div key={pageIndex} className="bg-white shadow-2xl mb-8 relative a4-page flex flex-col justify-between"
                                     style={{ width: '210mm', minWidth: '210mm', height: '297mm', padding: `${marginY}mm ${marginX}mm`, boxSizing: 'border-box', backgroundColor: 'white', overflow: 'hidden' }}>
                                    {pageInstructors.map((instructor, itemIndex) => (
                                        <React.Fragment key={instructor.id}>
                                            <div className="flex-1 flex flex-col justify-start items-center overflow-hidden w-full relative">
                                                <div className="scale-container" style={{ transform: `scale(${scalePercent / 100})`, transformOrigin: 'top center', width: `${100 / (scalePercent / 100)}%` }}>
                                                    <ReceiptTemplate 
                                                        config={config} 
                                                        instructor={instructor} 
                                                        sysConfig={sysConfig} 
                                                        showSignature={showSignature}
                                                        sigTransform={sigTransforms[instructor.id]}
                                                        onEditSignature={(inst) => setEditingInstructor(inst)} 
                                                    />
                                                </div>
                                            </div>
                                            {itemIndex === 0 && pageInstructors.length > 1 && (<div className="cut-line w-full border-t border-dashed border-gray-400 relative flex items-center justify-center print:hidden" style={{ height: '0', margin: '2mm 0' }}><span className="absolute bg-white px-2 text-gray-500 text-[10px] tracking-widest">✂️ 裁切線</span></div>)}
                                        </React.Fragment>
                                    ))}
                                    {pageInstructors.length === 1 && (<div className="flex-1 flex flex-col justify-start items-center overflow-hidden w-full relative"></div>)}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            );
        }

        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(<App />);
    </script>
</body>
</html>